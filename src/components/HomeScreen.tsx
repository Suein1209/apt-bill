import { useState } from 'react';
import { signOut, type Auth, type User } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { APP_TITLE, LOGOUT_FAILED_MESSAGE } from '../constants/authMessages.ts';

interface HomeScreenProps {
  auth: Auth;
  user: User;
}

/** 로그인 후 임시 첫 화면 — 관리비 입력 Grid 가 들어올 자리 */
export function HomeScreen({ auth, user }: HomeScreenProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    setErrorMessage(null);
    try {
      await signOut(auth);
    } catch {
      setErrorMessage(LOGOUT_FAILED_MESSAGE);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b-2 border-slate-300 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold">{APP_TITLE}</h1>
        <div className="flex items-center gap-4">
          <span className="text-lg text-slate-800">{user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border-2 border-slate-700 px-4 py-2 text-lg font-semibold hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            <LogOut className="h-6 w-6" aria-hidden="true" />
            로그아웃
          </button>
        </div>
      </header>
      {errorMessage && (
        <p role="alert" className="m-6 rounded-lg border-2 border-red-700 bg-red-50 px-4 py-3 text-lg font-semibold text-red-800">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
