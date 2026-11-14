import { describe, expect, it } from 'vitest';
import { createDraftStore, draftKey, type KeyValueStorage } from '../draft.ts';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('임시저장 (D-2)', () => {
  it('입력하면 보관하고, 저장 성공하면 지운다', () => {
    const storage = memoryStorage();
    const store = createDraftStore('2026-11', 'u1', storage);
    store.set('R201|paid', '12,000');
    store.set('R202|water', '9000');
    expect(store.read()).toEqual({ 'R201|paid': '12,000', 'R202|water': '9000' });

    store.remove('R201|paid');
    expect(store.read()).toEqual({ 'R202|water': '9000' });
    store.remove('R202|water');
    expect(storage.data.size).toBe(0); // 비면 키 자체를 지운다
  });

  it('달·사용자별로 따로 보관한다', () => {
    const storage = memoryStorage();
    createDraftStore('2026-11', 'u1', storage).set('R201|paid', '1');
    expect(createDraftStore('2026-12', 'u1', storage).read()).toEqual({});
    expect(createDraftStore('2026-11', 'u2', storage).read()).toEqual({});
  });

  it('버전이 다르거나 깨진 값은 무시한다', () => {
    const storage = memoryStorage();
    storage.setItem(draftKey('2026-11', 'u1'), JSON.stringify({ version: 1, entries: { a: 'b' } }));
    expect(createDraftStore('2026-11', 'u1', storage).read()).toEqual({});
    storage.setItem(draftKey('2026-11', 'u1'), '{not json');
    expect(createDraftStore('2026-11', 'u1', storage).read()).toEqual({});
  });

  it('저장소가 막혀 있어도 오류 없이 동작한다', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createDraftStore('2026-11', 'u1', broken);
    expect(() => store.set('R201|paid', '1')).not.toThrow();
    expect(store.read()).toEqual({});
    expect(createDraftStore('2026-11', 'u1', null).read()).toEqual({});
  });
});
