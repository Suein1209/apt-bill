import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { formatYearMonth } from '../../domain/format.ts';
import { closingUnpaid } from '../../domain/billing.ts';
import { createMonthDoc } from '../../domain/monthFactory.ts';
import { createMonth, type PreviousClosing } from '../../services/firestore/monthRepo.ts';
import type { MonthDoc, UnitBill, YearMonth } from '../../types/bill.ts';

interface NewMonthDialogProps {
  db: Firestore;
  uid: string;
  yearMonth: YearMonth;
  /** 지난달 문서. 첫 달이면 null */
  previous: MonthDoc | null;
  /** 지난달 세대별 청구 — 지난달이 결산 전이면 이 미납액으로 함께 결산한다. 모르면 null(결산하지 않음) */
  previousBills: readonly UnitBill[] | null;
  onDone: (ym: YearMonth) => void;
  onCancel: () => void;
}

/** 새 달 시작 — 수도 복사 여부 선택 (D-4, D-7), 관리자 전용 */
export function NewMonthDialog({ db, uid, yearMonth, previous, previousBills, onDone, onCancel }: NewMonthDialogProps) {
  const [copyWater, setCopyWater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    const month = createMonthDoc(yearMonth, previous, { copyWater }, new Date().toISOString(), uid);
    const closing: PreviousClosing | null =
      previous?.status === 'open' && previousBills ? { yearMonth: previous.yearMonth, unpaid: closingUnpaid(previousBills) } : null;
    const result = await createMonth(db, month, uid, closing);
    setBusy(false);
    if (result.ok) onDone(yearMonth);
    else setError(result.message);
  };

  return (
    <ConfirmDialog title={`${formatYearMonth(yearMonth)} 시작`} confirmLabel="시작하기" busy={busy} onConfirm={() => void handleConfirm()} onCancel={onCancel}>
      {previous ? (
        <>
          <p>지난달의 공실 체크, 공용 비용(수도량 제외)과 유지비 지출 내역(금액 포함), 안내문을 그대로 이어받습니다. 바뀐 금액만 고치면 됩니다.</p>
          {previous.status === 'open' && previousBills && (
            <p className="font-semibold text-red-700">{formatYearMonth(previous.yearMonth)}은 지금 미납액으로 함께 결산 완료됩니다.</p>
          )}
          <label className="flex items-center gap-3 rounded-xl bg-slate-100 p-4 text-xl font-semibold">
            <input type="checkbox" className="h-7 w-7 shrink-0 accent-brand" checked={copyWater} onChange={(event) => setCopyWater(event.target.checked)} />
            지난달 수도도 복사하기 (수도량 금액·총 리터, 세대별 사용량)
          </label>
        </>
      ) : (
        <p>첫 달입니다. 유지비 지출 내역 항목은 기본 목록으로 시작합니다.</p>
      )}
      {error && (
        <p role="alert" className="font-semibold text-red-700">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
