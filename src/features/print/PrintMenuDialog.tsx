/**
 * 출력 메뉴 — 납부 확인표 / 납부 금액표 / 관리비 통지 내역 고르기 (P-14, P-18)
 */
import { useEffect } from 'react';
import { ClipboardCheck, FileText, Receipt } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { SHEET_TITLES, type SheetMode } from './PaymentSheetView.tsx';

/** 출력 종류 — 납부표 두 가지와 세대별 통지서 */
export type PrintChoice = SheetMode | 'notice';

interface PrintMenuDialogProps {
  onSelect: (choice: PrintChoice) => void;
  onCancel: () => void;
}

const CHOICES: readonly PrintChoice[] = ['check', 'amount', 'notice'];

const TITLES: Readonly<Record<PrintChoice, string>> = { ...SHEET_TITLES, notice: '관리비 통지 내역' };

const DESCRIPTIONS: Readonly<Record<PrintChoice, string>> = {
  check: '세대마다 납부 확인이 끝났는지 ✔ 로 표시합니다.',
  amount: '세대마다 낸 금액과 층·동 합계를 표시합니다.',
  notice: '고른 세대의 관리비 통지서를 A4 반쪽 크기로 출력합니다.',
};

const ICONS: Readonly<Record<PrintChoice, typeof FileText>> = { check: ClipboardCheck, amount: Receipt, notice: FileText };

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
      <div className="w-full max-w-xl card p-8 shadow-xl">
        <h2 id="print-menu-title" className="mb-6 text-2xl font-bold">
          무엇을 출력할까요?
        </h2>
        <div className="space-y-4">
          {CHOICES.map((choice) => {
            const Icon = ICONS[choice];
            return (
              <button
                key={choice}
                type="button"
                autoFocus={choice === CHOICES[0]}
                onClick={() => onSelect(choice)}
                className="flex w-full items-center gap-4 rounded-[18px] border-2 border-slate-300 bg-white p-5 text-left hover:border-brand hover:bg-blue-50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-blue-300"
              >
                <Icon className="h-10 w-10 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <span className="block text-2xl font-extrabold">{TITLES[choice]}</span>
                  <span className="block text-lg text-slate-700">{DESCRIPTIONS[choice]}</span>
                </span>
              </button>
            );
          })}
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
