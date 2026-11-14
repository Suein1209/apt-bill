import type { UserRole } from '../types/bill.ts';

/** Firestore 오류 코드 → 사용자 안내 (Design §6.1) */
export const FIRESTORE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'permission-denied': '이 내용은 수정할 수 없습니다.',
  unavailable: '인터넷 연결을 확인해 주세요. 입력한 내용은 임시로 보관됩니다.',
  aborted: '다른 사람이 먼저 고쳤습니다. 화면을 새 내용으로 바꿨습니다.',
  'deadline-exceeded': '응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.',
  unauthenticated: '로그인이 풀렸습니다. 다시 로그인해 주세요.',
};

export const FIRESTORE_FALLBACK_MESSAGE = '저장소와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.';
export const INVALID_DATA_MESSAGE = '저장된 데이터 형식이 올바르지 않습니다. 관리자에게 문의해 주세요.';

export const UNREGISTERED_TITLE = '등록되지 않은 계정입니다';
export const UNREGISTERED_MESSAGE = '이 계정은 관리비 프로그램을 쓸 수 있도록 등록되지 않았습니다. 관리자에게 문의해 주세요.';
export const PROFILE_LOAD_FAILED_TITLE = '계정 정보를 불러오지 못했습니다';

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  admin: '관리자',
  manager: '관리소장',
};
