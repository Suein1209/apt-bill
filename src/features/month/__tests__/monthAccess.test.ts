import { describe, expect, it } from 'vitest';
import { makeMonth } from '../../../domain/__tests__/fixtures.ts';
import { monthAccess } from '../monthAccess.ts';

describe('화면 수정 가능 여부 — 보안 규칙과 같은 조건 (U-7, U-15, D-6)', () => {
  const open = makeMonth('2026-10');
  const closed = makeMonth('2026-09', { status: 'closed' });
  const current = makeMonth('2026-11');

  it('관리자는 결산 전이면 지난 달도 수정', () => {
    expect(monthAccess(open, 'admin', '2026-11').canEdit).toBe(true);
  });

  it('관리소장은 현재 달만 수정', () => {
    expect(monthAccess(current, 'manager', '2026-11').canEdit).toBe(true);
    expect(monthAccess(open, 'manager', '2026-11')).toMatchObject({ canEdit: false });
  });

  it('결산된 달은 아무도 수정 못 함', () => {
    expect(monthAccess(closed, 'admin', '2026-11').canEdit).toBe(false);
    expect(monthAccess(closed, 'manager', '2026-09').canEdit).toBe(false);
  });
});
