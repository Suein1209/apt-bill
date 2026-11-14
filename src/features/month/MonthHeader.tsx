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
  'flex h-14 w-14 items-center justify-center rounded-xl border-2 border-slate-700 bg-white hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:border-slate-300 disabled:text-slate-300';

/** 월 이동(◀ ▶), 결산 상태, 사용자·로그아웃 */
export function MonthHeader({ auth, profile, month, prevMonth, nextMonth, onSelectMonth }: MonthHeaderProps) {
  const closed = month.status === 'closed';
  return (
    <header className="border-b-2 border-slate-300 bg-white px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{APP_TITLE} 관리비</h1>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="이전 달" className={NAV_BUTTON} disabled={!prevMonth} onClick={() => prevMonth && onSelectMonth(prevMonth)}>
            <ChevronLeft className="h-8 w-8" aria-hidden="true" />
          </button>
          <span className="min-w-44 text-center text-3xl font-bold" aria-live="polite">
            {formatYearMonth(month.yearMonth)}
          </span>
          <button type="button" aria-label="다음 달" className={NAV_BUTTON} disabled={!nextMonth} onClick={() => nextMonth && onSelectMonth(nextMonth)}>
            <ChevronRight className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg">
            {profile.displayName} <span className="font-semibold">({ROLE_LABELS[profile.role]})</span>
          </span>
          <LogoutButton auth={auth} />
        </div>
      </div>
      <p className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1 text-lg font-bold ${closed ? 'bg-slate-800 text-white' : 'bg-green-100 text-green-900'}`}>
        {closed ? (
          <>
            <Lock className="h-5 w-5" aria-hidden="true" /> 결산 완료 — 수정할 수 없습니다
          </>
        ) : (
          '입력 중'
        )}
      </p>
    </header>
  );
}
