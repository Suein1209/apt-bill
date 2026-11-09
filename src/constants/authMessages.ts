/** Firebase Auth 오류 코드 → 사용자에게 보여줄 한국어 안내 */
export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
  'auth/missing-password': '비밀번호를 입력해 주세요.',
  'auth/user-disabled': '사용이 중지된 계정입니다. 관리자에게 문의해 주세요.',
  'auth/too-many-requests': '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인이 꺼져 있습니다.',
  'auth/invalid-api-key': 'Firebase API 키가 올바르지 않습니다. .env 파일을 확인해 주세요.',
};

export const AUTH_FALLBACK_MESSAGE = '로그인 중 문제가 발생했습니다. 다시 시도해 주세요.';
export const LOGOUT_FAILED_MESSAGE = '로그아웃하지 못했습니다. 다시 시도해 주세요.';

export const APP_TITLE = '서소문 아파트';
