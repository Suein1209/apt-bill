import { useEffect, useRef, useState } from 'react';

/**
 * 입력 칸의 글자·고침 상태를 임시저장과 맞춘다 (G2)
 * - 처음에는 임시저장 글자가 있으면 그것을 보여준다
 * - 임시저장이 사라지면(저장 성공, 버리기, 권한 오류) 저장된 값으로 되돌린다
 * - 고치는 중이 아니면 다른 사람이 바꾼 값을 실시간으로 반영한다
 */
export function useDraftSync(value: string, draft: string | undefined) {
  const [text, setText] = useState(draft ?? value);
  const [dirty, setDirty] = useState(draft !== undefined && draft !== value);
  const hadDraft = useRef(draft !== undefined);

  useEffect(() => {
    if (hadDraft.current && draft === undefined) {
      setDirty(false);
      setText(value);
    }
    hadDraft.current = draft !== undefined;
  }, [draft, value]);

  useEffect(() => {
    if (!dirty) setText(value);
  }, [value, dirty]);

  const edit = (next: string) => {
    setText(next);
    setDirty(true);
  };

  return { text, dirty, edit, setText, setDirty };
}
