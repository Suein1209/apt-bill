import { CircleCheckBig } from 'lucide-react';
import { DONG_COUNT } from '../../constants/buildingUnits.ts';
import { dongStatus, isDongFullyPaid } from '../../domain/billing.ts';
import type { Unit, UnitBill } from '../../types/bill.ts';

interface DongButtonGridProps {
  units: readonly Unit[];
  bills: readonly UnitBill[];
  onSelectDong: (dong: number) => void;
}

/** 9개 동 큰 버튼 + 미납 현황 (G-3, G-4), 전 세대 납부 완료 배지 (G-16) */
export function DongButtonGrid({ units, bills, onSelectDong }: DongButtonGridProps) {
  const dongs = Array.from({ length: DONG_COUNT }, (_, index) => index + 1);
  return (
    <div className="grid grid-cols-3 gap-4">
      {dongs.map((dong) => {
        const status = dongStatus(units, bills, dong);
        const allPaid = isDongFullyPaid(status);
        return (
          <button
            key={dong}
            type="button"
            onClick={() => onSelectDong(dong)}
            className={`relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-4 p-4 focus:outline-none focus:ring-4 focus:ring-blue-400 ${
              allPaid ? 'border-green-700 bg-green-50 hover:bg-green-100' : 'border-slate-700 bg-white hover:bg-slate-100'
            }`}
          >
            {allPaid && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-700 py-1 pl-2 pr-3 text-lg font-bold text-white shadow">
                <CircleCheckBig className="h-6 w-6" aria-hidden="true" />
                완납
              </span>
            )}
            <span className="text-4xl font-extrabold">{dong}동</span>
            {allPaid ? (
              <strong className="text-xl text-green-800">{status.targetCount}세대 모두 납부 완료</strong>
            ) : (
              <span className="text-xl">
                {status.targetCount}세대 중 <strong className="text-red-700">{status.unpaidCount}세대 미납</strong>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
