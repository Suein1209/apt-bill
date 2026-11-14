import { useState, type KeyboardEvent } from 'react';
import { ENTRY_ATTRIBUTE, focusNextEntry } from './entryFocus.ts';
import { useDraftSync } from './useDraftSync.ts';

interface TextInputProps {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  /** 임시저장된 글자 (D-2) */
  draft?: string | undefined;
  onDraft?: (text: string) => void;
  /** 바뀐 값 확정. 실패 메시지를 돌려준다 — 입력은 임시저장에 남는다 */
  onCommit: (text: string) => Promise<string | null>;
}

/** 이름 입력 — 빈 값은 저장하지 않는다, Enter 로 다음 칸 */
export function TextInput({ id, label, value, disabled = false, placeholder = '', draft, onDraft, onCommit }: TextInputProps) {
  const { text, dirty, edit, setText, setDirty } = useDraftSync(value, draft);
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    if (!dirty) return;
    const trimmed = text.trim();
    if (trimmed === '' || trimmed === value) {
      setText(value);
      setDirty(false);
      return;
    }
    const failure = await onCommit(trimmed);
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
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        {...{ [ENTRY_ATTRIBUTE]: '' }}
        type="text"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          edit(event.target.value);
          onDraft?.(event.target.value);
        }}
        onBlur={() => void commit()}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-lg border-2 px-3 py-2 text-xl focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-600 ${
          error ? 'border-red-600 bg-red-50' : dirty ? 'border-amber-500 bg-amber-50' : 'border-slate-500 bg-white'
        }`}
      />
      {error && (
        <span role="alert" className="text-base font-semibold text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
