/** Firestore 경로 (Design §3.3) */
export const COLLECTION = {
  users: 'users',
  config: 'config',
  master: 'master',
  months: 'months',
  payments: 'payments',
} as const;

export const DOC_ID = {
  appConfig: 'app',
  masterUnits: 'units',
} as const;

/** 로컬 에뮬레이터 (firebase.json 과 같은 값) */
export const EMULATOR = {
  host: '127.0.0.1',
  firestorePort: 8080,
  authUrl: 'http://127.0.0.1:9099',
} as const;
