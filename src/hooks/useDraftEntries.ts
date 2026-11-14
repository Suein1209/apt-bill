/**
 * 화면 단위 임시저장 (D-2) — 칸에 입력하는 즉시 보관, 저장 성공·권한 오류면 지운다
 * Design Ref: §2.2, §6.1 — permission-denied 는 입력을 되돌리고 draft 삭제, unavailable 은 draft 유지
 */
import { useMemo, useState } from 'react';
import { createDraftStore, type DraftEntries } from '../services/draft.ts';
import type { Result } from '../services/result.ts';
import type { YearMonth } from '../types/bill.ts';

const PERMISSION_DENIED = 'permission-denied';

export function useDraftEntries(ym: YearMonth, uid: string, ownsKey: (key: string) => boolean) {
  const store = useMemo(() => createDraftStore(ym, uid), [ym, uid]);
  const [entries, setEntries] = useState<DraftEntries>(() => store.read());
  // 화면을 열 때 남아 있던 이 화면의 입력 — 복구 안내에 쓴다
  const [restorable] = useState<string[]>(() => Object.keys(store.read()).filter(ownsKey));

  const set = (key: string, text: string) => {
    store.set(key, text);
    setEntries((current) => ({ ...current, [key]: text }));
  };

  const clear = (key: string) => {
    store.remove(key);
    setEntries((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  /** 저장 실행 — 성공하거나 권한 오류(다시 해도 안 됨)면 draft 를 지운다. 실패 메시지를 돌려준다 */
  const commit = async (key: string, task: Promise<Result<void>>): Promise<string | null> => {
    const result = await task;
    if (result.ok || result.code === PERMISSION_DENIED) clear(key);
    return result.ok ? null : result.message;
  };

  const pending = restorable.filter((key) => entries[key] !== undefined);

  return { entries, set, clear, commit, pending };
}

export type DraftEntriesApi = ReturnType<typeof useDraftEntries>;
