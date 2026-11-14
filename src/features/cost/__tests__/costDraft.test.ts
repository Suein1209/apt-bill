import { describe, expect, it } from 'vitest';
import { costDraftKey, isCostDraftKey, resolveCostDraftKey } from '../costDraft.ts';

const categories = [{ id: 'telecom', name: '통신비', items: [{ id: 'tv', name: 'TV 시청료', amount: 0 }] }];

describe('비용 화면 임시저장 키 (G3)', () => {
  it('키를 저장 대상으로 되돌린다', () => {
    expect(resolveCostDraftKey(costDraftKey.primary('labor'), categories)).toEqual({ kind: 'primary', key: 'labor' });
    expect(resolveCostDraftKey(costDraftKey.itemAmount('tv'), categories)).toEqual({ kind: 'itemAmount', categoryId: 'telecom', itemId: 'tv' });
    expect(resolveCostDraftKey(costDraftKey.categoryName('telecom'), categories)).toEqual({ kind: 'categoryName', categoryId: 'telecom' });
  });

  it('그사이 지워진 항목이면 null', () => {
    expect(resolveCostDraftKey(costDraftKey.itemName('gone'), categories)).toBeNull();
    expect(resolveCostDraftKey('cost|primary|unknown', categories)).toBeNull();
  });

  it('동별 화면 키와 섞이지 않는다', () => {
    expect(isCostDraftKey('R201|water')).toBe(false);
    expect(isCostDraftKey(costDraftKey.primary('labor'))).toBe(true);
  });
});
