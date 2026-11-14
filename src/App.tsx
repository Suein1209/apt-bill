import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { firebase } from './lib/firebase.ts';
import { useAuth } from './hooks/useAuth.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { MonthApp } from './features/month/MonthApp.tsx';
import { StatusScreen } from './components/StatusScreen.tsx';
import { LogoutButton } from './components/LogoutButton.tsx';
import { PROFILE_LOAD_FAILED_TITLE, UNREGISTERED_MESSAGE, UNREGISTERED_TITLE } from './constants/messages.ts';

export default function App() {
  if (!firebase.ok) {
    return (
      <StatusScreen title="Firebase 설정이 필요합니다" tone="error">
        {'errorMessage' in firebase ? (
          <p>Firebase 초기화 실패: {firebase.errorMessage}</p>
        ) : (
          <>
            <p>
              프로젝트 폴더의 <code className="font-mono font-bold">.env</code> 파일에 아래 값을 채운 뒤
              개발 서버를 다시 실행해 주세요.
            </p>
            <ul className="list-disc pl-6 font-mono">
              {firebase.missingEnvKeys.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </>
        )}
      </StatusScreen>
    );
  }
  return <AuthGate auth={firebase.auth} db={firebase.db} />;
}

function AuthGate({ auth, db }: { auth: Auth; db: Firestore }) {
  const state = useAuth(auth, db);

  switch (state.status) {
    case 'loading':
      return <StatusScreen title="불러오는 중…" />;
    case 'error':
      return (
        <StatusScreen title={PROFILE_LOAD_FAILED_TITLE} tone="error">
          <p>{state.message}</p>
          <p>페이지를 새로고침해 주세요.</p>
          <LogoutButton auth={auth} />
        </StatusScreen>
      );
    case 'signedOut':
      return <LoginScreen auth={auth} />;
    case 'unregistered':
      return (
        <StatusScreen title={UNREGISTERED_TITLE} tone="error">
          <p>{UNREGISTERED_MESSAGE}</p>
          <p className="text-slate-700">{state.user.email}</p>
          <LogoutButton auth={auth} />
        </StatusScreen>
      );
    case 'signedIn':
      return <MonthApp auth={auth} db={db} uid={state.user.uid} profile={state.profile} />;
  }
}
