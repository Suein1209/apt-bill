import { useEffect, useState, type KeyboardEvent } from 'react';
import { formatNumber, parseAmountInput } from '../domain/format.ts';
import { isValidAmount } from '../domain/money.ts';
import { ENTRY_ATTRIBUTE, focusNextEntry } from './entryFocus.ts';
import { INVALID_AMOUNT_MESSAGE } from '../constants/messages.ts';
import type { Won } from '../types/bill.ts';

interface MoneyInputProps {
  id: string;
  label: string;
  value: Won;
  disabled?: boolean;
  /** 값이 바뀌어 확정될 때(Enter·포커스 이동). 실패 메시지를 돌려주면 입력값을 되돌린다 */
  onCommit: (amount: Won) => Promise<string | null>;
}

/** 금액 입력 — 쉼표 표시, 0 이상 정수만, Enter 로 다음 칸 */
export function MoneyInput({ id, label, value, disabled = false, onCommit }: MoneyInputProps) {
  const [text, setText] = useState(formatNumber(value));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 다른 사람이 바꾼 값이 실시간으로 들어오면 반영
  useEffect(() => setText(formatNumber(value)), [value]);

  const commit = async () => {
    const amount = parseAmountInput(text) ?? 0;
    if (!isValidAmount(amount)) {
      setError(INVALID_AMOUNT_MESSAGE);
      setText(formatNumber(value));
      return;
    }
    setText(formatNumber(amount));
    if (amount === value) return;
    setSaving(true);
    const failure = await onCommit(amount);
    setSaving(false);
    setError(failure);
    if (failure) setText(formatNumber(value));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      focusNextEntry(event.currentTarget);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-lg font-semibold text-slate-900">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          {...{ [ENTRY_ATTRIBUTE]: '' }}
          type="text"
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={() => void commit()}
          onKeyDown={handleKeyDown}
          aria-invalid={error !== null}
          className="w-full rounded-lg border-2 border-slate-500 bg-white px-3 py-2 text-right text-xl font-semibold tabular-nums focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-600"
        />
        <span className="text-xl">원</span>
      </div>
      {saving && <span className="text-base text-slate-600">저장 중…</span>}
      {error && (
        <span role="alert" className="text-base font-semibold text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
