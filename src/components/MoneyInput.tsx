import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { formatNumber, parseAmountInput, parseUsageInput } from '../domain/format.ts';
import { isValidAmount } from '../domain/money.ts';
import { ENTRY_ATTRIBUTE, focusNextEntry } from './entryFocus.ts';
import { useDraftSync } from './useDraftSync.ts';
import { INVALID_AMOUNT_MESSAGE, INVALID_USAGE_MESSAGE } from '../constants/messages.ts';
import type { Won } from '../types/bill.ts';

interface CommonProps {
  id: string;
  label: string;
  /** 라벨을 화면에서 숨기고 화면 읽기 프로그램에만 알린다 — 한 줄에 칸을 여럿 둘 때 */
  labelHidden?: boolean;
  disabled?: boolean;
  /** 임시저장된 글자 (D-2) */
  draft?: string | undefined;
  onDraft?: (text: string) => void;
  /** 칸 아래 안내 (세대당 금액 등) */
  hint?: ReactNode;
}

interface NumericInputProps extends CommonProps {
  /** 저장된 값을 화면 글자로 */
  valueText: string;
  unit: string;
  inputMode: 'numeric' | 'decimal';
  /** 입력 글자를 값으로 — 잘못된 입력이면 null */
  parse: (text: string) => number | null;
  format: (value: number) => string;
  invalidMessage: string;
  onCommit: (value: number) => Promise<string | null>;
}

/** 숫자 입력 — 오른쪽 정렬, 단위 표시, Enter 로 다음 칸, 포커스를 떠날 때 저장 */
function NumericInput({
  id,
  label,
  labelHidden = false,
  disabled = false,
  draft,
  onDraft,
  hint,
  valueText,
  unit,
  inputMode,
  parse,
  format,
  invalidMessage,
  onCommit,
}: NumericInputProps) {
  const { text, dirty, edit, setText, setDirty } = useDraftSync(valueText, draft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    if (!dirty) return;
    const value = parse(text);
    if (value === null) {
      setError(invalidMessage);
      return;
    }
    setText(format(value));
    setSaving(true);
    const failure = await onCommit(value);
    setSaving(false);
    setError(failure);
    if (!failure) setDirty(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      focusNextEntry(event.currentTarget);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'text-lg font-semibold text-slate-900'}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          {...{ [ENTRY_ATTRIBUTE]: '' }}
          type="text"
          inputMode={inputMode}
          value={text}
          disabled={disabled}
          onChange={(event) => {
            edit(event.target.value);
            onDraft?.(event.target.value);
          }}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={() => void commit()}
          onKeyDown={handleKeyDown}
          aria-invalid={error !== null}
          className={`w-full rounded-lg border-2 px-3 py-2 text-right text-xl font-semibold tabular-nums focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-600 ${
            error ? 'border-red-600 bg-red-50' : dirty ? 'border-amber-500 bg-amber-50' : 'border-slate-500 bg-white'
          }`}
        />
        <span className="whitespace-nowrap text-xl">{unit}</span>
      </div>
      {hint && <span className="text-lg text-slate-700">{hint}</span>}
      {saving && <span className="text-base text-slate-600">저장 중…</span>}
      {error && (
        <span role="alert" className="text-base font-semibold text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

const parseWon = (text: string): Won | null => {
  const amount = parseAmountInput(text) ?? 0;
  return isValidAmount(amount) ? amount : null;
};

interface MoneyInputProps extends CommonProps {
  value: Won;
  /** 값 확정(Enter·포커스 이동). 실패 메시지를 돌려준다 — 입력은 임시저장에 남는다 */
  onCommit: (amount: Won) => Promise<string | null>;
}

/** 금액 입력 — 쉼표 표시, 0 이상 정수만 */
export function MoneyInput({ value, onCommit, ...rest }: MoneyInputProps) {
  return (
    <NumericInput
      {...rest}
      valueText={formatNumber(value)}
      unit="원"
      inputMode="numeric"
      parse={parseWon}
      format={formatNumber}
      invalidMessage={INVALID_AMOUNT_MESSAGE}
      onCommit={onCommit}
    />
  );
}

interface UsageInputProps extends CommonProps {
  /** 입력하지 않았으면 null (빈칸) */
  value: number | null;
  onCommit: (usage: number) => Promise<string | null>;
}

/** 사용량(리터) 입력 — 0 이상, 소수 첫째 자리까지 */
export function UsageInput({ value, onCommit, ...rest }: UsageInputProps) {
  return (
    <NumericInput
      {...rest}
      valueText={value === null ? '' : String(value)}
      unit="리터"
      inputMode="decimal"
      parse={parseUsageInput}
      format={String}
      invalidMessage={INVALID_USAGE_MESSAGE}
      onCommit={onCommit}
    />
  );
}
