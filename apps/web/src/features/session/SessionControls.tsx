import { useState } from 'react';

export type StorageStatus = 'not-connected' | 'unsaved' | 'saved-local' | 'saving' | 'failed';
export type SyncStatus = 'not-connected' | 'offline' | 'pending' | 'syncing' | 'synced' | 'failed';

type SessionControlsProps = {
  storageStatus?: StorageStatus;
  syncStatus?: SyncStatus;
  onSave?: () => Promise<void>;
  onExit?: () => Promise<void>;
};

const storageLabels: Record<StorageStatus, string> = {
  'not-connected': 'Chưa kết nối lưu local',
  unsaved: 'Chưa lưu',
  'saved-local': 'Đã lưu trên máy',
  saving: 'Đang lưu',
  failed: 'Lưu lỗi',
};
const syncLabels: Record<SyncStatus, string> = {
  'not-connected': 'Chưa kết nối đồng bộ',
  offline: 'Đang offline',
  pending: 'Chờ đồng bộ',
  syncing: 'Đang đồng bộ',
  synced: 'Đã đồng bộ server',
  failed: 'Đồng bộ lỗi',
};

export function SessionControls({
  storageStatus = 'not-connected',
  syncStatus = 'not-connected',
  onSave,
  onExit,
}: SessionControlsProps) {
  const [running, setRunning] = useState<'save' | 'exit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = running !== null || storageStatus === 'saving';

  async function run(action: 'save' | 'exit') {
    const callback = action === 'save' ? onSave : onExit;
    if (!callback || busy) return;
    setError(null);
    setRunning(action);
    try {
      // Storage adapter must only resolve when the durable local commit has completed.
      await callback();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Không thể lưu phiên. Vẫn ở trang hiện tại.',
      );
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="session-controls">
      <div className="session-statuses" role="group" aria-label="Trạng thái lưu và đồng bộ">
        <span className="status-text">Local: {storageLabels[storageStatus]}</span>
        <span className="status-text">Sync: {syncLabels[syncStatus]}</span>
      </div>
      <button
        type="button"
        className="quiet-button"
        disabled={!onSave || busy}
        onClick={() => {
          void run('save');
        }}
      >
        Lưu phiên
      </button>
      <button
        type="button"
        className="quiet-button"
        disabled={!onExit || busy}
        onClick={() => {
          void run('exit');
        }}
      >
        Thoát phiên
      </button>
      {error && (
        <span className="header-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
