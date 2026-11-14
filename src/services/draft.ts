/**
 * 입력 중 임시저장 (D-2) — 칸에 입력하는 즉시 보관하고, 저장에 성공하면 지운다.
 * localStorage 가 막혀 있어도(사생활 보호 모드 등) 앱은 그대로 동작해야 하므로 모든 접근을 감싼다.
 * Design Ref: §2.2 Data Flow
 */
import { DRAFT_SCHEMA_VERSION } from '../constants/app.ts';
import type { YearMonth } from '../types/bill.ts';

const KEY_PREFIX = 'apt-bill:draft';

export type DraftEntries = Record<string, string>;

interface DraftFile {
  version: number;
  entries: DraftEntries;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function draftKey(ym: YearMonth, uid: string): string {
  return `${KEY_PREFIX}:${ym}:${uid}`;
}

export function createDraftStore(ym: YearMonth, uid: string, storage: KeyValueStorage | null = defaultStorage()) {
  const key = draftKey(ym, uid);

  const read = (): DraftEntries => {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || !('entries' in parsed)) return {};
      const file = parsed as { version: unknown; entries: unknown };
      if (file.version !== DRAFT_SCHEMA_VERSION || typeof file.entries !== 'object' || file.entries === null) return {};
      return Object.fromEntries(Object.entries(file.entries).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    } catch {
      return {};
    }
  };

  const write = (entries: DraftEntries): void => {
    try {
      if (Object.keys(entries).length === 0) storage?.removeItem(key);
      else storage?.setItem(key, JSON.stringify({ version: DRAFT_SCHEMA_VERSION, entries } satisfies DraftFile));
    } catch {
      // 저장 공간이 없거나 막혀 있으면 임시저장 없이 계속한다 (Design §6.1)
    }
  };

  return {
    read,
    set(cellKey: string, text: string) {
      write({ ...read(), [cellKey]: text });
    },
    remove(cellKey: string) {
      const entries = read();
      delete entries[cellKey];
      write(entries);
    },
    clear() {
      write({});
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
