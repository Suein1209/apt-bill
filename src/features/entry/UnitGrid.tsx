/**
 * 동별 입력 Grid — 공실·수도·직접 수정·납부 (Design §5.1, §5.4 동별 Grid)
 * Plan SC: SC-1(키보드만으로 한 달 입력), SC-6(새로고침해도 임시저장으로 복구)
 */
import { useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import {
  INVALID_AMOUNT_MESSAGE,
  INVALID_DATE_MESSAGE,
  INVALID_USAGE_MESSAGE,
  SAVE_FAILED_PREFIX,
} from '../../constants/messages.ts';
import { formatNumber, formatWon, formatYearMonth, isISODate, parseAmountInput, parseUsageInput, todayISODate } from '../../domain/format.ts';
import { isValidAmount } from '../../domain/money.ts';
import { unitLabel } from '../../domain/unitLabel.ts';
import { createDraftStore, type DraftEntries } from '../../services/draft.ts';
import { saveUnitField } from '../../services/firestore/monthRepo.ts';
import { savePayment, setPaymentConfirmed } from '../../services/firestore/paymentRepo.ts';
import { GridInput } from './GridInput.tsx';
import { useGridKeyboard } from './useGridKeyboard.ts';
import type { Payments } from '../../domain/billing.ts';
import type { Result } from '../../services/result.ts';
import type { MonthAccess } from '../month/monthAccess.ts';
import type { MonthDoc, Unit, UnitBill, UserRole, Won } from '../../types/bill.ts';

/** 키보드로 이동하는 칸의 열 번호 */
const COL = { vacant: 0, usage: 1, water: 2, base: 3, paid: 4, fill: 5, paidDate: 6, confirm: 7 } as const;
const COL_COUNT = 8;

type DraftField = 'usage' | 'water' | 'base' | 'paid' | 'paidDate';

const cellKey = (unitId: string, field: DraftField) => `${unitId}|${field}`;

interface UnitGridProps {
  db: Firestore;
  uid: string;
  role: UserRole;
  dong: number;
  month: MonthDoc;
  units: readonly Unit[];
  bills: readonly UnitBill[];
  payments: Payments;
  access: MonthAccess;
  onBack: () => void;
}

export function UnitGrid({ db, uid, role, dong, month, units, bills, payments, access, onBack }: UnitGridProps) {
  const ym = month.yearMonth;
  const draftStore = useMemo(() => createDraftStore(ym, uid), [ym, uid]);
  const unitIds = useMemo(() => new Set(units.map((unit) => unit.id)), [units]);
  const [draft, setDraft] = useState<DraftEntries>(() => draftStore.read());
  const [restored] = useState(() => Object.keys(draftStore.read()).filter((key) => unitIds.has(key.split('|')[0] ?? '')));
  const [showRestore, setShowRestore] = useState(restored.length > 0);
  const [saving, setSaving] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const { register, onKeyDown } = useGridKeyboard(units.length, COL_COUNT);
  const billById = useMemo(() => new Map(bills.map((bill) => [bill.unitId, bill])), [bills]);
  const isAdmin = role === 'admin';

  /** 저장 실행 + 저장 상태 표시 */
  const track = async (task: Promise<Result<void>>): Promise<string | null> => {
    setSaving((count) => count + 1);
    const result = await task;
    setSaving((count) => count - 1);
    const message = result.ok ? null : `${SAVE_FAILED_PREFIX}: ${result.message}`;
    setLastError(message);
    return message;
  };

  const writeDraft = (key: string, text: string) => {
    draftStore.set(key, text);
    setDraft((current) => ({ ...current, [key]: text }));
  };
  const clearDraft = (key: string) => {
    draftStore.remove(key);
    setDraft((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const parseWonText = (text: string): Won | null => {
    const amount = parseAmountInput(text) ?? 0;
    return isValidAmount(amount) ? amount : null;
  };

  /** 칸 하나를 저장 — 임시저장 복구에도 같은 함수를 쓴다 */
  const commitCell = async (unitId: string, field: DraftField, text: string): Promise<string | null> => {
    const water = month.water[unitId] ?? { usage: 0, amount: 0 };
    const payment = payments[unitId];
    let message: string | null;

    switch (field) {
      case 'usage': {
        const usage = parseUsageInput(text);
        if (usage === null) return INVALID_USAGE_MESSAGE;
        message = await track(saveUnitField(db, ym, 'water', unitId, { ...water, usage }, uid));
        break;
      }
      case 'water': {
        const amount = parseWonText(text);
        if (amount === null) return INVALID_AMOUNT_MESSAGE;
        message = await track(saveUnitField(db, ym, 'water', unitId, { ...water, amount }, uid));
        break;
      }
      case 'base': {
        // 비우면 직접 수정을 지우고 자동값으로 (C-17)
        if (text.trim() === '') {
          message = await track(saveUnitField(db, ym, 'overrides', unitId, null, uid));
          break;
        }
        const amount = parseWonText(text);
        if (amount === null) return INVALID_AMOUNT_MESSAGE;
        message = await track(saveUnitField(db, ym, 'overrides', unitId, amount, uid));
        break;
      }
      case 'paid': {
        const paidAmount = parseWonText(text);
        if (paidAmount === null) return INVALID_AMOUNT_MESSAGE;
        const paidDate = payment?.paidDate ?? (paidAmount > 0 ? todayISODate() : null);
        message = await track(savePayment(db, ym, unitId, { paidAmount, paidDate }, uid, payment === undefined));
        break;
      }
      case 'paidDate': {
        const trimmed = text.trim();
        if (trimmed !== '' && !isISODate(trimmed)) return INVALID_DATE_MESSAGE;
        message = await track(
          savePayment(db, ym, unitId, { paidAmount: payment?.paidAmount ?? 0, paidDate: trimmed === '' ? null : trimmed }, uid, payment === undefined),
        );
        break;
      }
    }
    if (!message) clearDraft(cellKey(unitId, field));
    return message;
  };

  const restoreDraft = async () => {
    setShowRestore(false);
    for (const key of restored) {
      const [unitId, field] = key.split('|');
      const text = draft[key];
      if (unitId && field && text !== undefined) await commitCell(unitId, field as DraftField, text);
    }
  };

  const discardDraft = () => {
    restored.forEach(clearDraft);
    setShowRestore(false);
  };

  const saveStatus = saving > 0 ? '저장 중…' : lastError ? lastError : '저장됨';

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex flex-wrap items-center gap-4 border-b-2 border-slate-300 bg-white px-6 py-4">
        <BigButton variant="secondary" icon={<ArrowLeft className="h-6 w-6" aria-hidden="true" />} onClick={onBack}>
          홈으로
        </BigButton>
        <h1 className="text-3xl font-bold">
          {formatYearMonth(ym)} · {dong}동
        </h1>
        <span role="status" className={`ml-auto rounded-lg px-3 py-1 text-lg font-bold ${lastError ? 'bg-red-100 text-red-800' : saving ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900'}`}>
          {saveStatus}
        </span>
      </header>

      <main className="space-y-4 px-6 py-6">
        {access.reason && (
          <p className="rounded-lg border-2 border-amber-700 bg-amber-50 px-4 py-3 text-lg font-semibold text-amber-900">{access.reason}</p>
        )}
        {showRestore && (
          <div role="alert" className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-amber-600 bg-amber-50 px-4 py-3 text-lg">
            <span className="font-semibold">저장하지 못한 입력 {restored.length}개가 남아 있습니다.</span>
            <BigButton onClick={() => void restoreDraft()} disabled={!access.canEdit}>
              다시 저장
            </BigButton>
            <BigButton variant="secondary" onClick={discardDraft}>
              버리기
            </BigButton>
          </div>
        )}
        <p className="text-lg text-slate-700">↑↓ 위아래 · ←→ 옆 칸 · Enter 아래 칸 · 스페이스 체크</p>

        <div className="overflow-x-auto rounded-xl border-2 border-slate-300 bg-white">
          <table className="w-full min-w-[1100px] border-collapse text-lg">
            <thead className="sticky top-0 bg-slate-200 text-left">
              <tr>
                {['세대', '공실', '수도 사용량', '수도 요금', '이번 달 관리비', '이월 미납', '청구액', '납부 금액', '', '납부일', '납부 완료'].map((title, index) => (
                  <th key={index} scope="col" className="whitespace-nowrap border-b-2 border-slate-400 px-2 py-2 font-bold">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((unit, row) => {
                const bill = billById.get(unit.id);
                if (!bill) return null;
                const payment = payments[unit.id];
                const water = month.water[unit.id];
                const isOffice = unit.kind === 'office';
                const lockedForManager = !isAdmin && bill.isConfirmed;
                const canPay = access.canEdit && (bill.isTarget || bill.charged > 0) && !lockedForManager;
                const canWater = access.canEdit && bill.isTarget && unit.kind === 'residential';
                const autoBase = bill.primaryShare + bill.secondaryShare + bill.water;
                const nav = (col: number) => (event: Parameters<typeof onKeyDown>[0]) => onKeyDown(event, row, col);
                const draftOf = (field: DraftField) => draft[cellKey(unit.id, field)];
                const draftHandler = (field: DraftField) => (text: string) => writeDraft(cellKey(unit.id, field), text);
                const commitHandler = (field: DraftField) => (text: string) => commitCell(unit.id, field, text);

                return (
                  <tr key={unit.id} className={`border-b border-slate-200 ${bill.isTarget ? '' : 'bg-slate-100 text-slate-600'}`}>
                    <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-bold">
                      {unitLabel(unit)}
                    </th>
                    <td className="px-2 text-center">
                      <input
                        ref={register(row, COL.vacant)}
                        type="checkbox"
                        aria-label={`${unitLabel(unit)} 공실`}
                        className="h-7 w-7"
                        checked={month.vacant[unit.id] === true}
                        disabled={!access.canEdit || isOffice}
                        onKeyDown={nav(COL.vacant)}
                        onChange={(event) => void track(saveUnitField(db, ym, 'vacant', unit.id, event.target.checked ? true : null, uid))}
                      />
                    </td>
                    <td className="w-24 px-1">
                      <GridInput
                        label={`${unitLabel(unit)} 수도 사용량`}
                        value={water ? String(water.usage) : ''}
                        draft={draftOf('usage')}
                        disabled={!canWater}
                        inputRef={register(row, COL.usage)}
                        onNavigate={nav(COL.usage)}
                        onDraft={draftHandler('usage')}
                        onCommit={commitHandler('usage')}
                      />
                    </td>
                    <td className="w-32 px-1">
                      <GridInput
                        label={`${unitLabel(unit)} 수도 요금`}
                        value={water ? formatNumber(water.amount) : ''}
                        draft={draftOf('water')}
                        disabled={!canWater}
                        inputRef={register(row, COL.water)}
                        onNavigate={nav(COL.water)}
                        onDraft={draftHandler('water')}
                        onCommit={commitHandler('water')}
                      />
                    </td>
                    <td className="w-40 px-1">
                      <div className="flex items-center gap-1">
                        <GridInput
                          label={`${unitLabel(unit)} 이번 달 관리비`}
                          value={bill.isTarget ? formatNumber(bill.override ?? autoBase) : ''}
                          draft={draftOf('base')}
                          disabled={!access.canEdit || !bill.isTarget}
                          highlighted={bill.override !== null}
                          inputRef={register(row, COL.base)}
                          onNavigate={nav(COL.base)}
                          onDraft={draftHandler('base')}
                          onCommit={commitHandler('base')}
                        />
                        {bill.override !== null && access.canEdit && (
                          <button
                            type="button"
                            title="자동값으로 되돌리기"
                            aria-label={`${unitLabel(unit)} 자동값으로 되돌리기`}
                            onClick={() => void track(saveUnitField(db, ym, 'overrides', unit.id, null, uid))}
                            className="rounded-md border-2 border-purple-600 p-1 text-purple-700 hover:bg-purple-50 focus:outline-none focus:ring-4 focus:ring-purple-200"
                          >
                            <RotateCcw className="h-5 w-5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {bill.override !== null && <span className="text-sm font-semibold text-purple-700">✎ 직접 수정됨</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 text-right tabular-nums">{bill.carryOver === 0 ? '' : formatNumber(bill.carryOver)}</td>
                    <td className="whitespace-nowrap px-2 text-right font-bold tabular-nums">{formatWon(bill.charged)}</td>
                    <td className="w-36 px-1">
                      <GridInput
                        label={`${unitLabel(unit)} 납부 금액`}
                        value={payment ? formatNumber(payment.paidAmount) : ''}
                        draft={draftOf('paid')}
                        disabled={!canPay}
                        inputRef={register(row, COL.paid)}
                        onNavigate={nav(COL.paid)}
                        onDraft={draftHandler('paid')}
                        onCommit={commitHandler('paid')}
                      />
                    </td>
                    <td className="px-1">
                      <button
                        ref={register(row, COL.fill)}
                        type="button"
                        disabled={!canPay || bill.charged <= 0}
                        onKeyDown={nav(COL.fill)}
                        onClick={() =>
                          void track(
                            savePayment(db, ym, unit.id, { paidAmount: bill.charged, paidDate: payment?.paidDate ?? todayISODate() }, uid, payment === undefined),
                          )
                        }
                        className="whitespace-nowrap rounded-md border-2 border-blue-800 px-3 py-1 font-bold text-blue-900 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:border-slate-300 disabled:text-slate-400"
                      >
                        채우기
                      </button>
                    </td>
                    <td className="min-w-[10rem] px-1">
                      <GridInput
                        label={`${unitLabel(unit)} 납부일`}
                        value={payment?.paidDate ?? ''}
                        draft={draftOf('paidDate')}
                        disabled={!canPay}
                        align="left"
                        inputRef={register(row, COL.paidDate)}
                        onNavigate={nav(COL.paidDate)}
                        onDraft={draftHandler('paidDate')}
                        onCommit={commitHandler('paidDate')}
                      />
                    </td>
                    <td className="px-2 text-center">
                      <input
                        ref={register(row, COL.confirm)}
                        type="checkbox"
                        aria-label={`${unitLabel(unit)} 납부 완료`}
                        className="h-7 w-7 accent-green-700"
                        checked={bill.isConfirmed}
                        disabled={!isAdmin || !access.canEdit || (!bill.isTarget && bill.charged <= 0)}
                        onKeyDown={nav(COL.confirm)}
                        onChange={(event) => void track(setPaymentConfirmed(db, ym, unit.id, event.target.checked, uid, payment === undefined))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
