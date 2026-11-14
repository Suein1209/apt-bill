import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { EMULATOR } from '../constants/firestore.ts';

/** .env 키 이름 ↔ Firebase 설정 필드 매핑 */
const ENV_KEY_MAP = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const satisfies Record<string, keyof ImportMetaEnv>;

type ConfigField = keyof typeof ENV_KEY_MAP;

export type FirebaseInitResult =
  | { ok: true; app: FirebaseApp; auth: Auth; db: Firestore }
  | { ok: false; missingEnvKeys: string[] }
  | { ok: false; missingEnvKeys: []; errorMessage: string };

function readConfig(): { config: FirebaseOptions; missing: string[] } {
  const env: Partial<Record<string, string | undefined>> = import.meta.env;
  const config: Partial<Record<ConfigField, string>> = {};
  const missing: string[] = [];

  for (const [field, envKey] of Object.entries(ENV_KEY_MAP) as [ConfigField, string][]) {
    const value = env[envKey]?.trim();
    if (value) {
      config[field] = value;
    } else {
      missing.push(envKey);
    }
  }
  return { config, missing };
}

/** VITE_USE_FIREBASE_EMULATOR=true 이면 로컬 에뮬레이터에 연결 (개발·테스트용) */
function isEmulatorEnabled(): boolean {
  return import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
}

function initFirebase(): FirebaseInitResult {
  const { config, missing } = readConfig();
  if (missing.length > 0) {
    return { ok: false, missingEnvKeys: missing };
  }
  try {
    const app = initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);
    if (isEmulatorEnabled()) {
      connectAuthEmulator(auth, EMULATOR.authUrl, { disableWarnings: true });
      connectFirestoreEmulator(db, EMULATOR.host, EMULATOR.firestorePort);
    }
    return { ok: true, app, auth, db };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, missingEnvKeys: [], errorMessage: message };
  }
}

/** 앱 전체에서 한 번만 초기화되는 Firebase 인스턴스 */
export const firebase: FirebaseInitResult = initFirebase();
