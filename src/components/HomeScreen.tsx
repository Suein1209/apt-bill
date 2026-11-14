import type { Auth } from 'firebase/auth';
import { APP_TITLE } from '../constants/authMessages.ts';
import { ROLE_LABELS } from '../constants/messages.ts';
import { LogoutButton } from './LogoutButton.tsx';
import type { UserDoc } from '../types/bill.ts';

interface HomeScreenProps {
  auth: Auth;
  profile: UserDoc;
}

/** 로그인 후 임시 첫 화면 — 월 홈(module-3)이 들어올 자리 */
export function HomeScreen({ auth, profile }: HomeScreenProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b-2 border-slate-300 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold">{APP_TITLE}</h1>
        <div className="flex items-center gap-4">
          <span className="text-lg text-slate-800">
            {profile.displayName} <span className="font-semibold">({ROLE_LABELS[profile.role]})</span>
          </span>
          <LogoutButton auth={auth} />
        </div>
      </header>
    </div>
  );
}
