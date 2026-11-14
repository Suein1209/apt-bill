/**
 * 비용 입력 화면 임시저장 키 (D-2, G3)
 */
import { PRIMARY_FEE_ITEMS } from '../../constants/feeItems.ts';
import type { PrimaryFeeKey, SecondaryCategory } from '../../types/bill.ts';

const PREFIX = 'cost';

export type CostDraftTarget =
  | { kind: 'primary'; key: PrimaryFeeKey }
  | { kind: 'categoryName'; categoryId: string }
  | { kind: 'itemName'; categoryId: string; itemId: string }
  | { kind: 'itemAmount'; categoryId: string; itemId: string };

export const costDraftKey = {
  primary: (key: PrimaryFeeKey) => `${PREFIX}|primary|${key}`,
  categoryName: (categoryId: string) => `${PREFIX}|categoryName|${categoryId}`,
  itemName: (itemId: string) => `${PREFIX}|itemName|${itemId}`,
  itemAmount: (itemId: string) => `${PREFIX}|itemAmount|${itemId}`,
};

export const isCostDraftKey = (key: string) => key.startsWith(`${PREFIX}|`);

/** 키를 저장 대상으로 — 그사이 지워진 카테고리·항목이면 null */
export function resolveCostDraftKey(key: string, categories: readonly SecondaryCategory[]): CostDraftTarget | null {
  const [prefix, kind, id] = key.split('|');
  if (prefix !== PREFIX || !id) return null;
  if (kind === 'primary') {
    const item = PRIMARY_FEE_ITEMS.find((candidate) => candidate.key === id);
    return item ? { kind: 'primary', key: item.key } : null;
  }
  if (kind === 'categoryName') return categories.some((category) => category.id === id) ? { kind, categoryId: id } : null;
  if (kind === 'itemName' || kind === 'itemAmount') {
    const category = categories.find((candidate) => candidate.items.some((item) => item.id === id));
    return category ? { kind, categoryId: category.id, itemId: id } : null;
  }
  return null;
}
