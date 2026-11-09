import { FirebaseError } from 'firebase/app';
import { AUTH_ERROR_MESSAGES, AUTH_FALLBACK_MESSAGE } from '../constants/authMessages.ts';

export function toAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERROR_MESSAGES[error.code] ?? AUTH_FALLBACK_MESSAGE;
  }
  return AUTH_FALLBACK_MESSAGE;
}
