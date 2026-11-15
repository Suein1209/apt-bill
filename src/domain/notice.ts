/**
 * 관리비 통지서 한 장의 줄 만들기 (P-18) — 무엇을 어떤 순서로 적을지만 정하고, 모양은 화면이 정한다.
 *
 *   공용 비용 (세대당)         ← 묶음 줄, 아래 항목들의 합 = 세대 분배액
 *     인건비 / 공동 전기요금 / 유지비   ← 항목별 세대 몫 (1원 자리 올림, 오리집은 2세대분)
 *   수도 요금                  ← 사용량 × 단가
 *   지난달 미납 / 연체료(10%)  ← 미납이 있을 때만
 *   10원 미만 올림             ← 줄 합계와 청구액이 다를 때만
 *   관리비 합계                ← 청구액
 */
import { LATE_FEE_PERCENT } from '../constants/app.ts';
import { PRIMARY_FEE_ITEMS, WATER_RATE_KEY } from '../constants/feeItems.ts';
import { perShare } from './billing.ts';
import { formatNumber } from './format.ts';
import { sum } from './money.ts';
import type { MonthDoc, Unit, UnitBill, Won } from '../types/bill.ts';

export interface NoticeLine {
  /** group: 묶음 제목 줄(금액 = 아래 항목 합), item: 묶음 안 항목(들여 씀), line: 그 밖의 줄 */
  kind: 'group' | 'item' | 'line';
  label: string;
  /** 이름 옆에 작게 적는 설명 — "12.3리터", "2세대분" 등 */
  note: string | null;
  amount: Won;
}

export interface Notice {
  lines: NoticeLine[];
  total: Won;
}

const line = (label: string, amount: Won, note: string | null = null): NoticeLine => ({ kind: 'line', label, note, amount });

/** 이번 달 관리비 부분 — 공용 비용 항목별 세대 몫, 직접 수정·공실은 한 줄 */
function chargeLines(bill: UnitBill, month: MonthDoc, targetCount: number): NoticeLine[] {
  if (!bill.isTarget) return [line('이번 달 관리비', 0, '공실')];
  if (bill.override !== null) return [line('이번 달 관리비', bill.override, '조정 금액')];

  const items = PRIMARY_FEE_ITEMS.filter((item) => item.key !== WATER_RATE_KEY).map(
    (item): NoticeLine => ({
      kind: 'item',
      label: item.label,
      note: null,
      amount: perShare(month.primaryCosts[item.key], targetCount) * bill.shares,
    }),
  );
  const group: NoticeLine = {
    kind: 'group',
    label: '공용 비용 (세대당)',
    note: bill.shares > 1 ? `${bill.shares}세대분` : null,
    amount: sum(items.map((item) => item.amount)),
  };
  return [group, ...items];
}

/** 지난달에서 넘어온 금액 — 미납이면 미납액과 연체료를 나눠 적고, 더 냈으면 빼는 줄 (C-16) */
function carryLines(bill: UnitBill): NoticeLine[] {
  if (bill.carryOver > 0) {
    const lines = [line('지난달 미납', bill.carryOver - bill.lateFee)];
    if (bill.lateFee > 0) lines.push(line(`연체료 (${LATE_FEE_PERCENT}%)`, bill.lateFee));
    return lines;
  }
  return bill.carryOver < 0 ? [line('지난달 더 낸 금액', bill.carryOver)] : [];
}

export function buildNotice(unit: Unit, bill: UnitBill, month: MonthDoc, targetCount: number): Notice {
  const lines = chargeLines(bill, month, targetCount);

  const usage = month.water[unit.id]?.usage ?? null;
  if (unit.kind === 'residential' && bill.isTarget && usage !== null && usage > 0) {
    lines.push(line('수도 요금', bill.water, `${formatNumber(usage)}리터`));
  }
  lines.push(...carryLines(bill));

  // 묶음 안 항목은 묶음 줄에 이미 들어 있으므로 합계에서 뺀다
  const listed = sum(lines.filter((item) => item.kind !== 'item').map((item) => item.amount));
  if (bill.charged !== listed) lines.push(line('10원 미만 올림', bill.charged - listed));

  return { lines, total: bill.charged };
}
