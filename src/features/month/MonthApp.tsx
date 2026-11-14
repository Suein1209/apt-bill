/**
 * 로그인 후 화면 — 세대 마스터·현재 달·월 목록을 불러와 월 홈을 띄운다
 */
import { useState } from 'react';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { BigButton } from '../../components/BigButton.tsx';
import { LogoutButton } from '../../components/LogoutButton.tsx';
import { StatusScreen } from '../../components/StatusScreen.tsx';
import { FIRST_MONTH_MANAGER_MESSAGE, MASTER_MISSING_MESSAGE } from '../../constants/messages.ts';
import { currentCalendarMonth } from '../../domain/format.ts';
import { isYearMonth } from '../../domain/yearMonth.ts';
import { useAppConfig } from '../../hooks/useAppConfig.ts';
import { useMasterUnits } from '../../hooks/useMasterUnits.ts';
import { useMonths } from '../../hooks/useMonths.ts';
import { MonthHome } from './MonthHome.tsx';
import { NewMonthDialog } from './NewMonthDialog.tsx';
import type { UserDoc, YearMonth } from '../../types/bill.ts';

interface MonthAppProps {
  auth: Auth;
  db: Firestore;
  uid: string;
  profile: UserDoc;
}

export function MonthApp({ auth, db, uid, profile }: MonthAppProps) {
  const isAdmin = profile.role === 'admin';
  const units = useMasterUnits(db, isAdmin);
  const config = useAppConfig(db);
  const months = useMonths(db);
  const [selected, setSelected] = useState<YearMonth | null>(null);

  const failed = [units, config, months].find((state) => state.status === 'error');
  if (failed?.status === 'error')
    return (
      <StatusScreen title="자료를 불러오지 못했습니다" tone="error">
        <p>{failed.message}</p>
        <LogoutButton auth={auth} />
      </StatusScreen>
    );
  if (units.status !== 'ready' || config.status !== 'ready' || months.status !== 'ready') return <StatusScreen title="불러오는 중…" />;

  if (units.value === null)
    return (
      <StatusScreen title="세대 목록이 없습니다" tone="error">
        <p>{MASTER_MISSING_MESSAGE}</p>
        <LogoutButton auth={auth} />
      </StatusScreen>
    );

  const monthList = [...months.value.keys()].sort();
  const currentMonth = config.value?.currentMonth ?? null;

  if (monthList.length === 0) {
    return isAdmin ? (
      <FirstMonthSetup db={db} uid={uid} auth={auth} onDone={setSelected} />
    ) : (
      <StatusScreen title="시작된 달이 없습니다">
        <p>{FIRST_MONTH_MANAGER_MESSAGE}</p>
        <LogoutButton auth={auth} />
      </StatusScreen>
    );
  }

  const fallback = currentMonth && months.value.has(currentMonth) ? currentMonth : monthList.at(-1);
  const target = selected && months.value.has(selected) ? selected : fallback;
  if (!target) return <StatusScreen title="불러오는 중…" />;

  return (
    <MonthHome
      auth={auth}
      db={db}
      uid={uid}
      profile={profile}
      units={units.value}
      months={months.value}
      monthList={monthList}
      currentMonth={currentMonth}
      target={target}
      onSelectMonth={setSelected}
    />
  );
}

/** 첫 달 시작 — 관리자만 (Design §12 Q1) */
function FirstMonthSetup({ auth, db, uid, onDone }: { auth: Auth; db: Firestore; uid: string; onDone: (ym: YearMonth) => void }) {
  const [value, setValue] = useState<string>(currentCalendarMonth());
  const [confirming, setConfirming] = useState(false);
  const valid = isYearMonth(value);

  return (
    <StatusScreen title="첫 달 시작하기">
      <p>관리비를 처음 입력할 달을 고르세요.</p>
      <input
        type="month"
        aria-label="첫 달"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-lg border-2 border-slate-500 px-3 py-2 text-xl focus:outline-none focus:ring-4 focus:ring-blue-200"
      />
      <div className="flex justify-between">
        <LogoutButton auth={auth} />
        <BigButton disabled={!valid} onClick={() => setConfirming(true)}>
          시작
        </BigButton>
      </div>
      {confirming && isYearMonth(value) && (
        <NewMonthDialog db={db} uid={uid} yearMonth={value} previous={null} onDone={onDone} onCancel={() => setConfirming(false)} />
      )}
    </StatusScreen>
  );
}
