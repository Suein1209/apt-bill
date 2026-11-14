import { doc, onSnapshot, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { COLLECTION, DOC_ID } from '../../constants/firestore.ts';
import { invalidData, ok, toFailure, type Result } from '../result.ts';
import { parseAppConfig } from './parse.ts';
import type { AppConfigDoc, YearMonth } from '../../types/bill.ts';

const appConfigRef = (db: Firestore) => doc(db, COLLECTION.config, DOC_ID.appConfig);

/** config/app 구독 — 문서가 없으면 null (아직 첫 달을 시작하지 않음) */
export function watchAppConfig(db: Firestore, onChange: (result: Result<AppConfigDoc | null>) => void): Unsubscribe {
  return onSnapshot(
    appConfigRef(db),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(ok(null));
        return;
      }
      const config = parseAppConfig(snapshot.data());
      onChange(config ? ok(config) : invalidData());
    },
    (error) => onChange(toFailure(error)),
  );
}

/** 현재 달 변경 — 관리자 전용, 새 달 시작에서 사용 (Design §12 Q1) */
export async function setCurrentMonth(db: Firestore, currentMonth: YearMonth): Promise<Result<void>> {
  try {
    const config: AppConfigDoc = { currentMonth };
    await setDoc(appConfigRef(db), config);
    return ok(undefined);
  } catch (error: unknown) {
    return toFailure(error);
  }
}
