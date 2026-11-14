import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { watchAppConfig } from '../services/firestore/configRepo.ts';
import { LOADING, type Loadable } from './loadable.ts';
import type { AppConfigDoc } from '../types/bill.ts';

/** config/app — 현재 달. 첫 달을 시작하기 전에는 null */
export function useAppConfig(db: Firestore): Loadable<AppConfigDoc | null> {
  const [state, setState] = useState<Loadable<AppConfigDoc | null>>(LOADING);
  useEffect(
    () =>
      watchAppConfig(db, (result) =>
        setState(result.ok ? { status: 'ready', value: result.value } : { status: 'error', message: result.message }),
      ),
    [db],
  );
  return state;
}
