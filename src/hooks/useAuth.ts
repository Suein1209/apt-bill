import { useEffect, useState } from 'react';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getUserProfile } from '../services/firestore/userRepo.ts';
import type { UserDoc } from '../types/bill.ts';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; profile: UserDoc }
  /** 로그인은 됐지만 users/{uid} 역할 문서가 없는 계정 (U-4) */
  | { status: 'unregistered'; user: User }
  | { status: 'error'; message: string };

/** Firebase 로그인 상태 + 역할 구독 (새로고침해도 로그인 유지) */
export function useAuth(auth: Auth, db: Firestore): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    // 로그인 상태가 빠르게 바뀔 때 늦게 도착한 역할 조회 결과를 버리기 위한 표시
    let latestUid: string | null = null;

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        latestUid = user?.uid ?? null;
        if (!user) {
          setState({ status: 'signedOut' });
          return;
        }
        setState({ status: 'loading' });
        void getUserProfile(db, user.uid).then((result) => {
          if (latestUid !== user.uid) return;
          if (!result.ok) {
            setState({ status: 'error', message: result.message });
          } else if (result.value === null) {
            setState({ status: 'unregistered', user });
          } else {
            setState({ status: 'signedIn', user, profile: result.value });
          }
        });
      },
      (error) => setState({ status: 'error', message: error.message }),
    );
    return () => {
      latestUid = null;
      unsubscribe();
    };
  }, [auth, db]);

  return state;
}
