/**
 * 이번 달 비용 입력 — 1차 4칸 + 2차 카테고리·항목 + 합계 (F-1 ~ F-15, P-12 미리보기)
 */
import type { Firestore } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { MoneyInput } from '../../components/MoneyInput.tsx';
import { PRIMARY_FEE_ITEMS } from '../../constants/feeItems.ts';
import { formatWon, formatYearMonth } from '../../domain/format.ts';
import { savePrimaryCost } from '../../services/firestore/monthRepo.ts';
import { SecondaryEditor } from './SecondaryEditor.tsx';
import type { MonthAccess } from '../month/monthAccess.ts';
import type { MonthDoc, MonthSummary } from '../../types/bill.ts';

interface CostEntryScreenProps {
  db: Firestore;
  uid: string;
  month: MonthDoc;
  summary: MonthSummary;
  access: MonthAccess;
  onBack: () => void;
}

export function CostEntryScreen({ db, uid, month, summary, access, onBack }: CostEntryScreenProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center gap-4 border-b-2 border-slate-300 bg-white px-6 py-4">
        <BigButton variant="secondary" icon={<ArrowLeft className="h-6 w-6" aria-hidden="true" />} onClick={onBack}>
          홈으로
        </BigButton>
        <h1 className="text-3xl font-bold">{formatYearMonth(month.yearMonth)} 비용 입력</h1>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-6">
        {access.reason && (
          <p role="status" className="rounded-lg border-2 border-amber-700 bg-amber-50 px-4 py-3 text-lg font-semibold text-amber-900">
            {access.reason}
          </p>
        )}

        <section aria-labelledby="totals" className="grid grid-cols-2 gap-4 rounded-2xl border-2 border-blue-800 bg-blue-50 p-6 text-xl md:grid-cols-4">
          <h2 id="totals" className="sr-only">
            합계
          </h2>
          <Stat label="1차 합계" value={formatWon(summary.primaryTotal)} />
          <Stat label="2차 합계" value={formatWon(summary.secondaryTotal)} />
          <Stat label="부과 대상" value={`${summary.targetCount}곳`} />
          <Stat label="세대당 금액" value={formatWon(summary.perUnitShare)} />
        </section>

        <section aria-labelledby="primary" className="rounded-2xl border-2 border-slate-300 bg-white p-6">
          <h2 id="primary" className="mb-4 text-2xl font-bold">
            1차 항목 (공통 비용)
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {PRIMARY_FEE_ITEMS.map(({ key, label }) => (
              <MoneyInput
                key={key}
                id={`primary-${key}`}
                label={label}
                value={month.primaryCosts[key]}
                disabled={!access.canEdit}
                onCommit={async (amount) => {
                  const result = await savePrimaryCost(db, month.yearMonth, key, amount, uid);
                  return result.ok ? null : result.message;
                }}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="secondary">
          <h2 id="secondary" className="mb-4 text-2xl font-bold">
            2차 항목 (추가로 든 비용)
          </h2>
          <SecondaryEditor db={db} uid={uid} yearMonth={month.yearMonth} categories={month.secondaryCategories} canEdit={access.canEdit} />
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg text-slate-700">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
    </div>
  );
}
