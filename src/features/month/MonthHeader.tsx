import type { Auth } from 'firebase/auth';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { APP_TITLE } from '../../constants/authMessages.ts';
import { ROLE_LABELS } from '../../constants/messages.ts';
import { formatYearMonth } from '../../domain/format.ts';
import { LogoutButton } from '../../components/LogoutButton.tsx';
import type { MonthDoc, UserDoc, YearMonth } from '../../types/bill.ts';

interface MonthHeaderProps {
  auth: Auth;
  profile: UserDoc;
  month: MonthDoc;
  prevMonth: YearMonth | null;
  nextMonth: YearMonth | null;
  onSelectMonth: (ym: YearMonth) => void;
}

const NAV_BUTTON =
  'flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:text-slate-300';

/** 월 이동(◀ ▶), 결산 상태, 사용자·로그아웃 — 시안 A: 왼쪽 달·상태, 오른쪽 사용자 */
export function MonthHeader({ auth, profile, month, prevMonth, nextMonth, onSelectMonth }: MonthHeaderProps) {
  const closed = month.status === 'closed';
  return (
    <header className="app-bar">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-medium text-slate-600">{APP_TITLE} 관리비</h1>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" aria-label="이전 달" className={NAV_BUTTON} disabled={!prevMonth} onClick={() => prevMonth && onSelectMonth(prevMonth)}>
              <ChevronLeft className="h-7 w-7" aria-hidden="true" />
            </button>
            <span className="text-center text-3xl font-extrabold" aria-live="polite">
              {formatYearMonth(month.yearMonth)}
            </span>
            <button type="button" aria-label="다음 달" className={NAV_BUTTON} disabled={!nextMonth} onClick={() => nextMonth && onSelectMonth(nextMonth)}>
              <ChevronRight className="h-7 w-7" aria-hidden="true" />
            </button>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-base font-bold ${closed ? 'bg-slate-800 text-white' : 'bg-brand-soft text-brand'}`}>
              {closed ? (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" /> 결산 완료 — 수정할 수 없습니다
                </>
              ) : (
                '입력 중'
              )}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-lg text-slate-700">
            {profile.displayName} <span className="font-semibold text-slate-900">({ROLE_LABELS[profile.role]})</span>
          </span>
          <LogoutButton auth={auth} />
        </div>
      </div>
    </header>
  );
}
