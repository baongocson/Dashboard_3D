import { useEffect, useState } from 'react';
import { authSessionResponseSchema, publicUserSchema } from '@dashboard/contracts';
import type { z } from 'zod';
import { api, HttpError, type Account } from '../../sync/client';
import { db } from '../../storage/db';

type User = z.infer<typeof publicUserSchema>;
function cachedUser(): User | null {
  try {
    const parsed = publicUserSchema.safeParse(
      JSON.parse(localStorage.getItem('dashboard-user') ?? 'null'),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export async function clearAccountData(ownerId: string) {
  const projects = await db.projects.where('ownerId').equals(ownerId).toArray();
  const projectIds = new Set(projects.map((p) => p.id));
  const versions = (await db.versions.toArray()).filter((v) => projectIds.has(v.projectId));
  const versionIds = new Set(versions.map((v) => v.id)),
    manifests = new Set(versions.map((v) => v.manifestId));
  await db.transaction('rw', db.tables, async () => {
    for (const project of projects) {
      await db.projects.delete(project.id);
      await db.sessions.delete(project.sessionId);
      await db.datasets.delete(project.datasetId);
      await db.syncJobs.delete(project.id);
    }
    await db.versions.bulkDelete(versions.map((v) => v.id));
    for (const id of manifests) {
      await db.chunks.where('manifestId').equals(id).delete();
      await db.manifests.delete(id);
    }
    await db.histories.filter((h) => versionIds.has(h.toVersionId)).delete();
    await db.outbox.filter((o) => projectIds.has(o.projectId)).delete();
    await db.charts.filter((c) => projectIds.has(c.projectId)).delete();
    await db.remoteRevisions.filter((r) => r.key.startsWith(`${ownerId}:`)).delete();
  });
}
export function AccountPanel({
  onAccount,
  onIdentity,
  onLogout,
  onSync,
  busy,
}: {
  onAccount: (account: Account | null) => void;
  onIdentity: (id: string | null) => void;
  onLogout: () => void;
  onSync: (account: Account) => Promise<void>;
  busy: boolean;
}) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [running, setRunning] = useState(false),
    [confirmLogout, setConfirmLogout] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  function install(next: Account | null) {
    setAccount(next);
    onAccount(next);
    setUser(next?.user ?? null);
    onIdentity(next?.user.id ?? null);
    if (next) localStorage.setItem('dashboard-user', JSON.stringify(next.user));
    else localStorage.removeItem('dashboard-user');
  }
  useEffect(() => {
    if (!navigator.onLine) onIdentity(cachedUser()?.id ?? null);
    let active = true;
    async function probe() {
      try {
        if (localStorage.getItem('dashboard-pending-logout')) {
          await api('/auth/logout', 'POST', {});
          localStorage.removeItem('dashboard-pending-logout');
          if (active) install(null);
          return;
        }
        const result = authSessionResponseSchema.parse(
          await api('/auth/session', 'GET', undefined, undefined, true),
        );
        if (active) install(result);
      } catch (caught: unknown) {
        if (active) onIdentity(cachedUser()?.id ?? null);
        if (active && caught instanceof HttpError && caught.status === 401) {
          setAccount(null);
          onAccount(null);
          setMessage('Phiên online đã hết hạn. Dữ liệu local được giữ; đăng nhập lại để đồng bộ.');
        }
      }
    }
    const online = () => {
      void probe();
    };
    void probe();
    window.addEventListener('online', online);
    return () => {
      active = false;
      window.removeEventListener('online', online);
    };
  }, []);
  useEffect(() => {
    if (!account) return;
    let nextTouch = 0;
    const activity = () => {
      if (!navigator.onLine || Date.now() < nextTouch) return;
      nextTouch = Date.now() + 60_000;
      void api('/auth/session')
        .then((value) => {
          const checked = authSessionResponseSchema.parse(value);
          setAccount(checked);
          onAccount(checked);
        })
        .catch((caught: unknown) => {
          if (caught instanceof HttpError && caught.status === 401) {
            setAccount(null);
            onAccount(null);
            setMessage('Phiên đã hết hạn. Dữ liệu local vẫn được giữ.');
          }
        });
    };
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    return () => {
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
    };
  }, [account?.user.id]);
  async function submit() {
    if (running || busy) return;
    setRunning(true);
    setMessage(null);
    try {
      if (localStorage.getItem('dashboard-pending-logout')) {
        await api('/auth/logout', 'POST', {});
        localStorage.removeItem('dashboard-pending-logout');
      }
      const result = await api(`/auth/${mode}`, 'POST', { username, password });
      setPassword('');
      if (mode === 'register') {
        setMode('login');
        setMessage('Đăng ký thành công. Hãy đăng nhập.');
      } else install(authSessionResponseSchema.parse(result));
    } catch (caught: unknown) {
      setMessage(caught instanceof Error ? caught.message : 'Không kết nối được API.');
    } finally {
      setRunning(false);
    }
  }
  async function logout(discard: boolean) {
    if (!user || busy || running) return;
    setRunning(true);
    setMessage(null);
    try {
      const owned = new Set(
        (await db.projects.where('ownerId').equals(user.id).toArray()).map((p) => p.id),
      );
      const pending = (await db.outbox.toArray()).filter(
        (o) => owned.has(o.projectId) && o.status !== 'synced',
      );
      if (!navigator.onLine && pending.length)
        throw new Error('Offline và có dữ liệu chưa đồng bộ: chưa thể đăng xuất.');
      if (pending.length && !discard) {
        if (!account) throw new Error('Hãy đăng nhập lại để đồng bộ hoặc xác nhận xóa bản local.');
        await onSync(account);
      }
      if (navigator.onLine) await api('/auth/logout', 'POST', {});
      else localStorage.setItem('dashboard-pending-logout', '1');
      await clearAccountData(user.id);
      install(null);
      setConfirmLogout(false);
      onLogout();
    } catch (caught: unknown) {
      setMessage(
        caught instanceof Error ? caught.message : 'Đăng xuất thất bại; dữ liệu local được giữ.',
      );
    } finally {
      setRunning(false);
    }
  }
  return (
    <details className="account-panel" open={!user}>
      <summary>
        {user
          ? `Tài khoản: ${user.username}${account ? '' : ' (local/offline)'}`
          : 'Đăng nhập / Đăng ký'}
      </summary>
      <div className="account-body">
        {user && account ? (
          <>
            <p>Đã đăng nhập: {user.username}</p>
            <button
              disabled={busy || running}
              className="quiet-button"
              onClick={() => {
                setConfirmLogout(true);
              }}
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <h3>{mode === 'login' ? 'Đăng nhập' : 'Đăng ký (không cần email)'}</h3>
            <label className="form-field">
              Tên đăng nhập
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                }}
                required
              />
            </label>
            <label className="form-field">
              Mật khẩu
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                required
              />
            </label>
            <div className="action-row">
              <button className="primary-button" disabled={running || busy} type="submit">
                {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </button>
              <button
                type="button"
                className="quiet-button"
                disabled={running}
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                }}
              >
                {mode === 'login' ? 'Chuyển sang đăng ký' : 'Về đăng nhập'}
              </button>
            </div>
            {user && (
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setConfirmLogout(true);
                }}
              >
                Đăng xuất tài khoản local
              </button>
            )}
          </form>
        )}
        {confirmLogout && (
          <div role="dialog" aria-label="Xác nhận đăng xuất">
            <p>
              Đăng xuất sẽ xóa dữ liệu local của tài khoản này. Chọn đồng bộ trước để giữ kết quả
              trên server. Khi offline và còn dữ liệu chưa đồng bộ, đăng xuất bị chặn.
            </p>
            <button
              disabled={running || busy}
              onClick={() => {
                void logout(false);
              }}
            >
              Đồng bộ trước rồi đăng xuất
            </button>
            <button
              disabled={running || busy || !navigator.onLine}
              onClick={() => {
                void logout(true);
              }}
            >
              Xác nhận vẫn đăng xuất và xóa dữ liệu chưa đồng bộ
            </button>
            <button
              disabled={running}
              onClick={() => {
                setConfirmLogout(false);
              }}
            >
              Hủy
            </button>
          </div>
        )}
        {message && (
          <p role="status" className="hint">
            {message}
          </p>
        )}
        {!user && (
          <p className="hint">
            Đăng nhập để tạo hoặc mở project. Tài khoản đã mở khóa trên máy có thể tiếp tục làm việc
            offline.
          </p>
        )}
      </div>
    </details>
  );
}
