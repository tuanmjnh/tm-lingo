'use client';

import { useState } from 'react';
import { ArrowLeft, LogIn, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface AdminLoginViewProps {
  staffBusy: boolean;
  staffError: string | null;
  iamMode: 'tm-hub' | 'local-dev';
  interfaceLocale: string;
  onStaffLogin: (email: string, password: string) => Promise<void>;
  onBackToLearn: () => void;
}

export function AdminLoginView({
  staffBusy,
  staffError,
  iamMode,
  interfaceLocale,
  onStaffLogin,
  onBackToLearn,
}: AdminLoginViewProps) {
  const isVi = interfaceLocale === 'vi';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 4) return;
    await onStaffLogin(email.trim(), password);
  };

  return (
    <div className="max-w-lg mx-auto py-6 sm:py-10 space-y-6">
      <button
        type="button"
        onClick={onBackToLearn}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{isVi ? 'Quay về trang chủ' : 'Back to home'}</span>
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <BrandLogo size="md" />
          <div className="flex items-center gap-2 text-xs font-semibold text-accent pt-1">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {isVi
                ? 'Cổng Quản trị & Giáo viên'
                : 'Admin & Teacher Portal'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isVi
              ? 'Đăng nhập quản trị hệ thống'
              : 'System Administration Sign-In'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {isVi
              ? 'Khu vực quản trị tách biệt hoàn toàn với tài khoản phụ huynh để bảo vệ an toàn dữ liệu gia đình.'
              : 'Staff sign-in is kept strictly separate from parent accounts to protect family data.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isVi ? 'Email quản trị / giáo viên' : 'Admin / Teacher email'}
            </span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@tm-lingo.app"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isVi ? 'Mật khẩu' : 'Password'}
            </span>
            <input
              type="password"
              required
              minLength={4}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-accent"
            />
          </label>

          {staffError && (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 rounded-lg px-3 py-2">
              {staffError}
            </p>
          )}

          <button
            type="submit"
            disabled={staffBusy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl btn-accent text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>
              {staffBusy
                ? isVi
                  ? 'Đang xác thực...'
                  : 'Authenticating...'
                : isVi
                  ? 'Đăng nhập Cổng quản trị'
                  : 'Sign in to Admin Portal'}
            </span>
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800">
            {isVi
              ? 'Sử dụng tài khoản nhân sự được cấp phép để truy cập khu vực quản trị.'
              : 'Sign in with your authorized staff account to access the administration workspace.'}
          </p>
        </form>
      </section>
    </div>
  );
}
