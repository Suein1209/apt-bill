/** 입력 칸 표시 — Enter 를 누르면 다음 칸으로 이동한다 (G-1) */
export const ENTRY_ATTRIBUTE = 'data-entry';

export function focusNextEntry(current: HTMLElement): void {
  const entries = Array.from(document.querySelectorAll<HTMLElement>(`[${ENTRY_ATTRIBUTE}]:not(:disabled)`));
  const next = entries[entries.indexOf(current) + 1];
  next?.focus();
}
