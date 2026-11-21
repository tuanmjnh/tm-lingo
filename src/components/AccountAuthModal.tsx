'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, User, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AccountAuthModalProps {
  open: boolean;
  initialMode: 'signin' | 'signup';
  interfaceLocale: string;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onClose: () => void;
  onSignInGoogle: () => Promise<void>;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onSignUpEmail: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
}

export function AccountAuthModal({
  open,
  initialMode,
  interfaceLocale,
  busy,
  error,
  notice,
  onClose,
  onSignInGoogle,
  onSignInEmail,
  onSignUpEmail,
}: AccountAuthModalProps) {
  const isVi = interfaceLocale === 'vi';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === 'signup') {
      await onSignUpEmail(email.trim(), password, displayName.trim());
    } else {
      await onSignInEmail(email.trim(), password);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={
            mode === 'signup'
              ? isVi
                ? 'Tạo tài khoản TM-Lingo'
                : 'Create TM-Lingo Account'
              : isVi
                ? 'Đăng nhập TM-Lingo'
                : 'Sign in to TM-Lingo'
          }
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <BrandLogo size="sm" />
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 pt-1">
                  {mode === 'signup'
                    ? isVi
                      ? 'Tạo tài khoản học tập'
                      : 'Create your learning account'
                    : isVi
                      ? 'Chào mừng quay lại'
                      : 'Welcome back'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mode === 'signup'
                    ? isVi
                      ? 'Sau khi đăng ký, bạn sẽ chọn độ tuổi và thông tin học viên để mở đúng lộ trình học.'
                      : 'After signing up, select learner age and grade to unlock age-matched lessons.'
                    : isVi
                      ? 'Đăng nhập để tiếp tục lộ trình học và thư viện truyện của gia đình.'
                      : 'Sign in to continue your personalized lessons and story shelf.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={isVi ? 'Đóng' : 'Close'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isVi ? 'Tạo tài khoản mới' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isVi ? 'Đăng nhập' : 'Sign In'}
                </button>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Google Auth Button */}
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSignInGoogle()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <span className="font-bold text-accent">G</span>
                )}
                <span>
                  {isVi ? 'Tiếp tục với tài khoản Google' : 'Continue with Google'}
                </span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span>{isVi ? 'hoặc dùng email' : 'or with email'}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'signup' && (
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isVi ? 'Tên phụ huynh hoặc người học' : 'Your name'}
                    </span>
                    <div className="relative">
                      <User
                        className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={isVi ? 'Ví dụ: Gia đình Minh Anh' : 'e.g. Alex Nguyen'}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                  </label>
                )}

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email
                  </span>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isVi ? 'Mật khẩu' : 'Password'}
                  </span>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isVi ? 'Tối thiểu 6 ký tự' : 'At least 6 characters'}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] mt-1 rounded-xl btn-accent text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {busy && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  <span>
                    {mode === 'signup'
                      ? isVi
                        ? 'Tạo tài khoản & Chọn độ tuổi'
                        : 'Create account & Choose age'
                      : isVi
                        ? 'Đăng nhập'
                        : 'Sign in'}
                  </span>
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
