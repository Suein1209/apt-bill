/**
 * 이번 달 비용 입력 — 공용 비용 4칸(수도 단가 줄 포함) + 유지비 지출 내역 카테고리·항목 + 합계 (F-1 ~ F-18, P-12 미리보기)
 * 세대당 금액은 공용 비용만 나눈다. 유지비 지출 내역은 합계만 보여 준다 (F-18)
 */
import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { MoneyInput, UsageInput } from '../../components/MoneyInput.tsx';
import { PRIMARY_FEE_ITEMS, WATER_RATE_KEY } from '../../constants/feeItems.ts';
import { perShare, waterRate } from '../../domain/billing.ts';
import { formatRawWaterRate, formatWon, formatYearMonth, parseAmountInput, parseUsageInput } from '../../domain/format.ts';
import { isValidAmount } from '../../domain/money.ts';
import { useDraftEntries } from '../../hooks/useDraftEntries.ts';
import { savePrimaryCost, saveWaterTotalUsage, updateSecondary } from '../../services/firestore/monthRepo.ts';
import { costDraftKey, isCostDraftKey, resolveCostDraftKey } from './costDraft.ts';
import { SecondaryEditor } from './SecondaryEditor.tsx';
import type { MonthAccess } from '../month/monthAccess.ts';
import type { MonthDoc, MonthSummary, Won } from '../../types/bill.ts';

interface CostEntryScreenProps {
  db: Firestore;
  uid: string;
  month: MonthDoc;
  summary: MonthSummary;
  access: MonthAccess;
  onBack: () => void;
}

export function CostEntryScreen({ db, uid, month, summary, access, onBack }: CostEntryScreenProps) {
  const drafts = useDraftEntries(month.yearMonth, uid, isCostDraftKey);
  const [showRestore, setShowRestore] = useState(drafts.pending.length > 0);

  /** 남아 있던 입력 다시 저장 (D-2, G3) — 그사이 지워진 항목의 입력은 버린다 */
  const restoreDraft = async () => {
    setShowRestore(false);
    for (const key of drafts.pending) {
      const text = drafts.entries[key];
      const target = resolveCostDraftKey(key, month.secondaryCategories);
      if (text === undefined || target === null) {
        drafts.clear(key);
        continue;
      }
      if (target.kind === 'waterTotalUsage') {
        const usage = parseUsageInput(text);
        if (usage === null) continue;
        await drafts.commit(key, saveWaterTotalUsage(db, month.yearMonth, usage, uid));
        continue;
      }
      if (target.kind === 'primary' || target.kind === 'itemAmount') {
        const amount = parseAmountInput(text) ?? 0;
        if (!isValidAmount(amount)) continue;
        await drafts.commit(
          key,
          target.kind === 'primary'
            ? savePrimaryCost(db, month.yearMonth, target.key, amount, uid)
            : updateSecondary(
                db,
                month.yearMonth,
                (latest) =>
                  latest.map((category) =>
                    category.id === target.categoryId
                      ? { ...category, items: category.items.map((item) => (item.id === target.itemId ? { ...item, amount } : item)) }
                      : category,
                  ),
                uid,
              ),
        );
        continue;
      }
      const name = text.trim();
      if (name === '') continue;
      await drafts.commit(
        key,
        updateSecondary(
          db,
          month.yearMonth,
          (latest) =>
            latest.map((category) => {
              if (category.id !== target.categoryId) return category;
              if (target.kind === 'categoryName') return { ...category, name };
              return { ...category, items: category.items.map((item) => (item.id === target.itemId ? { ...item, name } : item)) };
            }),
          uid,
        ),
      );
    }
  };

  const discardDraft = () => {
    drafts.pending.forEach(drafts.clear);
    setShowRestore(false);
  };

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

        {showRestore && (
          <div role="alert" className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-amber-600 bg-amber-50 px-4 py-3 text-lg">
            <span className="font-semibold">저장하지 못한 입력 {drafts.pending.length}개가 남아 있습니다.</span>
            <BigButton onClick={() => void restoreDraft()} disabled={!access.canEdit}>
              다시 저장
            </BigButton>
            <BigButton variant="secondary" onClick={discardDraft}>
              버리기
            </BigButton>
          </div>
        )}

        <section aria-labelledby="totals" className="grid grid-cols-2 gap-4 rounded-2xl border-2 border-blue-800 bg-blue-50 p-6 text-xl md:grid-cols-4">
          <h2 id="totals" className="sr-only">
            합계
          </h2>
          <Stat label="공용 비용 합계" value={formatWon(summary.primaryTotal)} />
          <Stat label="유지비 지출 합계 (나누지 않음)" value={formatWon(summary.secondaryTotal)} />
          <Stat label="나누는 세대 (오리집 2세대, 관리실 제외)" value={`${summary.targetCount}세대`} />
          <Stat label="세대당 금액 (인건비·전기·유지비 ÷ 세대)" value={formatWon(summary.perUnitShare)} />
        </section>

        <section aria-labelledby="primary" className="rounded-2xl border-2 border-slate-300 bg-white p-6">
          <SectionTitle id="primary" title="공용 비용" total={summary.primaryTotal} />
          <div className="grid gap-5 md:grid-cols-2">
            {PRIMARY_FEE_ITEMS.map(({ key, label }) => {
              const moneyProps = {
                value: month.primaryCosts[key],
                disabled: !access.canEdit,
                draft: drafts.entries[costDraftKey.primary(key)],
                onDraft: (text: string) => drafts.set(costDraftKey.primary(key), text),
                onCommit: (amount: Won) => drafts.commit(costDraftKey.primary(key), savePrimaryCost(db, month.yearMonth, key, amount, uid)),
              };
              if (key === WATER_RATE_KEY) {
                // 수도 단가 — [금액] 원 / [총 사용량] 리터. 금액은 세대로 나누지 않고 단가 계산에만 쓴다 (F-17)
                const rate = waterRate(month);
                return (
                  <fieldset key={key} className="flex flex-col gap-1 md:col-span-2">
                    <legend className="text-lg font-semibold text-slate-900">{label}</legend>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-[12rem] flex-1">
                        <MoneyInput id={`primary-${key}`} label={`${label} 금액`} labelHidden {...moneyProps} />
                      </div>
                      <span className="pt-2 text-2xl font-bold text-slate-700" aria-hidden="true">
                        /
                      </span>
                      <div className="min-w-[12rem] flex-1">
                        <UsageInput
                          id="water-total-usage"
                          label={`${label} 총 사용량`}
                          labelHidden
                          value={month.waterTotalUsage}
                          disabled={!access.canEdit}
                          draft={drafts.entries[costDraftKey.waterTotalUsage]}
                          onDraft={(text) => drafts.set(costDraftKey.waterTotalUsage, text)}
                          onCommit={(usage) => drafts.commit(costDraftKey.waterTotalUsage, saveWaterTotalUsage(db, month.yearMonth, usage, uid))}
                        />
                      </div>
                    </div>
                    <p className="text-lg text-slate-700">
                      {rate ? (
                        <>
                          수도 단가 <strong className="tabular-nums text-slate-900">리터당 {formatWon(rate.perLiter)}</strong>
                          <span className="text-slate-600"> (계산 {formatRawWaterRate(rate.amount, rate.totalUsage)}, 1원 자리 올림)</span> · 세대별 수도 요금 = 사용량 × 단가
                        </>
                      ) : (
                        '금액과 총 사용량을 넣으면 리터당 단가가 계산됩니다.'
                      )}
                    </p>
                  </fieldset>
                );
              }
              return (
                <MoneyInput
                  key={key}
                  id={`primary-${key}`}
                  label={label}
                  hint={
                    <>
                      세대당 <strong className="tabular-nums">{formatWon(perShare(month.primaryCosts[key], summary.targetCount))}</strong>
                    </>
                  }
                  {...moneyProps}
                />
              );
            })}
          </div>
        </section>

        <section aria-labelledby="secondary">
          <SectionTitle id="secondary" title="유지비 지출 내역" total={summary.secondaryTotal} note="세대당 금액 계산에는 넣지 않습니다." />
          <SecondaryEditor db={db} uid={uid} yearMonth={month.yearMonth} categories={month.secondaryCategories} canEdit={access.canEdit} drafts={drafts} />
        </section>
      </main>
    </div>
  );
}

/** 구역 제목과 그 바로 아래 합계 */
function SectionTitle({ id, title, total, note }: { id: string; title: string; total: Won; note?: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      <p className="mt-1 text-xl text-slate-800">
        합계 <strong className="tabular-nums">{formatWon(total)}</strong>
        {note && <span className="ml-3 text-lg text-slate-600">{note}</span>}
      </p>
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
