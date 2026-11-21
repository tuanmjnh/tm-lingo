'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';

interface ParentalGateModalProps {
  isVi: boolean;
  onUnlocked: () => void;
  onCancel: () => void;
}

export function ParentalGateModal({
  isVi,
  onUnlocked,
  onCancel,
}: ParentalGateModalProps) {
  const [challenge] = useState(() => {
    const a = 4 + Math.floor(Math.random() * 6);
    const b = 3 + Math.floor(Math.random() * 5);
    return { a, b, answer: a + b };
  });
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  // Hold-for-2s alternative for quick parent access
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<number | null>(null);

  const stopHold = () => {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  useEffect(() => () => stopHold(), []);

  const startHold = () => {
    stopHold();
    const startedAt = Date.now();
    holdIntervalRef.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / 1600) * 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        stopHold();
        onUnlocked();
      }
    }, 40);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(input.trim()) === challenge.answer) {
      onUnlocked();
    } else {
      setWrong(true);
      setInput('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Xác nhận Phụ huynh' : 'Parent Verification'}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isVi ? 'Xác nhận Phụ huynh' : 'Parent Check'}
              </h2>
              <p className="text-xs text-slate-500">
                {isVi
                  ? 'Giúp bé không bấm nhầm vào trang cài đặt.'
                  : 'Prevents young children from accidentally entering settings.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label={isVi ? 'Đóng' : 'Close'}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-800">
              {isVi
                ? `Phép tính nhanh: ${challenge.a} + ${challenge.b} = ?`
                : `Quick check: ${challenge.a} + ${challenge.b} = ?`}
            </span>
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={input}
              onChange={(e) => {
                setWrong(false);
                setInput(e.target.value);
              }}
              placeholder={isVi ? 'Nhập kết quả...' : 'Enter answer...'}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-base font-semibold tabular-nums text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </label>
          {wrong && (
            <p className="text-xs text-amber-700">
              {isVi
                ? 'Chưa đúng, phụ huynh vui lòng thử lại nhé.'
                : 'Not quite — please try again.'}
            </p>
          )}
          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 cursor-pointer"
          >
            {isVi ? 'Mở Góc phụ huynh' : 'Continue to Parents'}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-xs text-slate-500 text-center">
            {isVi ? 'Hoặc giữ nút bên dưới trong 2 giây' : 'Or press and hold below for 2 seconds'}
          </p>
          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            className="relative w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden text-xs font-semibold text-slate-700 cursor-pointer select-none"
          >
            <div
              className="absolute inset-y-0 left-0 bg-sky-200/80 transition-all duration-75"
              style={{ width: `${holdProgress}%` }}
            />
            <span className="relative inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-700" aria-hidden="true" />
              <span>
                {isVi ? 'Giữ 2 giây để mở khóa' : 'Hold 2s to unlock'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
