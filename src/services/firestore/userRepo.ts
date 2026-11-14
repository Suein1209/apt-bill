import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { COLLECTION } from '../../constants/firestore.ts';
import { invalidData, ok, toFailure, type Result } from '../result.ts';
import { parseUserDoc } from './parse.ts';
import type { UserDoc } from '../../types/bill.ts';

/**
 * 로그인한 계정의 역할 (U-5). 문서가 없으면 null = 등록되지 않은 계정 (U-4)
 */
export async function getUserProfile(db: Firestore, uid: string): Promise<Result<UserDoc | null>> {
  try {
    const snapshot = await getDoc(doc(db, COLLECTION.users, uid));
    if (!snapshot.exists()) return ok(null);
    const profile = parseUserDoc(snapshot.data());
    return profile ? ok(profile) : invalidData();
  } catch (error: unknown) {
    return toFailure(error);
  }
}
