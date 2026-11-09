import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { Building2, Eye, EyeOff, LogIn } from 'lucide-react';
import { APP_TITLE } from '../constants/authMessages.ts';
import { toAuthErrorMessage } from '../lib/authError.ts';

interface LoginScreenProps {
  auth: Auth;
}

export function LoginScreen({ auth }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // 성공 시 useAuth 가 상태 변화를 감지해 화면을 전환한다.
    } catch (error: unknown) {
      setErrorMessage(toAuthErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md rounded-2xl border-2 border-slate-300 bg-white p-8 shadow-lg"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <Building2 className="h-14 w-14 text-blue-800" aria-hidden="true" />
          <h1 className="text-3xl font-bold">{APP_TITLE}</h1>
        </div>

        <label htmlFor="email" className="mb-2 block text-xl font-semibold">
          이메일
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-6 w-full rounded-lg border-2 border-slate-500 px-4 py-3 text-xl focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
        />

        <label htmlFor="password" className="mb-2 block text-xl font-semibold">
          비밀번호
        </label>
        <div className="relative mb-6">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border-2 border-slate-500 py-3 pl-4 pr-16 text-xl focus:border-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-slate-700 hover:text-black"
          >
            {showPassword ? <EyeOff className="h-7 w-7" /> : <Eye className="h-7 w-7" />}
          </button>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mb-6 rounded-lg border-2 border-red-700 bg-red-50 px-4 py-3 text-lg font-semibold text-red-800"
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-800 px-4 py-4 text-2xl font-bold text-white hover:bg-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-wait disabled:bg-slate-500"
        >
          <LogIn className="h-7 w-7" aria-hidden="true" />
          {isSubmitting ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </main>
  );
}
