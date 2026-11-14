import { useEffect, useRef, type ReactNode } from 'react';
import { BigButton } from './BigButton.tsx';

interface ConfirmDialogProps {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 확인 대화상자 — Esc 로 취소, 열리면 확인 버튼에 포커스 */
export function ConfirmDialog({ title, children, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border-2 border-slate-400 bg-white p-8 shadow-xl">
        <h2 id="confirm-title" className="mb-4 text-2xl font-bold">
          {title}
        </h2>
        {children && <div className="mb-6 space-y-3 text-lg">{children}</div>}
        <div className="flex justify-end gap-3">
          <BigButton variant="secondary" onClick={onCancel} disabled={busy}>
            취소
          </BigButton>
          <BigButton ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? '처리 중…' : confirmLabel}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
