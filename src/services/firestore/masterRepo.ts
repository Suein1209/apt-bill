import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { MASTER_UNITS_VERSION } from '../../constants/buildingUnits.ts';
import { COLLECTION, DOC_ID } from '../../constants/firestore.ts';
import { buildUnits } from '../../domain/units.ts';
import { invalidData, ok, toFailure, type Result } from '../result.ts';
import { parseUnits } from './parse.ts';
import type { MasterUnitsDoc, Unit } from '../../types/bill.ts';

/**
 * 부과 단위 마스터 (D-5) 불러오기.
 * 문서가 없을 때 관리자(canCreate)는 상수로 만들어 저장하고, 관리소장은 null 을 받는다.
 * Design Ref: §3.3 — master/units 는 관리자 첫 로그인 때 자동 생성
 */
export async function loadMasterUnits(db: Firestore, canCreate: boolean): Promise<Result<Unit[] | null>> {
  const ref = doc(db, COLLECTION.master, DOC_ID.masterUnits);
  try {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      const units = parseUnits(snapshot.data());
      return units ? ok(units) : invalidData();
    }
    if (!canCreate) return ok(null);

    const master: MasterUnitsDoc = {
      version: MASTER_UNITS_VERSION,
      units: buildUnits(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(ref, master);
    return ok(master.units);
  } catch (error: unknown) {
    return toFailure(error);
  }
}
