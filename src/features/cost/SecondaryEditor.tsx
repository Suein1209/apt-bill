/**
 * 2차 카테고리 > 항목 편집 (F-2, F-5, F-10)
 * Design Ref: §4.1 updateSecondary — 트랜잭션으로 최신 목록에 변경을 적용
 */
import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx';
import { MoneyInput } from '../../components/MoneyInput.tsx';
import { TextInput } from '../../components/TextInput.tsx';
import { formatWon } from '../../domain/format.ts';
import { sum } from '../../domain/money.ts';
import { updateSecondary } from '../../services/firestore/monthRepo.ts';
import { costDraftKey } from './costDraft.ts';
import type { DraftEntriesApi } from '../../hooks/useDraftEntries.ts';
import type { SecondaryCategory, YearMonth } from '../../types/bill.ts';

const NEW_CATEGORY_NAME = '새 카테고리';
const NEW_ITEM_NAME = '새 항목';

interface SecondaryEditorProps {
  db: Firestore;
  uid: string;
  yearMonth: YearMonth;
  categories: readonly SecondaryCategory[];
  canEdit: boolean;
  drafts: DraftEntriesApi;
}

type PendingDelete = { kind: 'category'; categoryId: string; name: string } | { kind: 'item'; categoryId: string; itemId: string; name: string };

const newId = () => crypto.randomUUID();

export function SecondaryEditor({ db, uid, yearMonth, categories, canEdit, drafts }: SecondaryEditorProps) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 추가·삭제처럼 입력 칸이 없는 변경 저장 — 실패하면 메시지 표시 */
  const apply = async (mutate: (latest: SecondaryCategory[]) => SecondaryCategory[]): Promise<string | null> => {
    const result = await updateSecondary(db, yearMonth, mutate, uid);
    const message = result.ok ? null : result.message;
    setError(message);
    return message;
  };

  /** 입력 칸 저장 — 임시저장과 함께 (G3) */
  const applyField = (key: string, mutate: (latest: SecondaryCategory[]) => SecondaryCategory[]) =>
    drafts.commit(key, updateSecondary(db, yearMonth, mutate, uid));

  const mapCategory = (categoryId: string, update: (category: SecondaryCategory) => SecondaryCategory) => (latest: SecondaryCategory[]) =>
    latest.map((category) => (category.id === categoryId ? update(category) : category));

  const confirmDelete = async () => {
    if (!pending) return;
    const target = pending;
    setPending(null);
    await apply((latest) =>
      target.kind === 'category'
        ? latest.filter((category) => category.id !== target.categoryId)
        : mapCategory(target.categoryId, (category) => ({ ...category, items: category.items.filter((item) => item.id !== target.itemId) }))(latest),
    );
  };

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <section key={category.id} className="rounded-xl border-2 border-slate-300 bg-white p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex-1">
              <TextInput
                id={`category-${category.id}`}
                label="카테고리 이름"
                value={category.name}
                disabled={!canEdit}
                draft={drafts.entries[costDraftKey.categoryName(category.id)]}
                onDraft={(text) => drafts.set(costDraftKey.categoryName(category.id), text)}
                onCommit={(name) => applyField(costDraftKey.categoryName(category.id), mapCategory(category.id, (latest) => ({ ...latest, name })))}
              />
            </div>
            <span className="text-xl font-bold tabular-nums">{formatWon(sum(category.items.map((item) => item.amount)))}</span>
            {canEdit && (
              <button type="button" aria-label={`${category.name} 카테고리 삭제`} onClick={() => setPending({ kind: 'category', categoryId: category.id, name: category.name })} className="rounded-lg border-2 border-red-700 p-2 text-red-700 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200">
                <Trash2 className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="space-y-3 pl-4">
            {category.items.map((item) => (
              <li key={item.id} className="grid grid-cols-[1fr_16rem_auto] items-end gap-3">
                <TextInput
                  id={`item-name-${item.id}`}
                  label="항목 이름"
                  value={item.name}
                  disabled={!canEdit}
                  draft={drafts.entries[costDraftKey.itemName(item.id)]}
                  onDraft={(text) => drafts.set(costDraftKey.itemName(item.id), text)}
                  onCommit={(name) =>
                    applyField(
                      costDraftKey.itemName(item.id),
                      mapCategory(category.id, (latest) => ({ ...latest, items: latest.items.map((it) => (it.id === item.id ? { ...it, name } : it)) })),
                    )
                  }
                />
                <MoneyInput
                  id={`item-amount-${item.id}`}
                  label={`${item.name} 금액`}
                  value={item.amount}
                  disabled={!canEdit}
                  draft={drafts.entries[costDraftKey.itemAmount(item.id)]}
                  onDraft={(text) => drafts.set(costDraftKey.itemAmount(item.id), text)}
                  onCommit={(amount) =>
                    applyField(
                      costDraftKey.itemAmount(item.id),
                      mapCategory(category.id, (latest) => ({ ...latest, items: latest.items.map((it) => (it.id === item.id ? { ...it, amount } : it)) })),
                    )
                  }
                />
                {canEdit ? (
                  <button type="button" aria-label={`${item.name} 항목 삭제`} onClick={() => setPending({ kind: 'item', categoryId: category.id, itemId: item.id, name: item.name })} className="mb-1 rounded-lg border-2 border-red-700 p-2 text-red-700 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200">
                    <Trash2 className="h-6 w-6" aria-hidden="true" />
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <BigButton
              variant="secondary"
              className="mt-3 ml-4"
              icon={<Plus className="h-6 w-6" aria-hidden="true" />}
              onClick={() => void apply(mapCategory(category.id, (latest) => ({ ...latest, items: [...latest.items, { id: newId(), name: NEW_ITEM_NAME, amount: 0 }] })))}
            >
              항목 추가
            </BigButton>
          )}
        </section>
      ))}
      {canEdit && (
        <BigButton
          variant="secondary"
          icon={<Plus className="h-6 w-6" aria-hidden="true" />}
          onClick={() => void apply((latest) => [...latest, { id: newId(), name: NEW_CATEGORY_NAME, items: [] }])}
        >
          카테고리 추가
        </BigButton>
      )}
      {error && (
        <p role="alert" className="text-lg font-semibold text-red-700">
          {error}
        </p>
      )}
      {pending && (
        <ConfirmDialog title={`"${pending.name}" 삭제`} confirmLabel="삭제" danger onConfirm={() => void confirmDelete()} onCancel={() => setPending(null)}>
          <p>{pending.kind === 'category' ? '카테고리와 그 안의 항목이 모두 지워집니다.' : '이 항목을 지웁니다.'}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
