/** 입력 칸 표시 — Enter 를 누르면 다음 칸으로 이동한다 (G-1) */
export const ENTRY_ATTRIBUTE = 'data-entry';

/**
 * 다음 칸으로 이동한다. 마지막 칸이면 포커스를 빼서(blur) 저장이 일어나게 한다.
 * — 마지막 칸에서 Enter 를 눌러도 입력이 저장되도록 (미리보기 중 발견)
 */
export function focusNextEntry(current: HTMLElement): void {
  const entries = Array.from(document.querySelectorAll<HTMLElement>(`[${ENTRY_ATTRIBUTE}]:not(:disabled)`));
  const next = entries[entries.indexOf(current) + 1];
  if (next) next.focus();
  else current.blur();
}
