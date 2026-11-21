'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Languages,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  LocaleConfig,
  SafetyReviewResult,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';

interface SafetyReviewModalProps {
  isVi: boolean;
  entityType: 'package' | 'story';
  entityId: string;
  entityTitle: string;
  connectionId?: string;
  onClose: () => void;
}

export function SafetyReviewModal({
  isVi,
  entityType,
  entityId,
  entityTitle,
  connectionId,
  onClose,
}: SafetyReviewModalProps) {
  const [review, setReview] = useState<SafetyReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.runCmsSafetyReview({
        entityType,
        entityId,
        responseLocale: isVi ? 'vi' : 'en',
        connectionId: connectionId || undefined,
      });
      setReview(res.review);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete safety review'
      );
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, isVi, connectionId]);

  useEffect(() => {
    void runReview();
  }, [runReview]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Kiểm duyệt an toàn trẻ em AI' : 'AI Child Safety Review'}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>
                {isVi
                  ? 'Kiểm duyệt an toàn & phù hợp trẻ 3–5 tuổi'
                  : 'AI Child-Safety & Age 3–5 Readiness'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 truncate mt-0.5">
              {entityTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-10 text-center space-y-2">
              <Sparkles
                className="w-6 h-6 text-sky-600 mx-auto animate-pulse"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-800">
                {isVi
                  ? 'Đang đánh giá ngôn ngữ, độ an toàn và nhịp độ cho bé 3–5 tuổi...'
                  : 'Evaluating child safety, vocabulary simplicity, and gentle pacing...'}
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-900">{error}</p>
              <button
                type="button"
                onClick={() => void runReview()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isVi ? 'Thử lại' : 'Retry'}</span>
              </button>
            </div>
          ) : review ? (
            <>
              <div
                className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-4 ${
                  review.passed
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    {review.passed ? (
                      <CheckCircle2
                        className="w-5 h-5 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertTriangle
                        className="w-5 h-5 text-amber-600"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm font-bold text-slate-900">
                      {review.passed
                        ? isVi
                          ? 'Đạt tiêu chuẩn an toàn trẻ 3–5 tuổi'
                          : 'Passed Child-Safety Gate (Ages 3–5)'
                        : isVi
                          ? 'Cần biên tập viên xem lại trước khi xuất bản'
                          : 'Needs Editor Revision Before Publishing'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {review.summary}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                    {review.score}
                    <span className="text-sm font-semibold text-slate-500">
                      /100
                    </span>
                  </p>
                  <p className="text-xs font-mono text-slate-500">
                    {review.modelUsed}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {isVi ? 'Các tiêu chí kiểm định' : 'Pedagogical & Safety Checks'}
                </h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {review.checks.map((chk, idx) => (
                    <div
                      key={`${chk.criterion}-${idx}`}
                      className="p-3.5 bg-white flex items-start gap-3"
                    >
                      {chk.passed ? (
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangle
                          className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {chk.criterion}
                        </p>
                        <p className="text-xs text-slate-600">{chk.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {review.suggestions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {isVi ? 'Gợi ý cải thiện' : 'Editorial Suggestions'}
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-5">
                    {review.suggestions.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runReview()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isVi ? 'Kiểm tra lại' : 'Re-run Review'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdaptLocaleModalProps {
  isVi: boolean;
  entityType: 'package' | 'story';
  entityId: string;
  entityTitle: string;
  existingLocales: string[];
  languages: LocaleConfig[];
  connectionId?: string;
  onClose: () => void;
  onAdapted: (message: string) => void;
}

export function AdaptLocaleModal({
  isVi,
  entityType,
  entityId,
  entityTitle,
  existingLocales,
  languages,
  connectionId,
  onClose,
  onAdapted,
}: AdaptLocaleModalProps) {
  const [sourceLocale, setSourceLocale] = useState(existingLocales[0] || 'en');
  const candidateTargets = languages.filter(
    (l) => !existingLocales.includes(l.locale)
  );
  const [targetLocale, setTargetLocale] = useState(
    candidateTargets[0]?.locale || 'ja'
  );
  const [customLocale, setCustomLocale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTarget = (customLocale.trim() || targetLocale).toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTarget || effectiveTarget === sourceLocale.toLowerCase()) {
      setError(
        isVi
          ? 'Ngôn ngữ đích phải khác ngôn ngữ nguồn.'
          : 'Target locale must differ from source locale.'
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.adaptCmsLocale({
        entityType,
        entityId,
        sourceLocale,
        targetLocale: effectiveTarget,
        connectionId: connectionId || undefined,
      });
      onAdapted(
        isVi
          ? `Đã chuyển thể "${entityTitle}" sang ngôn ngữ "${effectiveTarget.toUpperCase()}" (${res.modelUsed}). Mở trình sửa để kiểm tra trước khi xuất bản.`
          : `Adapted "${entityTitle}" into "${effectiveTarget.toUpperCase()}" (${res.modelUsed}). Review inline before publishing.`
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to adapt content locale'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Chuyển thể đa ngôn ngữ bằng AI' : 'AI Cross-Locale Adaptation'}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
              <Languages className="w-4 h-4" aria-hidden="true" />
              <span>
                {isVi
                  ? 'Chuyển thể đa ngôn ngữ (Locale Independence)'
                  : 'Cross-Locale AI Adaptation'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 truncate mt-0.5">
              {entityTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {isVi
              ? 'Thêm trực tiếp bản địa hóa ngôn ngữ mới vào chính bài học/truyện này mà không cần nhân bản khóa học. Bản dịch luôn cần biên tập viên xem lại trước khi xuất bản.'
              : 'Add a culturally adapted localization directly onto this content item without duplicating the course. Always review before publishing.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Ngôn ngữ nguồn' : 'Source locale'}
              </span>
              <select
                value={sourceLocale}
                onChange={(e) => setSourceLocale(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {existingLocales.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Ngôn ngữ đích' : 'Target language'}
              </span>
              <select
                value={targetLocale}
                onChange={(e) => {
                  setTargetLocale(e.target.value);
                  setCustomLocale('');
                }}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {languages.map((lang) => (
                  <option key={lang.locale} value={lang.locale}>
                    {lang.nativeName} ({lang.locale})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {isVi
                ? 'Hoặc nhập mã ngôn ngữ khác (vd: fr, ko, es)'
                : 'Or enter another language code (e.g. fr, ko, es)'}
            </span>
            <input
              type="text"
              value={customLocale}
              onChange={(e) => setCustomLocale(e.target.value)}
              placeholder="ja / ko / fr / es"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm font-mono"
            />
          </label>

          {error && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {busy
                  ? isVi
                    ? 'Đang chuyển thể AI...'
                    : 'Adapting with AI...'
                  : isVi
                    ? `Chuyển thể sang ${effectiveTarget.toUpperCase()}`
                    : `Adapt to ${effectiveTarget.toUpperCase()}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
