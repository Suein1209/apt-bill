import { CircleCheckBig } from 'lucide-react';
import { DONG_COUNT } from '../../constants/buildingUnits.ts';
import { dongStatus, isDongFullyPaid } from '../../domain/billing.ts';
import type { Unit, UnitBill } from '../../types/bill.ts';

interface DongButtonGridProps {
  units: readonly Unit[];
  bills: readonly UnitBill[];
  onSelectDong: (dong: number) => void;
}

/** 9개 동 큰 버튼 + 미납 현황·납부 진행 막대 (G-3, G-4), 전 세대 납부 완료 배지 (G-16) — 시안 A 카드 */
export function DongButtonGrid({ units, bills, onSelectDong }: DongButtonGridProps) {
  const dongs = Array.from({ length: DONG_COUNT }, (_, index) => index + 1);
  return (
    <div className="grid grid-cols-3 gap-4">
      {dongs.map((dong) => {
        const status = dongStatus(units, bills, dong);
        const allPaid = isDongFullyPaid(status);
        const paidPercent = status.targetCount === 0 ? 0 : Math.round(((status.targetCount - status.unpaidCount) / status.targetCount) * 100);
        return (
          <button
            key={dong}
            type="button"
            onClick={() => onSelectDong(dong)}
            className={`flex min-h-36 flex-col justify-center gap-3 rounded-[18px] p-5 text-left shadow-card focus:outline-none focus:ring-4 focus:ring-blue-400 ${
              allPaid ? 'border-2 border-lime-600 bg-lime-50 hover:bg-lime-100' : 'border border-line bg-white hover:border-slate-400'
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-4xl font-extrabold">{dong}동</span>
              {allPaid && (
                <span className="inline-flex items-center gap-1 rounded-full bg-lime-200 py-1 pl-2 pr-3 text-base font-bold text-lime-900">
                  <CircleCheckBig className="h-5 w-5" aria-hidden="true" />
                  완납
                </span>
              )}
            </span>
            {allPaid ? (
              <strong className="text-xl text-lime-900">{status.targetCount}세대 모두 납부 완료</strong>
            ) : (
              <span className="text-xl text-slate-700">
                {status.targetCount}세대 중 <strong className="text-orange-800">{status.unpaidCount}세대 미납</strong>
              </span>
            )}
            {/* 납부 진행 막대 — 글자로도 같은 내용을 알리므로 화면 읽기에서는 숨긴다 */}
            <span aria-hidden="true" className="block h-2.5 overflow-hidden rounded-full bg-slate-200">
              <span className={`block h-full rounded-full ${allPaid ? 'bg-lime-600' : 'bg-brand'}`} style={{ width: `${paidPercent}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
