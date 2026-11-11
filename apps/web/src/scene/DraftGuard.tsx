import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
type Editor = { save: () => Promise<boolean>; discard: () => void; saving: boolean };
const Context = createContext<{
  bind: (editor: Editor) => () => void;
  request: (action: () => void) => void;
}>({
  bind: () => () => {},
  request: (action: () => void) => {
    action();
  },
});
export function useDraftGuard() {
  return useContext(Context);
}
export function DraftGuard({ children }: { children: ReactNode }) {
  const editor = useRef<Editor | null>(null);
  const replay = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const bind = useCallback((session: Editor) => {
    editor.current = session;
    return () => {
      if (editor.current === session) editor.current = null;
    };
  }, []);
  const request = useCallback((action: () => void) => {
    if (editor.current?.saving) return;
    if (editor.current) setPending(() => action);
    else action();
  }, []);
  const value = useMemo(() => ({ bind, request }), [bind, request]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (editor.current) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
  function proceed() {
    const action = pending;
    editor.current = null;
    setPending(null);
    requestAnimationFrame(() => {
      action?.();
    });
  }
  return (
    <Context.Provider value={value}>
      <div
        onClickCapture={(event) => {
          if (replay.current || !editor.current || !(event.target instanceof Element)) return;
          if (
            event.target.closest(
              '.scatter-details,.scatter-controls,.scene-canvas,[data-edit-dialog]',
            )
          )
            return;
          const target = event.target.closest<HTMLElement>('button,a,summary,input,select');
          if (!target) return;
          event.preventDefault();
          event.stopPropagation();
          request(() => {
            if (target.isConnected) {
              replay.current = true;
              try {
                target.click();
              } finally {
                replay.current = false;
              }
            }
          });
        }}
      >
        {children}
        {pending && (
          <div className="draft-dialog-backdrop" data-edit-dialog>
            <div
              className="draft-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Unsaved Changes"
            >
              <p>This row has unsaved changes.</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSaving(true);
                  void (async () => {
                    try {
                      if (!editor.current || (await editor.current.save())) proceed();
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
              >
                Save and Continue
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  editor.current?.discard();
                  proceed();
                }}
              >
                Discard and Continue
              </button>
              <button
                type="button"
                disabled={saving}
                autoFocus
                onClick={() => {
                  setPending(null);
                }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
