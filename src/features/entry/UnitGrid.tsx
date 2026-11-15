/**
 * 동별 입력 Grid — 공실·수도·납부 (Design §5.1, §5.4 동별 Grid)
 * 이번 달 관리비·납부일은 보기 전용, 납부 확인된 세대는 수도도 잠근다 (G-17 ~ G-19)
 * 납부는 미납·완납 토글, 공실은 관리자만, 납부 확인된 세대는 공실·납부 상태도 잠근다 (G-20 ~ G-22)
 * Plan SC: SC-1(키보드만으로 한 달 입력), SC-6(새로고침해도 임시저장으로 복구)
 */
import { useMemo, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import {
  CONFIRMED_LOCKED_MESSAGE,
  INVALID_USAGE_MESSAGE,
  ROLE_LABELS,
  SAVE_FAILED_PREFIX,
} from '../../constants/messages.ts';
import {
  formatDateTime,
  formatNumber,
  formatWon,
  formatYearMonth,
  parseUsageInput,
  todayISODate,
} from '../../domain/format.ts';
import { canToggleConfirmed, canTogglePaid, isFullyPaid } from '../../domain/payment.ts';
import { unitLabel } from '../../domain/unitLabel.ts';
import { useDraftEntries } from '../../hooks/useDraftEntries.ts';
import { saveUnitField, saveWaterField } from '../../services/firestore/monthRepo.ts';
import { setPaidStatus, setPaymentConfirmed } from '../../services/firestore/paymentRepo.ts';
import { GridInput } from './GridInput.tsx';
import { useGridKeyboard } from './useGridKeyboard.ts';
import type { Payments } from '../../domain/billing.ts';
import type { Result } from '../../services/result.ts';
import type { MonthAccess } from '../month/monthAccess.ts';
import type { MonthDoc, PaymentDoc, Unit, UnitBill, UserRole } from '../../types/bill.ts';

/** 키보드로 이동하는 칸의 열 번호 */
const COL = { vacant: 0, usage: 1, paid: 2, confirm: 3 } as const;
const COL_COUNT = 4;

const HEADERS = ['세대', '공실', '수도 사용량(리터)', '수도 요금', '이번 달 관리비', '이월 미납', '청구액', '납부 상태', '납부일', '납부 확인'] as const;

/** 납부 상태 버튼 색 — 미납은 연한 주황, 완납은 연두 (G-20) */
const PAID_BUTTON_CLASS = {
  unpaid: 'border-orange-400 bg-orange-100 text-orange-900 hover:bg-orange-200',
  paid: 'border-lime-600 bg-lime-300 text-lime-950 hover:bg-lime-400',
} as const;

/** 입력할 수 있는 칸 — 수도 사용량뿐. 수도 요금은 사용량 × 단가로 계산해 보여 준다 (F-17) */
type DraftField = 'usage';

/** 복구 순서 */
const DRAFT_FIELDS: readonly DraftField[] = ['usage'];

/** 납부일 칸 — 첫 줄 납부 시각(24시간제), 둘째 줄 완납으로 바꾼 계정 (G-20). 예전 자료는 날짜만 */
function paidInfo(payment: PaymentDoc | undefined): { when: string; who: string } | null {
  if (!payment) return null;
  const when = payment.paidAt ? formatDateTime(payment.paidAt) : (payment.paidDate ?? '');
  if (!when) return null;
  return { when, who: payment.paidByRole ? ROLE_LABELS[payment.paidByRole] : '' };
}

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

  /** 저장 실행 + 저장 상태 표시 — 결과를 그대로 돌려준다 */
  const track = async (task: Promise<Result<void>>): Promise<Result<void>> => {
    setSaving((count) => count + 1);
    const result = await task;
    setSaving((count) => count - 1);
    setLastError(result.ok ? null : `${SAVE_FAILED_PREFIX}: ${result.message}`);
    return result;
  };

  /**
   * 칸 하나를 저장 — 임시저장 복구에도 같은 함수를 쓴다.
   * 그 칸의 필드만 저장해 같은 세대의 다른 칸을 옛값으로 덮지 않는다 (G1).
   * 성공·권한 오류면 임시저장을 지우고, 그 밖의 실패는 남겨 둔다 (G4, Design §6.1).
   */
  const commitCell = async (unitId: string, field: DraftField, text: string): Promise<string | null> => {
    const key = cellKey(unitId, field);
    const bill = billById.get(unitId);
    // 납부 확인된 세대는 수도를 고칠 수 없다 (G-18) — 임시저장 복구로 들어와도 막는다
    if (bill?.isConfirmed) {
      drafts.clear(key);
      return CONFIRMED_LOCKED_MESSAGE;
    }
    const usage = parseUsageInput(text);
    if (usage === null) return INVALID_USAGE_MESSAGE;
    return drafts.commit(key, track(saveWaterField(db, ym, unitId, field, usage, uid)));
  };

  /** 미납 → 완납이면 청구액 전액·지금 시각·내 역할을 저장하고, 완납 → 미납이면 모두 지운다 (G-20) */
  const togglePaid = (unitId: string, bill: UnitBill) => {
    const now = new Date();
    const mark = isFullyPaid(bill) ? null : { amount: bill.charged, date: todayISODate(now), at: now.toISOString(), role };
    void track(setPaidStatus(db, ym, unitId, mark, uid));
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
                {HEADERS.map((title, index) => (
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
                // 관리실은 관리비를 나누지도 내지도 않는다 — 이름만 보이고 입력·납부 칸은 없다 (H-26)
                if (bill.exempt) {
                  return (
                    <tr key={unit.id} className="border-b border-slate-200 bg-slate-100 text-slate-600">
                      <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-bold">
                        {unitLabel(unit)}
                      </th>
                      <td colSpan={HEADERS.length - 1} />
                    </tr>
                  );
                }
                const payment = payments[unit.id];
                const water = month.water[unit.id];
                const fullyPaid = isFullyPaid(bill);
                // 납부 확인된 세대는 관리자도 납부 상태를 바꿀 수 없다 — 먼저 납부 확인을 풀어야 한다 (G-20)
                const canPay = access.canEdit && canTogglePaid(bill);
                // 공실은 관리자만, 납부 확인된 세대는 관리자도 바꿀 수 없다 (G-21, G-22)
                const canVacant = isAdmin && access.canEdit && !bill.isConfirmed;
                const paid = paidInfo(payment);
                // 납부 완료 가능 표시는 관리자에게만 (관리소장은 납부 완료를 누를 수 없다)
                const showConfirmReady = isAdmin && fullyPaid;
                const canWater = access.canEdit && bill.isTarget && unit.kind === 'residential' && !bill.isConfirmed;
                const autoBase = bill.primaryShare + bill.water;
                const nav = (col: number) => (event: Parameters<typeof onKeyDown>[0]) => onKeyDown(event, row, col);
                const draftOf = (field: DraftField) => draft[cellKey(unit.id, field)];
                const draftHandler = (field: DraftField) => (text: string) => drafts.set(cellKey(unit.id, field), text);
                const commitHandler = (field: DraftField) => (text: string) => commitCell(unit.id, field, text);

                return (
                  <tr key={unit.id} className={`border-b border-slate-200 ${bill.isTarget ? '' : 'bg-slate-100 text-slate-600'}`}>
                    <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-bold">
                      {unitLabel(unit)}
                      {/* 오리집은 5·6동 두 세대 몫 — 어느 동에서 바꿔도 두 동에 함께 반영된다 (H-22) */}
                      {bill.shares > 1 && <span className="block text-base font-semibold text-blue-800">{bill.shares}세대분 합계</span>}
                    </th>
                    <td className="px-2 text-center">
                      <input
                        ref={register(row, COL.vacant)}
                        type="checkbox"
                        aria-label={`${unitLabel(unit)} 공실`}
                        className="h-7 w-7"
                        checked={month.vacant[unit.id] === true}
                        disabled={!canVacant}
                        onKeyDown={nav(COL.vacant)}
                        onChange={(event) => void track(saveUnitField(db, ym, 'vacant', unit.id, event.target.checked ? true : null, uid))}
                      />
                    </td>
                    <td className="w-24 px-1">
                      <GridInput
                        label={`${unitLabel(unit)} 수도 사용량(리터)`}
                        value={water?.usage == null ? '' : String(water.usage)}
                        draft={draftOf('usage')}
                        disabled={!canWater}
                        inputRef={register(row, COL.usage)}
                        onNavigate={nav(COL.usage)}
                        onDraft={draftHandler('usage')}
                        onCommit={commitHandler('usage')}
                      />
                    </td>
                    {/* 수도 요금 — 보기 전용, 사용량 × 수도 단가 (F-17) */}
                    <td className="whitespace-nowrap px-2 text-right tabular-nums">
                      {unit.kind === 'residential' && water?.usage != null ? formatNumber(bill.water) : ''}
                    </td>
                    {/* 이번 달 관리비 — 보기 전용 (G-17) */}
                    <td className="whitespace-nowrap px-2 text-right tabular-nums">
                      {bill.isTarget ? formatNumber(bill.override ?? autoBase) : ''}
                      {bill.override !== null && <span className="block text-sm font-semibold text-purple-700">✎ 직접 수정됨</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 text-right tabular-nums">{bill.carryOver === 0 ? '' : formatNumber(bill.carryOver)}</td>
                    <td className="whitespace-nowrap px-2 text-right font-bold tabular-nums">{formatWon(bill.charged)}</td>
                    {/* 납부 상태 — 미납↔완납 토글 (G-20) */}
                    <td className="px-1 text-center">
                      {bill.charged > 0 || bill.paid > 0 ? (
                        <button
                          ref={register(row, COL.paid)}
                          type="button"
                          aria-label={`${unitLabel(unit)} 납부 상태 ${fullyPaid ? '완납' : '미납'}`}
                          aria-pressed={fullyPaid}
                          title={bill.isConfirmed ? '납부 확인된 세대입니다 — 바꾸려면 관리자가 납부 확인을 먼저 풀어야 합니다' : undefined}
                          disabled={!canPay}
                          onKeyDown={nav(COL.paid)}
                          onClick={() => togglePaid(unit.id, bill)}
                          className={`min-w-[5rem] whitespace-nowrap rounded-md border-2 px-3 py-1 font-bold focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60 ${fullyPaid ? PAID_BUTTON_CLASS.paid : PAID_BUTTON_CLASS.unpaid}`}
                        >
                          {fullyPaid ? '완납' : '미납'}
                        </button>
                      ) : null}
                    </td>
                    {/* 납부일 — 보기 전용: 납부 시각(24시간제)과 완납으로 바꾼 계정 (G-19, G-20) */}
                    <td className="min-w-[9rem] whitespace-nowrap px-2 text-base leading-snug tabular-nums">
                      {paid && (
                        <>
                          <span className="block">{paid.when}</span>
                          {paid.who && <span className="block text-slate-700">{paid.who}</span>}
                        </>
                      )}
                    </td>
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
