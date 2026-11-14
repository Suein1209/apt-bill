/**
 * Firestore 보안 규칙 테스트 — Design §8.3 (L1: Rules)
 * 실행: npm run test:rules  (Firestore 에뮬레이터를 띄운 뒤 실행)
 */
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-apt-bill';
const CURRENT = '2026-11';
const PREVIOUS = '2026-10';
const CLOSED = '2026-09';

const ADMIN = 'admin-uid';
const MANAGER = 'manager-uid';
const STRANGER = 'stranger-uid';

let env: RulesTestEnvironment;

function month(status: 'open' | 'closed') {
  return {
    status,
    primaryCosts: { labor: 0, commonElectricity: 0, commonWater: 0, maintenance: 0 },
    secondaryCategories: [],
    vacant: {},
    water: {},
    overrides: {},
    notice: '',
    closing: status === 'closed' ? { closedAt: 't', closedBy: ADMIN, unpaid: {} } : null,
    updatedAt: 't',
    updatedBy: ADMIN,
  };
}

function payment(paidAmount: number, confirmed: boolean) {
  return {
    paidAmount,
    paidDate: '2026-11-10',
    confirmed,
    confirmedBy: confirmed ? ADMIN : null,
    confirmedAt: confirmed ? 't' : null,
    updatedAt: 't',
    updatedBy: MANAGER,
  };
}

const db = (uid: string | null) =>
  uid === null ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uid).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const store = context.firestore();
    await setDoc(doc(store, 'users', ADMIN), { role: 'admin', displayName: '아버님' });
    await setDoc(doc(store, 'users', MANAGER), { role: 'manager', displayName: '관리소장' });
    await setDoc(doc(store, 'config', 'app'), { currentMonth: CURRENT });
    await setDoc(doc(store, 'months', CURRENT), month('open'));
    await setDoc(doc(store, 'months', PREVIOUS), month('open'));
    await setDoc(doc(store, 'months', CLOSED), month('closed'));
    await setDoc(doc(store, 'months', CURRENT, 'payments', 'R201'), payment(1_000, false));
    await setDoc(doc(store, 'months', CURRENT, 'payments', 'R202'), payment(1_000, true));
    await setDoc(doc(store, 'months', CLOSED, 'payments', 'R201'), payment(1_000, false));
  });
});

describe('로그인·역할 (U-4)', () => {
  it('#1 로그아웃 상태는 월 문서를 읽을 수 없다', async () => {
    await assertFails(getDoc(doc(db(null), 'months', CURRENT)));
  });

  it('#2 역할 문서가 없는 계정은 읽을 수 없다', async () => {
    await assertFails(getDoc(doc(db(STRANGER), 'months', CURRENT)));
  });

  it('자기 역할 문서는 읽을 수 있고, 남의 것은 못 읽는다', async () => {
    await assertSucceeds(getDoc(doc(db(MANAGER), 'users', MANAGER)));
    await assertFails(getDoc(doc(db(MANAGER), 'users', ADMIN)));
  });

  it('#13 누구도 users 문서를 쓸 수 없다', async () => {
    await assertFails(setDoc(doc(db(ADMIN), 'users', ADMIN), { role: 'admin', displayName: 'x' }));
    await assertFails(setDoc(doc(db(MANAGER), 'users', MANAGER), { role: 'admin', displayName: 'x' }));
  });
});

describe('관리소장 — 월 문서 (U-7, U-13, U-15)', () => {
  it('#3 현재 달 수도 입력은 허용', async () => {
    await assertSucceeds(updateDoc(doc(db(MANAGER), 'months', CURRENT), { 'water.R201': { usage: 10, amount: 15_000 } }));
  });

  it('#4 이전 달 수도 입력은 거부', async () => {
    await assertFails(updateDoc(doc(db(MANAGER), 'months', PREVIOUS), { 'water.R201': { usage: 10, amount: 15_000 } }));
  });

  it('#5 현재 달 결산(status 변경)은 거부', async () => {
    await assertFails(updateDoc(doc(db(MANAGER), 'months', CURRENT), { status: 'closed' }));
  });

  it('새 달 만들기와 현재 달 바꾸기는 거부 (Design §12 Q1)', async () => {
    await assertFails(setDoc(doc(db(MANAGER), 'months', '2026-12'), month('open')));
    await assertFails(setDoc(doc(db(MANAGER), 'config', 'app'), { currentMonth: '2026-10' }));
  });
});

describe('관리소장 — 납부 (U-8 ~ U-10)', () => {
  it('#6 납부 완료 전 세대의 납부 금액 수정은 허용', async () => {
    await assertSucceeds(setDoc(doc(db(MANAGER), 'months', CURRENT, 'payments', 'R201'), payment(2_000, false)));
  });

  it('새 세대 납부 입력도 허용', async () => {
    await assertSucceeds(setDoc(doc(db(MANAGER), 'months', CURRENT, 'payments', 'R203'), payment(500, false)));
  });

  it('#7 납부 완료된 세대의 납부 금액 수정은 거부', async () => {
    await assertFails(setDoc(doc(db(MANAGER), 'months', CURRENT, 'payments', 'R202'), payment(2_000, false)));
  });

  it('#8 납부 완료 표시는 거부', async () => {
    await assertFails(setDoc(doc(db(MANAGER), 'months', CURRENT, 'payments', 'R201'), payment(1_000, true)));
  });

  it('이전 달 납부 수정은 거부', async () => {
    await assertFails(setDoc(doc(db(MANAGER), 'months', PREVIOUS, 'payments', 'R201'), payment(1_000, false)));
  });

  it('잘못된 금액(음수·소수)은 거부', async () => {
    await assertFails(setDoc(doc(db(MANAGER), 'months', CURRENT, 'payments', 'R203'), payment(-1, false)));
    await assertFails(setDoc(doc(db(MANAGER), 'months', CURRENT, 'payments', 'R203'), payment(10.5, false)));
  });
});

describe('관리자 (U-9, U-14, D-6, D-8)', () => {
  it('#9 납부 완료와 취소', async () => {
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'months', CURRENT, 'payments', 'R201'), { confirmed: true, confirmedBy: ADMIN }));
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'months', CURRENT, 'payments', 'R202'), { confirmed: false, confirmedBy: null }));
  });

  it('이전 달(미결산) 수정은 허용', async () => {
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'months', PREVIOUS), { 'water.R201': { usage: 1, amount: 100 } }));
  });

  it('#10 결산된 달 수도 수정은 거부', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'months', CLOSED), { 'water.R201': { usage: 1, amount: 100 } }));
  });

  it('#11 결산 취소는 허용', async () => {
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'months', CLOSED), { status: 'open', closing: null, updatedAt: 't2' }));
  });

  it('#12 결산된 달 납부 수정은 거부', async () => {
    await assertFails(setDoc(doc(db(ADMIN), 'months', CLOSED, 'payments', 'R201'), payment(2_000, false)));
  });

  it('결산과 새 달 시작은 허용', async () => {
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'months', CURRENT), { status: 'closed', closing: { closedAt: 't', closedBy: ADMIN, unpaid: {} } }));
    await assertSucceeds(setDoc(doc(db(ADMIN), 'months', '2026-12'), month('open')));
    await assertSucceeds(setDoc(doc(db(ADMIN), 'config', 'app'), { currentMonth: '2026-12' }));
  });

  it('세대 마스터는 관리자만 쓴다', async () => {
    await assertSucceeds(setDoc(doc(db(ADMIN), 'master', 'units'), { version: 1, units: [], updatedAt: 't' }));
    await assertFails(setDoc(doc(db(MANAGER), 'master', 'units'), { version: 1, units: [], updatedAt: 't' }));
    await assertSucceeds(getDoc(doc(db(MANAGER), 'master', 'units')));
  });
});
