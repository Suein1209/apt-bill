/**
 * 월 홈 — 월 이동, 합계, 동 버튼, 새 달 시작·결산 (Design §5.1, §5.4 홈)
 */
import { useState } from 'react';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { CalendarPlus, Calculator, Printer } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { StatusScreen } from '../../components/StatusScreen.tsx';
import { formatWon } from '../../domain/format.ts';
import { nextYearMonth } from '../../domain/yearMonth.ts';
import { useMonthBills } from '../../hooks/useMonthBills.ts';
import { CloseMonthButton } from './CloseMonthButton.tsx';
import { DongButtonGrid } from './DongButtonGrid.tsx';
import { MonthHeader } from './MonthHeader.tsx';
import { NewMonthDialog } from './NewMonthDialog.tsx';
import { monthAccess } from './monthAccess.ts';
import { CostEntryScreen } from '../cost/CostEntryScreen.tsx';
import { UnitGrid } from '../entry/UnitGrid.tsx';
import { NoticeScreen } from '../print/NoticeScreen.tsx';
import { PaymentSheetView, type SheetMode } from '../print/PaymentSheetView.tsx';
import { PrintMenuDialog } from '../print/PrintMenuDialog.tsx';
import { unitsInDong } from '../../domain/units.ts';
import type { MonthMap } from '../../services/firestore/monthRepo.ts';
import type { Unit, UserDoc, YearMonth } from '../../types/bill.ts';

type View = { kind: 'home' } | { kind: 'cost' } | { kind: 'dong'; dong: number } | { kind: 'print'; mode: SheetMode } | { kind: 'notice' };

interface MonthHomeProps {
  auth: Auth;
  db: Firestore;
  uid: string;
  profile: UserDoc;
  units: readonly Unit[];
  months: MonthMap;
  monthList: readonly YearMonth[];
  currentMonth: YearMonth | null;
  target: YearMonth;
  onSelectMonth: (ym: YearMonth) => void;
}

export function MonthHome({ auth, db, uid, profile, units, months, monthList, currentMonth, target, onSelectMonth }: MonthHomeProps) {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [startingMonth, setStartingMonth] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const state = useMonthBills(db, units, months, target);
  const isAdmin = profile.role === 'admin';

  if (state.status === 'loading') return <StatusScreen title="불러오는 중…" />;
  if (state.status === 'error')
    return (
      <StatusScreen title="이 달 자료를 불러오지 못했습니다" tone="error">
        <p>{state.message}</p>
      </StatusScreen>
    );

  const { month, bills, summary } = state.value;
  const access = monthAccess(month, profile.role, currentMonth);
  const index = monthList.indexOf(target);
  const latest = monthList.at(-1);

  if (view.kind === 'cost') {
    return <CostEntryScreen db={db} uid={uid} month={month} summary={summary} access={access} onBack={() => setView({ kind: 'home' })} />;
  }
  if (view.kind === 'print') {
    return <PaymentSheetView mode={view.mode} yearMonth={month.yearMonth} units={units} bills={bills} onClose={() => setView({ kind: 'home' })} />;
  }
  if (view.kind === 'notice') {
    return <NoticeScreen month={month} units={units} bills={bills} targetCount={summary.targetCount} onClose={() => setView({ kind: 'home' })} />;
  }
  if (view.kind === 'dong') {
    return (
      <UnitGrid
        db={db}
        uid={uid}
        role={profile.role}
        dong={view.dong}
        month={month}
        units={unitsInDong(units, view.dong)}
        bills={bills}
        payments={state.value.payments}
        access={access}
        onBack={() => setView({ kind: 'home' })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <MonthHeader
        auth={auth}
        profile={profile}
        month={month}
        prevMonth={monthList[index - 1] ?? null}
        nextMonth={monthList[index + 1] ?? null}
        onSelectMonth={onSelectMonth}
      />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {access.reason && (
          <p role="status" className="rounded-lg border-2 border-amber-700 bg-amber-50 px-4 py-3 text-lg font-semibold text-amber-900">
            {access.reason}
          </p>
        )}

        {/* 이번 달 비용 요약 — 큰 숫자 세 개 + 비용 입력 버튼 (시안 A) */}
        <section aria-label="이번 달 비용" className="card flex flex-wrap items-center gap-5 p-6">
          <SummaryStat label="공용 비용" value={formatWon(summary.primaryTotal)} />
          <SummaryStat label="유지비 지출" value={formatWon(summary.secondaryTotal)} divided />
          <SummaryStat label="세대당 금액" value={formatWon(summary.perUnitShare)} divided accent />
          <BigButton icon={<Calculator className="h-7 w-7" aria-hidden="true" />} onClick={() => setView({ kind: 'cost' })}>
            {access.canEdit ? '이번 달 비용 입력' : '비용 보기'}
          </BigButton>
        </section>

        <section aria-labelledby="dong-title" className="space-y-3">
          <h2 id="dong-title" className="text-2xl font-bold">
            동별 입력
          </h2>
          <DongButtonGrid units={units} bills={bills} onSelectDong={(dong) => setView({ kind: 'dong', dong })} />
        </section>

        {/* 맨 아래 — 새 달 시작·결산(관리자), 출력(모두) */}
        <section className="flex flex-wrap gap-4 pt-2">
          {isAdmin && target === latest && (
            <BigButton variant="secondary" icon={<CalendarPlus className="h-6 w-6" aria-hidden="true" />} onClick={() => setStartingMonth(true)}>
              새 달 시작
            </BigButton>
          )}
          {isAdmin && <CloseMonthButton db={db} uid={uid} month={month} bills={bills} />}
          <BigButton variant="secondary" icon={<Printer className="h-6 w-6" aria-hidden="true" />} onClick={() => setPrintMenuOpen(true)}>
            출력
          </BigButton>
        </section>
      </main>

      {printMenuOpen && (
        <PrintMenuDialog
          onSelect={(mode) => {
            setPrintMenuOpen(false);
            setView(mode === 'notice' ? { kind: 'notice' } : { kind: 'print', mode });
          }}
          onCancel={() => setPrintMenuOpen(false)}
        />
      )}

      {startingMonth && latest && (
        <NewMonthDialog
          db={db}
          uid={uid}
          yearMonth={nextYearMonth(latest)}
          previous={months.get(latest) ?? null}
          previousBills={month.yearMonth === latest ? bills : null}
          onDone={(ym) => {
            setStartingMonth(false);
            onSelectMonth(ym);
          }}
          onCancel={() => setStartingMonth(false)}
        />
      )}
    </div>
  );
}

interface SummaryStatProps {
  label: string;
  value: string;
  /** 왼쪽에 옅은 구분선 */
  divided?: boolean;
  /** 강조 색(세대당 금액) */
  accent?: boolean;
}

/** 홈 비용 요약의 숫자 하나 */
function SummaryStat({ label, value, divided = false, accent = false }: SummaryStatProps) {
  return (
    <div className={`flex min-w-48 flex-1 flex-col gap-1 px-2 ${divided ? 'sm:border-l sm:border-line sm:pl-5' : ''}`}>
      <span className="text-lg text-slate-600">{label}</span>
      <strong className={`text-3xl font-extrabold tabular-nums ${accent ? 'text-brand' : ''}`}>{value}</strong>
    </div>
  );
}
