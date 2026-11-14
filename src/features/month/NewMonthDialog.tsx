import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { formatYearMonth } from '../../domain/format.ts';
import { createMonthDoc } from '../../domain/monthFactory.ts';
import { createMonth } from '../../services/firestore/monthRepo.ts';
import type { MonthDoc, YearMonth } from '../../types/bill.ts';

interface NewMonthDialogProps {
  db: Firestore;
  uid: string;
  yearMonth: YearMonth;
  /** 지난달 문서. 첫 달이면 null */
  previous: MonthDoc | null;
  onDone: (ym: YearMonth) => void;
  onCancel: () => void;
}

/** 새 달 시작 — 수도 복사 여부 선택 (D-4, D-7), 관리자 전용 */
export function NewMonthDialog({ db, uid, yearMonth, previous, onDone, onCancel }: NewMonthDialogProps) {
  const [copyWater, setCopyWater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    const month = createMonthDoc(yearMonth, previous, { copyWater }, new Date().toISOString(), uid);
    const result = await createMonth(db, month);
    setBusy(false);
    if (result.ok) onDone(yearMonth);
    else setError(result.message);
  };

  return (
    <ConfirmDialog title={`${formatYearMonth(yearMonth)} 시작`} confirmLabel="시작하기" busy={busy} onConfirm={() => void handleConfirm()} onCancel={onCancel}>
      {previous ? (
        <>
          <p>지난달의 공실 체크와 추가 공통 비용 항목(금액 포함), 안내문을 그대로 이어받습니다. 기본 공통 비용은 0원으로 시작합니다.</p>
          <label className="flex items-center gap-3 rounded-lg border-2 border-slate-400 p-3 text-xl font-semibold">
            <input type="checkbox" className="h-7 w-7" checked={copyWater} onChange={(event) => setCopyWater(event.target.checked)} />
            지난달 수도 사용량·요금도 복사하기
          </label>
        </>
      ) : (
        <p>첫 달입니다. 추가 공통 비용 항목은 기본 목록으로 시작합니다.</p>
      )}
      {error && (
        <p role="alert" className="font-semibold text-red-700">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
