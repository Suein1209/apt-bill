import { useState, type KeyboardEvent, type Ref } from 'react';
import { useDraftSync } from '../../components/useDraftSync.ts';

interface GridInputProps {
  label: string;
  /** 저장된 값을 화면에 보여줄 글자 */
  value: string;
  /** 임시저장된 글자 (저장 전) */
  draft: string | undefined;
  disabled: boolean;
  align?: 'left' | 'right';
  highlighted?: boolean;
  inputRef: Ref<HTMLInputElement>;
  onNavigate: (event: KeyboardEvent<HTMLInputElement>) => void;
  onDraft: (text: string) => void;
  /** 값 확정 — 실패 메시지를 돌려준다 (입력은 임시저장에 남는다) */
  onCommit: (text: string) => Promise<string | null>;
}

/** Grid 한 칸 — 입력은 즉시 임시저장, 칸을 떠날 때 저장 */
export function GridInput({ label, value, draft, disabled, align = 'right', highlighted = false, inputRef, onNavigate, onDraft, onCommit }: GridInputProps) {
  const { text, dirty, edit, setDirty } = useDraftSync(value, draft);
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    if (!dirty) return;
    const failure = await onCommit(text);
    setError(failure);
    if (!failure) setDirty(false);
  };

  return (
    <div className="flex flex-col">
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        aria-invalid={error !== null}
        title={error ?? undefined}
        value={text}
        disabled={disabled}
        inputMode={align === 'right' ? 'numeric' : 'text'}
        onChange={(event) => {
          edit(event.target.value);
          onDraft(event.target.value);
        }}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => void commit()}
        onKeyDown={onNavigate}
        className={`w-full rounded-md border-2 px-2 py-1 text-lg tabular-nums focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:border-transparent disabled:bg-transparent disabled:text-slate-500 ${
          align === 'right' ? 'text-right' : 'text-left'
        } ${error ? 'border-red-600 bg-red-50' : dirty ? 'border-amber-500 bg-amber-50' : highlighted ? 'border-purple-500 bg-purple-50' : 'border-slate-400 bg-white'}`}
      />
      {error && (
        <span role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
