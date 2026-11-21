'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Plus, RefreshCw } from 'lucide-react';
import type { DeleteMode, LocaleConfig } from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import { AdminVoicesSection } from './AdminVoicesSection';
import { DeleteActionsControl } from './DeleteActionsControl';

interface AdminLanguagesPanelProps {
  interfaceLocale: string;
  canHardDelete?: boolean;
  onLanguagesUpdated: () => void;
}

const PROTECTED_CORE_LOCALES = new Set(['en', 'vi']);

export function AdminLanguagesPanel({
  interfaceLocale,
  canHardDelete = false,
  onLanguagesUpdated,
}: AdminLanguagesPanelProps) {
  const isVi = interfaceLocale === 'vi';
  const [languages, setLanguages] = useState<LocaleConfig[]>([]);
  const [viewFilter, setViewFilter] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(true);
  const [busyLocale, setBusyLocale] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add language form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocale, setNewLocale] = useState('');
  const [newNativeName, setNewNativeName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDirection, setNewDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [newStatus, setNewStatus] = useState<'ready' | 'planned'>('planned');
  const [newUiEnabled, setNewUiEnabled] = useState(false);
  const [newLearningEnabled, setNewLearningEnabled] = useState(true);
  const [newExplanationEnabled, setNewExplanationEnabled] = useState(false);
  const [newTtsEnabled, setNewTtsEnabled] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadLanguages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.listAdminLanguages({ includeArchived: true });
      setLanguages(res.languages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load languages'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLanguages();
  }, [loadLanguages]);

  const activeItems = languages.filter((l) => !l.archivedAt);
  const archivedItems = languages.filter((l) => Boolean(l.archivedAt));
  const visibleItems = viewFilter === 'active' ? activeItems : archivedItems;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newLocale.trim().toLowerCase();
    if (!code || !newNativeName.trim() || !newDisplayName.trim()) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.createAdminLanguage({
        locale: code,
        languageCode: code.split('-')[0] || code,
        displayName: newDisplayName.trim(),
        nativeName: newNativeName.trim(),
        direction: newDirection,
        enabled: true,
        uiEnabled: newUiEnabled,
        learningEnabled: newLearningEnabled,
        explanationEnabled: newExplanationEnabled,
        ttsEnabled: newTtsEnabled,
        speechRecognitionEnabled: false,
        fallbackLocale: 'en',
        contentStatus: newStatus,
      });
      setNewLocale('');
      setNewNativeName('');
      setNewDisplayName('');
      setShowAddForm(false);
      setNotice(
        isVi
          ? `Đã thêm ngôn ngữ "${code}".`
          : `Added language "${code}".`
      );
      await loadLanguages();
      onLanguagesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create language');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleField = async (
    lang: LocaleConfig,
    patch: Partial<Omit<LocaleConfig, 'locale' | 'languageCode' | 'archivedAt'>>
  ) => {
    setBusyLocale(lang.locale);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.updateAdminLanguage(lang.locale, patch);
      setLanguages((prev) =>
        prev.map((item) =>
          item.locale === lang.locale ? res.language : item
        )
      );
      onLanguagesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyLocale(null);
    }
  };

  const handleDelete = async (locale: string, mode: DeleteMode) => {
    setBusyLocale(locale);
    setError(null);
    setNotice(null);
    try {
      await apiClient.deleteAdminLanguage(locale, mode);
      setNotice(
        mode === 'hard'
          ? isVi
            ? `Đã xóa vĩnh viễn ngôn ngữ "${locale}".`
            : `Permanently deleted locale "${locale}".`
          : isVi
            ? `Đã lưu trữ ngôn ngữ "${locale}" (có thể khôi phục).`
            : `Archived locale "${locale}" (restorable).`
      );
      await loadLanguages();
      onLanguagesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyLocale(null);
    }
  };

  const handleRestore = async (locale: string) => {
    setBusyLocale(locale);
    setError(null);
    setNotice(null);
    try {
      await apiClient.restoreAdminLanguage(locale);
      setNotice(
        isVi
          ? `Đã khôi phục ngôn ngữ "${locale}".`
          : `Restored locale "${locale}".`
      );
      await loadLanguages();
      onLanguagesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyLocale(null);
    }
  };

  return (
    <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
            <Globe className="w-4 h-4" aria-hidden="true" />
            <span>{isVi ? 'Ngôn ngữ hệ thống' : 'Language Settings'}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isVi
              ? 'Quản trị danh mục ngôn ngữ'
              : 'Multilingual Settings'}
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            {isVi
              ? 'Bật/tắt độc lập ngôn ngữ giao diện, học tập, giải thích và đọc truyện; thêm ngôn ngữ mới hoặc lưu trữ/khôi phục.'
              : 'Independently enable interface, learning, explanation, and narration per language. Add new languages or archive/restore entries.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => setViewFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                viewFilter === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Đang hoạt động' : 'Active'} ({activeItems.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                viewFilter === 'archived'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Đã lưu trữ' : 'Archived'} ({archivedItems.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isVi ? 'Thêm ngôn ngữ' : 'Add Language'}</span>
          </button>

          <button
            type="button"
            onClick={() => void loadLanguages()}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4"
        >
          <p className="text-sm font-bold text-slate-900">
            {isVi ? 'Thêm cấu hình ngôn ngữ mới' : 'Register New Locale'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                Locale code
              </span>
              <input
                type="text"
                required
                value={newLocale}
                onChange={(e) => setNewLocale(e.target.value)}
                placeholder="fr / ko / es"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tên bản địa' : 'Native name'}
              </span>
              <input
                type="text"
                required
                value={newNativeName}
                onChange={(e) => setNewNativeName(e.target.value)}
                placeholder="Français"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tên hiển thị (EN)' : 'Display name'}
              </span>
              <input
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="French"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                Direction
              </span>
              <select
                value={newDirection}
                onChange={(e) =>
                  setNewDirection(e.target.value as 'ltr' | 'rtl')
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="ltr">LTR</option>
                <option value="rtl">RTL</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Trạng thái học liệu' : 'Content status'}
              </span>
              <select
                value={newStatus}
                onChange={(e) =>
                  setNewStatus(e.target.value as 'ready' | 'planned')
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="ready">{isVi ? 'Sẵn sàng' : 'Ready'}</option>
                <option value="planned">{isVi ? 'Dự kiến' : 'Planned'}</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newUiEnabled}
                  onChange={(e) => setNewUiEnabled(e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
                <span>UI</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newLearningEnabled}
                  onChange={(e) => setNewLearningEnabled(e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
                <span>{isVi ? 'Học tập' : 'Learning'}</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newExplanationEnabled}
                  onChange={(e) => setNewExplanationEnabled(e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
                <span>{isVi ? 'Giải thích' : 'Explanation'}</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTtsEnabled}
                  onChange={(e) => setNewTtsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
                <span>TTS</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {creating
                  ? isVi
                    ? 'Đang lưu...'
                    : 'Saving...'
                  : isVi
                    ? 'Lưu ngôn ngữ'
                    : 'Save Locale'}
              </button>
            </div>
          </div>
        </form>
      )}

      {notice && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">
          {isVi ? 'Đang tải danh mục ngôn ngữ...' : 'Loading languages...'}
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">
          {viewFilter === 'archived'
            ? isVi
              ? 'Chưa có ngôn ngữ nào trong kho lưu trữ.'
              : 'No archived languages.'
            : isVi
              ? 'Chưa có ngôn ngữ nào.'
              : 'No languages configured.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 pr-4">{isVi ? 'Ngôn ngữ' : 'Language'}</th>
                <th className="py-3 px-3">Locale</th>
                <th className="py-3 px-3 text-center">
                  {isVi ? 'Bật' : 'Enabled'}
                </th>
                <th className="py-3 px-3 text-center">UI</th>
                <th className="py-3 px-3 text-center">
                  {isVi ? 'Học' : 'Learn'}
                </th>
                <th className="py-3 px-3 text-center">
                  {isVi ? 'Giải thích' : 'Explain'}
                </th>
                <th className="py-3 px-3 text-center">TTS</th>
                <th className="py-3 px-3">
                  {isVi ? 'Trạng thái' : 'Status'}
                </th>
                <th className="py-3 pl-4 text-right">
                  {isVi ? 'Thao tác' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.map((lang) => {
                const isBusy = busyLocale === lang.locale;
                const isArchived = Boolean(lang.archivedAt);
                const isCore = PROTECTED_CORE_LOCALES.has(lang.locale);
                return (
                  <tr key={lang.locale}>
                    <td className="py-3.5 pr-4 font-semibold text-slate-900">
                      {lang.nativeName}{' '}
                      <span className="font-normal text-slate-500">
                        ({lang.displayName})
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-600">
                      {lang.locale}
                    </td>
                    {(
                      [
                        ['enabled', lang.enabled],
                        ['uiEnabled', lang.uiEnabled],
                        ['learningEnabled', lang.learningEnabled],
                        ['explanationEnabled', lang.explanationEnabled],
                        ['ttsEnabled', lang.ttsEnabled],
                      ] as const
                    ).map(([field, value]) => (
                      <td key={field} className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isBusy || isArchived}
                          checked={value}
                          onChange={(e) =>
                            void handleToggleField(lang, {
                              [field]: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-sky-600 cursor-pointer disabled:opacity-40"
                          aria-label={`${lang.locale} ${field}`}
                        />
                      </td>
                    ))}
                    <td className="py-3.5 px-3">
                      <select
                        disabled={isBusy || isArchived}
                        value={lang.contentStatus}
                        onChange={(e) =>
                          void handleToggleField(lang, {
                            contentStatus: e.target.value as
                              | 'ready'
                              | 'planned',
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        <option value="ready">
                          {isVi ? 'Sẵn sàng' : 'Ready'}
                        </option>
                        <option value="planned">
                          {isVi ? 'Dự kiến' : 'Planned'}
                        </option>
                      </select>
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <DeleteActionsControl
                        isArchived={isArchived}
                        isVi={isVi}
                        busy={isBusy}
                        canHardDelete={canHardDelete && !isCore}
                        hardDeleteProtectedHint={
                          canHardDelete && isCore
                            ? isVi
                              ? 'Ngôn ngữ lõi (en/vi) không thể xóa vĩnh viễn'
                              : 'Core locales (en/vi) cannot be permanently deleted'
                            : undefined
                        }
                        onDelete={(mode) => handleDelete(lang.locale, mode)}
                        onRestore={() => handleRestore(lang.locale)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
    <AdminVoicesSection
      interfaceLocale={interfaceLocale}
      canHardDelete={canHardDelete}
    />
    </div>
  );
}
