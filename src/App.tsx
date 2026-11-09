import type { Auth } from 'firebase/auth';
import { firebase } from './lib/firebase.ts';
import { useAuth } from './hooks/useAuth.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { HomeScreen } from './components/HomeScreen.tsx';
import { StatusScreen } from './components/StatusScreen.tsx';

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
  return <AuthGate auth={firebase.auth} />;
}

function AuthGate({ auth }: { auth: Auth }) {
  const state = useAuth(auth);

  switch (state.status) {
    case 'loading':
      return <StatusScreen title="불러오는 중…" />;
    case 'error':
      return (
        <StatusScreen title="로그인 상태를 확인하지 못했습니다" tone="error">
          <p>{state.message}</p>
          <p>페이지를 새로고침해 주세요.</p>
        </StatusScreen>
      );
    case 'signedOut':
      return <LoginScreen auth={auth} />;
    case 'signedIn':
      return <HomeScreen auth={auth} user={state.user} />;
  }
}
