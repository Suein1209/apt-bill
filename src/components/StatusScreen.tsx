import type { ReactNode } from 'react';

interface StatusScreenProps {
  title: string;
  children?: ReactNode;
  tone?: 'info' | 'error';
}

/** 로딩/설정 오류 등 전체 화면 안내 */
export function StatusScreen({ title, children, tone = 'info' }: StatusScreenProps) {
  const titleColor = tone === 'error' ? 'text-red-800' : 'text-black';
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border-2 border-slate-300 bg-white p-8 shadow-lg">
        <h1 className={`mb-4 text-2xl font-bold ${titleColor}`}>{title}</h1>
        {children && <div className="space-y-3 text-lg">{children}</div>}
      </div>
    </main>
  );
}
