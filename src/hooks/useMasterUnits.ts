import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { loadMasterUnits } from '../services/firestore/masterRepo.ts';
import { LOADING, type Loadable } from './loadable.ts';
import type { Unit } from '../types/bill.ts';

/** 부과 단위 마스터 — 없으면 관리자일 때 만들어 저장, 관리소장은 null (D-5) */
export function useMasterUnits(db: Firestore, canCreate: boolean): Loadable<Unit[] | null> {
  const [state, setState] = useState<Loadable<Unit[] | null>>(LOADING);

  useEffect(() => {
    let active = true;
    void loadMasterUnits(db, canCreate).then((result) => {
      if (!active) return;
      setState(result.ok ? { status: 'ready', value: result.value } : { status: 'error', message: result.message });
    });
    return () => {
      active = false;
    };
  }, [db, canCreate]);

  return state;
}
