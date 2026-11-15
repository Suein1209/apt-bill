import type { ComponentPropsWithRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'border-brand bg-brand text-white hover:bg-brand-strong hover:border-brand-strong disabled:bg-slate-400 disabled:border-slate-400',
  secondary: 'border-slate-400 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-500 disabled:text-slate-400 disabled:border-slate-300',
  danger: 'border-red-700 bg-red-700 text-white hover:bg-red-800 hover:border-red-800 disabled:bg-slate-400 disabled:border-slate-400',
};

interface BigButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  icon?: ReactNode;
}

/** 시니어용 큰 버튼 — 글씨 20px, 높이 56px 이상, 큰 포커스 테두리 (G-2). 시안 A: 둥근 모서리 14px */
export function BigButton({ variant = 'primary', icon, children, className = '', type = 'button', ...rest }: BigButtonProps) {
  return (
    <button
      type={type}
      className={`flex items-center justify-center gap-2 min-h-14 rounded-[14px] border-2 px-6 py-3 text-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
