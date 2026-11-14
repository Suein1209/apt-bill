import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { Lock, LockOpen } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { closingUnpaid } from '../../domain/billing.ts';
import { formatWon, formatYearMonth } from '../../domain/format.ts';
import { sum } from '../../domain/money.ts';
import { closeMonth, reopenMonth } from '../../services/firestore/monthRepo.ts';
import type { MonthDoc, UnitBill } from '../../types/bill.ts';

interface CloseMonthButtonProps {
  db: Firestore;
  uid: string;
  month: MonthDoc;
  bills: readonly UnitBill[];
}

/** 결산 완료·결산 취소 — 관리자 전용 (D-6, D-8, U-13) */
export function CloseMonthButton({ db, uid, month, bills }: CloseMonthButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = month.status === 'closed';
  const unpaid = closingUnpaid(bills);
  const unpaidUnits = Object.values(unpaid).filter((amount) => amount > 0);

  const handleConfirm = async () => {
    setBusy(true);
    const result = closed ? await reopenMonth(db, month.yearMonth, uid) : await closeMonth(db, month.yearMonth, unpaid, uid);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      setError(null);
    } else {
      setError(result.message);
    }
  };

  return (
    <>
      <BigButton variant={closed ? 'secondary' : 'danger'} icon={closed ? <LockOpen className="h-6 w-6" aria-hidden="true" /> : <Lock className="h-6 w-6" aria-hidden="true" />} onClick={() => setOpen(true)}>
        {closed ? '결산 취소' : '결산 완료'}
      </BigButton>
      {open && (
        <ConfirmDialog
          title={`${formatYearMonth(month.yearMonth)} ${closed ? '결산을 취소할까요?' : '결산할까요?'}`}
          confirmLabel={closed ? '결산 취소' : '결산 완료'}
          danger={!closed}
          busy={busy}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setOpen(false)}
        >
          {closed ? (
            <p>결산을 취소하면 이 달을 다시 수정할 수 있고, 다음 달 이월 미납액도 다시 계산됩니다.</p>
          ) : (
            <>
              <p>결산하면 이 달은 누구도 수정할 수 없습니다.</p>
              <p>
                미납 <strong>{unpaidUnits.length}곳</strong>, 합계 <strong>{formatWon(sum(unpaidUnits))}</strong>이 다음 달로 이월됩니다.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="font-semibold text-red-700">
              {error}
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
