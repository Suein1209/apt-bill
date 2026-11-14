/**
 * 서비스 결과 — 예외를 던지지 않고 Result 로 돌려준다 (Design §6.2)
 */
import { FirebaseError } from 'firebase/app';
import { FIRESTORE_ERROR_MESSAGES, FIRESTORE_FALLBACK_MESSAGE, INVALID_DATA_MESSAGE } from '../constants/messages.ts';

export type Failure = { ok: false; code: string; message: string };
export type Result<T> = { ok: true; value: T } | Failure;

export const INVALID_DATA_CODE = 'invalid-data';

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function invalidData(): Failure {
  return { ok: false, code: INVALID_DATA_CODE, message: INVALID_DATA_MESSAGE };
}

export function toFailure(error: unknown): Failure {
  if (error instanceof FirebaseError) {
    return { ok: false, code: error.code, message: FIRESTORE_ERROR_MESSAGES[error.code] ?? FIRESTORE_FALLBACK_MESSAGE };
  }
  return { ok: false, code: 'unknown', message: FIRESTORE_FALLBACK_MESSAGE };
}
