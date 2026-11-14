import { useState } from 'react';
import { signOut, type Auth } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { LOGOUT_FAILED_MESSAGE } from '../constants/authMessages.ts';

interface LogoutButtonProps {
  auth: Auth;
}

export function LogoutButton({ auth }: LogoutButtonProps) {
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
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg border-2 border-slate-700 px-4 py-2 text-lg font-semibold hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        <LogOut className="h-6 w-6" aria-hidden="true" />
        로그아웃
      </button>
      {errorMessage && (
        <p role="alert" className="rounded-lg border-2 border-red-700 bg-red-50 px-3 py-2 text-lg font-semibold text-red-800">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
