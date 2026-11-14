import type { ComponentPropsWithRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'border-blue-900 bg-blue-800 text-white hover:bg-blue-900 disabled:bg-slate-400 disabled:border-slate-400',
  secondary: 'border-slate-700 bg-white text-slate-900 hover:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300',
  danger: 'border-red-800 bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-400 disabled:border-slate-400',
};

interface BigButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  icon?: ReactNode;
}

/** 시니어용 큰 버튼 — 글씨 20px, 높은 대비, 큰 포커스 테두리 (G-2) */
export function BigButton({ variant = 'primary', icon, children, className = '', type = 'button', ...rest }: BigButtonProps) {
  return (
    <button
      type={type}
      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-5 py-3 text-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
