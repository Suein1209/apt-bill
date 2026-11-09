import { useEffect, useState } from 'react';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User }
  | { status: 'error'; message: string };

/** Firebase 로그인 상태 구독 (새로고침해도 로그인 유지) */
export function useAuth(auth: Auth): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => setState(user ? { status: 'signedIn', user } : { status: 'signedOut' }),
      (error) => setState({ status: 'error', message: error.message }),
    );
    return unsubscribe;
  }, [auth]);

  return state;
}
