/**
 * 관리비 항목 상수 (F-4 ~ F-7, REQUIREMENTS 4.1)
 */
import type { PrimaryFeeItem, PrimaryFeeKey, SecondaryCategory, Won } from '../types/bill.ts';

/** 1차 항목(공통 비용) — 고정 4개, 화면에서 바꾸지 않는다 (F-7) */
export const PRIMARY_FEE_ITEMS = [
  { key: 'labor', label: '인건비' },
  { key: 'commonElectricity', label: '공동 전기요금' },
  { key: 'commonWater', label: '공동 수도요금' },
  { key: 'maintenance', label: '유지비' },
] as const satisfies readonly PrimaryFeeItem[];

/** 새 달 1차 금액 초기값 */
export const EMPTY_PRIMARY_COSTS: Readonly<Record<PrimaryFeeKey, Won>> = {
  labor: 0,
  commonElectricity: 0,
  commonWater: 0,
  maintenance: 0,
};

/**
 * 2차 기본 카테고리·항목 (F-6) — 첫 달에만 쓰고, 이후는 지난달 목록을 이어받는다 (F-9)
 */
export const DEFAULT_SECONDARY_CATEGORIES: readonly SecondaryCategory[] = [
  {
    id: 'activity',
    name: '활동비',
    items: [{ id: 'activity-chairman', name: '회장 관공비', amount: 0 }],
  },
  {
    id: 'telecom',
    name: '통신비',
    items: [
      { id: 'telecom-tv', name: 'TV 시청료', amount: 0 },
      { id: 'telecom-phone', name: '전화', amount: 0 },
      { id: 'telecom-internet', name: '인터넷', amount: 0 },
    ],
  },
  {
    id: 'operation',
    name: '운영비',
    items: [{ id: 'operation-fire', name: '방화 관리비', amount: 0 }],
  },
  {
    id: 'supplies',
    name: '소품비',
    items: [{ id: 'supplies-sticker', name: '스티커 30매', amount: 0 }],
  },
  {
    id: 'cleaning',
    name: '청소비',
    items: [{ id: 'cleaning-stairs', name: '계단 청소', amount: 0 }],
  },
];
