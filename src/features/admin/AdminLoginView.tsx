import { useState } from 'react';
import { ArrowLeft, Lock, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import type { AuthUserProfile } from '../../../packages/contracts/types';

interface AdminLoginViewProps {
  authUser: AuthUserProfile | null;
  authBusy: boolean;
  authError: string | null;
  interfaceLocale: string;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onBackToLearn: () => void;
}

export function AdminLoginView({
  authUser,
  authBusy,
  authError,
  interfaceLocale,
  onSignInEmail,
  onSignOut,
  onBackToLearn,
}: AdminLoginViewProps) {
  const isVi = interfaceLocale === 'vi';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) return;
    await onSignInEmail(email.trim(), password);
  };

  return (
    <div className="max-w-lg mx-auto py-6 sm:py-10 space-y-6">
      <button
        type="button"
        onClick={onBackToLearn}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{isVi ? 'Quay về khu vực học' : 'Back to learning'}</span>
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>
              {isVi
                ? 'Cổng Quản trị & Giáo viên'
                : 'System Admin & Teacher Portal'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isVi
              ? 'Đăng nhập quản trị hệ thống'
              : 'System Administration Sign-In'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {isVi
              ? 'Khu vực biên soạn học liệu, quản trị thông báo Web Push và phân quyền dành riêng cho tài khoản Quản trị viên và Giáo viên.'
              : 'Dedicated workspace for curriculum media, Web Push campaigns, and role administration reserved for Administrator and Teacher accounts.'}
          </p>
        </div>

        {authUser ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {isVi
                    ? 'Tài khoản hiện tại không có quyền quản trị'
                    : 'Current account does not have staff privileges'}
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {isVi
                  ? `Bạn đang đăng nhập với ${authUser.email ?? authUser.displayName ?? 'tài khoản người dùng'} (vai trò: Phụ huynh). Tài khoản phụ huynh và học sinh chỉ sử dụng nội dung học tập và không thể truy cập Bộ quản trị.`
                  : `You are signed in as ${authUser.email ?? authUser.displayName ?? 'user'} (role: Parent). Parent accounts are for learner usage only and cannot access System Administration.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void onSignOut()}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isVi
                    ? 'Đăng xuất để đổi tài khoản quản trị'
                    : 'Sign out to switch to Admin account'}
                </span>
              </button>
              <button
                type="button"
                onClick={onBackToLearn}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isVi ? 'Về trang học' : 'Go to Learn'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Email quản trị / giáo viên' : 'Admin / Teacher email'}
              </span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tm-lingo.app"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Mật khẩu' : 'Password'}
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
              />
            </label>

            {authError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>
                {isVi ? 'Đăng nhập Cổng quản trị' : 'Sign in to Admin Portal'}
              </span>
            </button>

            <p className="text-xs text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
              {isVi
                ? 'Không hỗ trợ tự đăng ký quyền quản trị. Tài khoản phụ huynh đăng ký hoặc đăng nhập bằng Google tại mục Phụ huynh.'
                : 'Self-registration for staff roles is disabled. Parent accounts sign up or continue with Google in the Parents tab.'}
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
