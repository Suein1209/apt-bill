import type { FeeItemDefinition } from '../types/bill.ts';

/** 기본 관리비 항목 — 새 항목은 이 배열에 추가하면 Grid/고지서에 자동 반영 */
export const DEFAULT_FEE_ITEMS = [
  { key: 'generalManagement', label: '일반관리비', category: 'common', order: 10 },
  { key: 'cleaning', label: '청소비', category: 'common', order: 20 },
  { key: 'commonElectricity', label: '공동전기료', category: 'common', order: 30 },
  { key: 'elevatorMaintenance', label: '승강기유지비', category: 'common', order: 40 },
  { key: 'householdWater', label: '세대수도료', category: 'individual', order: 50 },
  { key: 'householdElectricity', label: '세대전기료', category: 'individual', order: 60 },
] as const satisfies readonly FeeItemDefinition[];

/** localStorage Draft 스키마 버전 */
export const BILL_DRAFT_VERSION = 1;
