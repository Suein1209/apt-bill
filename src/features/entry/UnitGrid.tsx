/**
 * 동별 입력 Grid — 공실·수도·납부 (Design §5.1, §5.4 동별 Grid)
 * 이번 달 관리비·납부일은 보기 전용, 납부 확인된 세대는 수도도 잠근다 (G-17 ~ G-19)
 * Plan SC: SC-1(키보드만으로 한 달 입력), SC-6(새로고침해도 임시저장으로 복구)
 */
import { useMemo, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import {
  CONFIRMED_LOCKED_MESSAGE,
  INVALID_AMOUNT_MESSAGE,
  INVALID_USAGE_MESSAGE,
  SAVE_FAILED_PREFIX,
  paidOverChargedMessage,
} from '../../constants/messages.ts';
import { formatNumber, formatWon, formatYearMonth, parseAmountInput, parseUsageInput, todayISODate } from '../../domain/format.ts';
import { isValidAmount } from '../../domain/money.ts';
import { canToggleConfirmed, exceedsCharged, isFullyPaid, paidDateFor } from '../../domain/payment.ts';
import { unitLabel } from '../../domain/unitLabel.ts';
import { useDraftEntries } from '../../hooks/useDraftEntries.ts';
import { saveUnitField, saveWaterField } from '../../services/firestore/monthRepo.ts';
import { savePayment, setPaymentConfirmed } from '../../services/firestore/paymentRepo.ts';
import { GridInput } from './GridInput.tsx';
import { useGridKeyboard } from './useGridKeyboard.ts';
import type { Payments } from '../../domain/billing.ts';
import type { Result } from '../../services/result.ts';
import type { MonthAccess } from '../month/monthAccess.ts';
import type { MonthDoc, Unit, UnitBill, UserRole, Won } from '../../types/bill.ts';

/** 키보드로 이동하는 칸의 열 번호 */
const COL = { vacant: 0, usage: 1, water: 2, paid: 3, fill: 4, confirm: 5 } as const;
const COL_COUNT = 6;

/** 입력할 수 있는 칸 — 이번 달 관리비·납부일은 보기 전용 (G-17, G-19) */
type DraftField = 'usage' | 'water' | 'paid';

/** 복구 순서 */
const DRAFT_FIELDS: readonly DraftField[] = ['usage', 'water', 'paid'];

const cellKey = (unitId: string, field: DraftField) => `${unitId}|${field}`;

function parseCellKey(key: string): { unitId: string; field: DraftField } | null {
  const [unitId, field] = key.split('|');
  const known = DRAFT_FIELDS.find((item) => item === field);
  return unitId && known ? { unitId, field: known } : null;
}

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
  const unitIds = useMemo(() => new Set(units.map((unit) => unit.id)), [units]);
  const drafts = useDraftEntries(ym, uid, (key) => unitIds.has(parseCellKey(key)?.unitId ?? ''));
  const draft = drafts.entries;
  const [saving, setSaving] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const { register, onKeyDown } = useGridKeyboard(units.length, COL_COUNT);
  const billById = useMemo(() => new Map(bills.map((bill) => [bill.unitId, bill])), [bills]);
  const isAdmin = role === 'admin';
  /** 세대별로 진행 중인 납부 금액 저장 — "채우기"가 그 뒤에 저장되도록 기다린다 */
  const pendingPaid = useRef(new Map<string, Promise<string | null>>());

  /** 저장 실행 + 저장 상태 표시 — 결과를 그대로 돌려준다 */
  const track = async (task: Promise<Result<void>>): Promise<Result<void>> => {
    setSaving((count) => count + 1);
    const result = await task;
    setSaving((count) => count - 1);
    setLastError(result.ok ? null : `${SAVE_FAILED_PREFIX}: ${result.message}`);
    return result;
  };

  const parseWonText = (text: string): Won | null => {
    const amount = parseAmountInput(text) ?? 0;
    return isValidAmount(amount) ? amount : null;
  };

  /**
   * 칸 하나를 저장 — 임시저장 복구에도 같은 함수를 쓴다.
   * 그 칸의 필드만 저장해 같은 세대의 다른 칸을 옛값으로 덮지 않는다 (G1).
   * 성공·권한 오류면 임시저장을 지우고, 그 밖의 실패는 남겨 둔다 (G4, Design §6.1).
   */
  const commitCell = async (unitId: string, field: DraftField, text: string): Promise<string | null> => {
    const key = cellKey(unitId, field);
    const payment = payments[unitId];
    const bill = billById.get(unitId);
    const charged = bill?.charged ?? 0;
    // 납부 확인된 세대는 수도를 고칠 수 없다 (G-18) — 임시저장 복구로 들어와도 막는다
    if ((field === 'usage' || field === 'water') && bill?.isConfirmed) {
      drafts.clear(key);
      return CONFIRMED_LOCKED_MESSAGE;
    }

    switch (field) {
      case 'usage': {
        const usage = parseUsageInput(text);
        if (usage === null) return INVALID_USAGE_MESSAGE;
        return drafts.commit(key, track(saveWaterField(db, ym, unitId, 'usage', usage, uid)));
      }
      case 'water': {
        const amount = parseWonText(text);
        if (amount === null) return INVALID_AMOUNT_MESSAGE;
        return drafts.commit(key, track(saveWaterField(db, ym, unitId, 'amount', amount, uid)));
      }
      case 'paid': {
        const paidAmount = parseWonText(text);
        if (paidAmount === null) return INVALID_AMOUNT_MESSAGE;
        if (exceedsCharged(paidAmount, charged)) return paidOverChargedMessage(formatWon(charged));
        // 다 내면 납부일을 넣고(기존 날짜 우선), 덜 내면 납부일을 지운다 (G-14)
        const paidDate = paidDateFor(paidAmount, charged, payment?.paidDate ?? null, todayISODate());
        const saving = drafts.commit(key, track(savePayment(db, ym, unitId, { paidAmount, paidDate }, uid)));
        pendingPaid.current.set(unitId, saving);
        return saving;
      }
    }
  };

  /**
   * "채우기" — 입력 중이던 납부 금액(초과·부족·오류 포함)을 버리고 청구액 전액으로 저장한다 (G-12).
   * 칸을 떠나며 시작된 저장이 있으면 끝난 뒤에 저장해 청구액이 마지막 값이 되게 한다.
   */
  const fillCharged = async (unitId: string, charged: Won, currentDate: string | null) => {
    await pendingPaid.current.get(unitId);
    drafts.clear(cellKey(unitId, 'paid'));
    await track(savePayment(db, ym, unitId, { paidAmount: charged, paidDate: currentDate ?? todayISODate() }, uid));
  };

  const [showRestore, setShowRestore] = useState(drafts.pending.length > 0);

  const restoreDraft = async () => {
    setShowRestore(false);
    const targets = drafts.pending
      .map((key) => ({ key, cell: parseCellKey(key) }))
      .filter((item): item is { key: string; cell: { unitId: string; field: DraftField } } => item.cell !== null)
      .sort((a, b) => DRAFT_FIELDS.indexOf(a.cell.field) - DRAFT_FIELDS.indexOf(b.cell.field));
    for (const { key, cell } of targets) {
      const text = draft[key];
      if (text !== undefined) await commitCell(cell.unitId, cell.field, text);
    }
  };

  const discardDraft = () => {
    drafts.pending.forEach(drafts.clear);
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
            <span className="font-semibold">저장하지 못한 입력 {drafts.pending.length}개가 남아 있습니다.</span>
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
                {['세대', '공실', '수도 사용량', '수도 요금', '이번 달 관리비', '이월 미납', '청구액', '납부 금액', '', '납부일', '납부 확인'].map((title, index) => (
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
                const fullyPaid = isFullyPaid(bill);
                // 납부 완료 가능 표시는 관리자에게만 (관리소장은 납부 완료를 누를 수 없다)
                const showConfirmReady = isAdmin && fullyPaid;
                const canWater = access.canEdit && bill.isTarget && unit.kind === 'residential' && !bill.isConfirmed;
                const autoBase = bill.primaryShare + bill.secondaryShare + bill.water;
                const nav = (col: number) => (event: Parameters<typeof onKeyDown>[0]) => onKeyDown(event, row, col);
                const draftOf = (field: DraftField) => draft[cellKey(unit.id, field)];
                const draftHandler = (field: DraftField) => (text: string) => drafts.set(cellKey(unit.id, field), text);
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
                        value={water?.usage == null ? '' : String(water.usage)}
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
                        value={water?.amount == null ? '' : formatNumber(water.amount)}
                        draft={draftOf('water')}
                        disabled={!canWater}
                        inputRef={register(row, COL.water)}
                        onNavigate={nav(COL.water)}
                        onDraft={draftHandler('water')}
                        onCommit={commitHandler('water')}
                      />
                    </td>
                    {/* 이번 달 관리비 — 보기 전용 (G-17) */}
                    <td className="whitespace-nowrap px-2 text-right tabular-nums">
                      {bill.isTarget ? formatNumber(bill.override ?? autoBase) : ''}
                      {bill.override !== null && <span className="block text-sm font-semibold text-purple-700">✎ 직접 수정됨</span>}
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
                        onClick={() => void fillCharged(unit.id, bill.charged, payment?.paidDate ?? null)}
                        className="whitespace-nowrap rounded-md border-2 border-blue-800 px-3 py-1 font-bold text-blue-900 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:border-slate-300 disabled:text-slate-400"
                      >
                        채우기
                      </button>
                    </td>
                    {/* 납부일 — 보기 전용, 다 내면 자동으로 들어간다 (G-19) */}
                    <td className="min-w-[8rem] whitespace-nowrap px-2 tabular-nums">{payment?.paidDate ?? ''}</td>
                    <td className="px-2 text-center">
                      {/* 다 낸 세대는 녹색 테두리 — 관리자가 납부 완료를 누를 수 있다는 표시, 관리자 화면에만 (G-15) */}
                      <div
                        title={showConfirmReady ? '청구액을 모두 냈습니다 — 납부 확인을 할 수 있습니다' : undefined}
                        className={`inline-flex rounded-lg border-4 p-1 ${showConfirmReady ? 'border-green-600 bg-green-50' : 'border-transparent'}`}
                      >
                        <input
                          ref={register(row, COL.confirm)}
                          type="checkbox"
                          aria-label={`${unitLabel(unit)} 납부 확인`}
                          className="h-7 w-7 accent-green-700"
                          checked={bill.isConfirmed}
                          disabled={!isAdmin || !access.canEdit || !canToggleConfirmed(bill)}
                          onKeyDown={nav(COL.confirm)}
                          onChange={(event) => void track(setPaymentConfirmed(db, ym, unit.id, event.target.checked, uid))}
                        />
                      </div>
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
