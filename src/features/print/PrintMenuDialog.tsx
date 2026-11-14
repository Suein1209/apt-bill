/**
 * 출력 메뉴 — 납부 확인표 / 납부 금액표 고르기 (P-14)
 */
import { useEffect } from 'react';
import { ClipboardCheck, Receipt } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { SHEET_TITLES, type SheetMode } from './PaymentSheetView.tsx';

interface PrintMenuDialogProps {
  onSelect: (mode: SheetMode) => void;
  onCancel: () => void;
}

const DESCRIPTIONS: Readonly<Record<SheetMode, string>> = {
  check: '세대마다 납부 확인이 끝났는지 ✔ 로 표시합니다.',
  amount: '세대마다 낸 금액과 층·동 합계를 표시합니다.',
};

export function PrintMenuDialog({ onSelect, onCancel }: PrintMenuDialogProps) {
  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="print-menu-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-xl rounded-2xl border-2 border-slate-400 bg-white p-8 shadow-xl">
        <h2 id="print-menu-title" className="mb-6 text-2xl font-bold">
          무엇을 출력할까요?
        </h2>
        <div className="space-y-4">
          {(['check', 'amount'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              autoFocus={mode === 'check'}
              onClick={() => onSelect(mode)}
              className="flex w-full items-center gap-4 rounded-xl border-4 border-slate-700 bg-white p-5 text-left hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-400"
            >
              {mode === 'check' ? <ClipboardCheck className="h-10 w-10 shrink-0" aria-hidden="true" /> : <Receipt className="h-10 w-10 shrink-0" aria-hidden="true" />}
              <span>
                <span className="block text-2xl font-extrabold">{SHEET_TITLES[mode]}</span>
                <span className="block text-lg text-slate-700">{DESCRIPTIONS[mode]}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <BigButton variant="secondary" onClick={onCancel}>
            취소
          </BigButton>
        </div>
      </div>
    </div>
  );
}
