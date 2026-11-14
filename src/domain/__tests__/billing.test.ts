import { describe, expect, it } from 'vitest';
import {
  closingUnpaid,
  computeBills,
  computeCarryOvers,
  countTargets,
  dongStatus,
  isDongFullyPaid,
  summarizeMonth,
  type MonthRecord,
} from '../billing.ts';
import { buildUnits } from '../units.ts';
import { makeMonth, makePayment } from './fixtures.ts';
import type { MonthDoc, UnitBill, YearMonth } from '../../types/bill.ts';

const units = buildUnits();
const ALL_TARGETS = 129; // 관리실 포함 (H-26)

function billOf(bills: readonly UnitBill[], unitId: string): UnitBill {
  const bill = bills.find((item) => item.unitId === unitId);
  if (!bill) throw new Error(`${unitId} 청구 결과가 없습니다.`);
  return bill;
}

describe('부과 대상 (H-9, H-10, C-7)', () => {
  it('관리실을 포함한 129곳 (H-26)', () => {
    expect(countTargets(units, makeMonth('2026-11'))).toBe(ALL_TARGETS);
  });

  it('공실 10곳이면 119곳', () => {
    const vacantIds = ['R201', 'R202', 'R203', 'R205', 'R206', 'R207', 'R208', 'R209', 'S102', 'SORI'];
    const month = makeMonth('2026-11', { vacant: Object.fromEntries(vacantIds.map((id) => [id, true])) });
    expect(countTargets(units, month)).toBe(119);

    const bills = computeBills(units, month, {}, {});
    expect(billOf(bills, 'R201')).toMatchObject({ isTarget: false, charged: 0 });
    expect(billOf(bills, 'S112')).toMatchObject({ isTarget: true, autoPaid: true, unpaid: 0, isConfirmed: true });
  });
});

describe('균등 분배와 10원 올림 (C-3, C-5, C-9, C-11, C-13)', () => {
  it('1차 100,000원 ÷ 129곳 → 청구 780원, 표시 775원', () => {
    const month = makeMonth('2026-11', { primaryCosts: { labor: 100_000, commonElectricity: 0, commonWater: 0, maintenance: 0 } });
    const bill = billOf(computeBills(units, month, {}, {}), 'R201');
    expect(bill.charged).toBe(780);
    expect(bill.primaryShare).toBe(775);
  });

  it('1차와 2차를 합쳐 나눈다', () => {
    const month = makeMonth('2026-11', {
      primaryCosts: { labor: 64_500, commonElectricity: 0, commonWater: 0, maintenance: 0 },
      secondaryCategories: [{ id: 'c', name: '통신비', items: [{ id: 'i', name: '인터넷', amount: 64_500 }] }],
    });
    const bill = billOf(computeBills(units, month, {}, {}), 'S110');
    expect(bill.primaryShare).toBe(500);
    expect(bill.secondaryShare).toBe(500);
    expect(bill.charged).toBe(1_000);
  });

  it('올림은 최종 합계에서 한 번만 — 항목마다 올리면 16,090원, 최종 합계 올림은 16,080원', () => {
    const month = makeMonth('2026-11', {
      primaryCosts: { labor: 100_000, commonElectricity: 0, commonWater: 0, maintenance: 0 },
      water: { R201: { usage: 12, amount: 15_301 } },
    });
    const bill = billOf(computeBills(units, month, {}, {}), 'R201');
    expect(bill.water).toBe(15_301);
    expect(bill.charged).toBe(16_080); // 775.19… + 15,301 = 16,076.19… → 16,080
  });

  it('상가는 수도 요금을 넣어도 반영하지 않는다 (F-3)', () => {
    const month = makeMonth('2026-11', { water: { S110: { usage: 5, amount: 9_000 } } });
    expect(billOf(computeBills(units, month, {}, {}), 'S110')).toMatchObject({ water: 0, charged: 0 });
  });

  it('합계·세대당 분배액 (F-14, P-12)', () => {
    const month = makeMonth('2026-11', {
      primaryCosts: { labor: 100_000, commonElectricity: 29_000, commonWater: 0, maintenance: 0 },
      secondaryCategories: [{ id: 'c', name: '청소비', items: [{ id: 'i', name: '계단 청소', amount: 25_800 }] }],
    });
    expect(summarizeMonth(units, month)).toEqual({
      primaryTotal: 129_000,
      secondaryTotal: 25_800,
      targetCount: ALL_TARGETS,
      perUnitShare: 1_200,
    });
  });

  it('모두 공실이면 관리실 한 곳이 나누고, 나머지는 청구 0원 (H-26)', () => {
    const vacant = Object.fromEntries(units.map((unit) => [unit.id, true as const]));
    const month = makeMonth('2026-11', { vacant, primaryCosts: { labor: 10_000, commonElectricity: 0, commonWater: 0, maintenance: 0 } });
    expect(summarizeMonth(units, month)).toMatchObject({ targetCount: 1, perUnitShare: 10_000 });
    const bills = computeBills(units, month, {}, {});
    expect(bills.filter((bill) => !bill.autoPaid).every((bill) => bill.charged === 0)).toBe(true);
    expect(billOf(bills, 'S112')).toMatchObject({ charged: 10_000, paid: 10_000, unpaid: 0 });
  });
});

describe('직접 수정 (C-6, C-14 ~ C-17)', () => {
  const base = { primaryCosts: { labor: 129_000, commonElectricity: 0, commonWater: 0, maintenance: 0 } };

  it('직접 수정 30,000 + 이월 5,005 → 35,010원, 다른 세대는 그대로', () => {
    const month = makeMonth('2026-11', { ...base, overrides: { S102: 30_000 } });
    const bills = computeBills(units, month, {}, { S102: 5_005 });
    expect(billOf(bills, 'S102')).toMatchObject({ override: 30_000, charged: 35_010 });
    expect(billOf(bills, 'R201').charged).toBe(1_000);
  });

  it('공실이 바뀌어 다시 계산해도 직접 수정값은 유지된다 (C-15)', () => {
    const month = makeMonth('2026-11', { ...base, overrides: { S102: 30_000 }, vacant: { R201: true } });
    expect(billOf(computeBills(units, month, {}, {}), 'S102').charged).toBe(30_000);
  });

  it('직접 수정을 지우면 자동 계산값으로 돌아간다 (C-17)', () => {
    const month = makeMonth('2026-11', base);
    expect(billOf(computeBills(units, month, {}, {}), 'S102')).toMatchObject({ override: null, charged: 1_000 });
  });
});

describe('납부·미납 (G-8, G-10, C-8)', () => {
  const month = makeMonth('2026-11', { primaryCosts: { labor: 129_000, commonElectricity: 0, commonWater: 0, maintenance: 0 } });

  it('일부 납부하면 차액이 미납', () => {
    const bill = billOf(computeBills(units, month, { R201: makePayment(400) }, {}), 'R201');
    expect(bill).toMatchObject({ charged: 1_000, paid: 400, unpaid: 600 });
  });

  it('결산 스냅샷에는 미납이 0이 아닌 곳만 남는다', () => {
    const bills = computeBills(units, month, { R201: makePayment(1_000), R202: makePayment(1_500) }, {});
    const unpaid = closingUnpaid(bills);
    expect(unpaid.R201).toBeUndefined();
    expect(unpaid.R202).toBe(-500); // 초과 납부 → 다음 달 차감 (Design §12 Q2)
    expect(unpaid.R203).toBe(1_000);
    expect(unpaid.S112).toBeUndefined(); // 관리사무소는 부과 없음
  });
});

describe('이월 미납 (C-8, D-9)', () => {
  const costs = { primaryCosts: { labor: 129_000, commonElectricity: 0, commonWater: 0, maintenance: 0 } };
  const record = (ym: YearMonth, month: Partial<MonthDoc>, payments: MonthRecord['payments'] = {}): [YearMonth, MonthRecord] => [
    ym,
    { month: makeMonth(ym, month), payments },
  ];

  it('이전 달 문서가 없으면 이월 0', () => {
    expect(computeCarryOvers(units, '2026-11', new Map())).toEqual({});
  });

  it('결산된 달의 스냅샷에서 멈추고, 열린 달은 다시 계산한다', () => {
    const history = new Map([
      record('2026-09', { status: 'closed', closing: { closedAt: '', closedBy: 'admin', unpaid: { R201: 1_000 } } }),
      record('2026-10', costs, { R201: makePayment(500) }),
    ]);
    const carry = computeCarryOvers(units, '2026-11', history);
    // 10월 R201: 1,000(분배) + 1,000(9월 이월) = 2,000 청구, 500 납부 → 1,500
    expect(carry.R201).toBe(1_500);
    expect(carry.R202).toBe(1_000);
    expect(carry.S112).toBeUndefined();
  });

  it('결산 전 이전 달 납부를 고치면 다음 달 이월이 바뀐다 (D-9)', () => {
    const closed = record('2026-09', { status: 'closed', closing: { closedAt: '', closedBy: 'admin', unpaid: { R201: 1_000 } } });
    const before = new Map([closed, record('2026-10', costs, { R201: makePayment(500) })]);
    const after = new Map([closed, record('2026-10', costs, { R201: makePayment(2_000) })]);
    expect(computeCarryOvers(units, '2026-11', before).R201).toBe(1_500);
    expect(computeCarryOvers(units, '2026-11', after).R201).toBeUndefined();
  });

  it('결산 취소한 달(closing = null)은 다시 계산 경로로 돌아간다 (D-8)', () => {
    const history = new Map([
      record('2026-09', { status: 'open', closing: null }),
      record('2026-10', costs, { R201: makePayment(500) }),
    ]);
    expect(computeCarryOvers(units, '2026-11', history).R201).toBe(500);
  });

  it('열린 달이 두 달 이어져도 차례로 넘어간다', () => {
    const history = new Map([
      record('2026-09', costs),
      record('2026-10', costs),
    ]);
    // 9월 미납 1,000 → 10월 청구 2,000 → 11월 이월 2,000
    expect(computeCarryOvers(units, '2026-11', history).R201).toBe(2_000);
  });

  it('초과 납부(음수 이월)는 다음 달 청구에서 차감된다 (Design §12 Q2)', () => {
    const month = makeMonth('2026-11', costs);
    expect(billOf(computeBills(units, month, {}, { R201: -1_000 }), 'R201').charged).toBe(0);
  });

  it('공실에도 이전 미납은 청구된다 (Design §12 Q4)', () => {
    const month = makeMonth('2026-11', { ...costs, vacant: { R201: true } });
    expect(billOf(computeBills(units, month, {}, { R201: 1_234 }), 'R201')).toMatchObject({ isTarget: false, charged: 1_240 });
  });
});

describe('동 버튼 미납 현황 (G-4, G-7, G-10, G-11)', () => {
  const month = makeMonth('2026-11', {
    primaryCosts: { labor: 129_000, commonElectricity: 0, commonWater: 0, maintenance: 0 },
    vacant: { R211: true },
  });

  it('6동: 관리사무소·공실을 빼고, 납부 완료가 아니면 미납', () => {
    const payments = {
      R212: makePayment(1_000, true), // 납부 완료
      R213: makePayment(1_000, false), // 금액만 입력 → 미납 (G-11)
      S111_1: makePayment(300, false), // 일부 납부 → 미납 (G-10)
    };
    const bills = computeBills(units, month, payments, {});
    // 6동 = 주거 14 + 상가 111-2·111-1·오리집 3 = 17
    expect(dongStatus(units, bills, 6)).toEqual({ dong: 6, targetCount: 15, unpaidCount: 14 });
  });

  it('5동: 공실(211호)은 세지 않는다', () => {
    const bills = computeBills(units, month, {}, {});
    // 5동 = 주거 14 − 공실 1 + 상가 110·오리집 2 = 15
    expect(dongStatus(units, bills, 5)).toEqual({ dong: 5, targetCount: 13, unpaidCount: 13 });
  });
});

describe('동 전 세대 납부 완료 (G-16)', () => {
  it('부과 대상이 있고 미납이 0이면 완납, 부과 대상이 없으면 완납 아님', () => {
    expect(isDongFullyPaid({ dong: 1, targetCount: 15, unpaidCount: 0 })).toBe(true);
    expect(isDongFullyPaid({ dong: 1, targetCount: 15, unpaidCount: 1 })).toBe(false);
    expect(isDongFullyPaid({ dong: 1, targetCount: 0, unpaidCount: 0 })).toBe(false);
  });
});

describe('관리실 자동 납부 (H-26)', () => {
  const month = makeMonth('2026-11', { primaryCosts: { labor: 129_000, commonElectricity: 0, commonWater: 0, maintenance: 0 } });

  it('몫은 다른 세대와 같고, 낸 것·납부 확인된 것으로 본다', () => {
    const office = billOf(computeBills(units, month, {}, {}), 'S112');
    expect(office).toMatchObject({ isTarget: true, autoPaid: true, charged: 1_000, paid: 1_000, unpaid: 0, isConfirmed: true });
  });

  it('결산 미납·이월·직접 수정에서 빠지고, 동 버튼 세대 수에서도 빠진다', () => {
    const withExtras = makeMonth('2026-11', { ...month, overrides: { S112: 5_000 } });
    const bills = computeBills(units, withExtras, {}, { S112: 3_000 });
    expect(billOf(bills, 'S112')).toMatchObject({ override: null, carryOver: 0, unpaid: 0 });
    expect(closingUnpaid(bills).S112).toBeUndefined();
    expect(dongStatus(units, bills, 6)).toMatchObject({ targetCount: 15 });
  });
});
