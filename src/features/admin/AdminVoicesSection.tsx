'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mic, Plus, RefreshCw, Volume2 } from 'lucide-react';
import type { DeleteMode, VoiceProfile } from '../../../packages/contracts/types';
import { speakText } from '../../audio/speechPlayer';
import { apiClient } from '../../shared/apiClient';
import { DeleteActionsControl } from './DeleteActionsControl';

interface AdminVoicesSectionProps {
  interfaceLocale: string;
  canHardDelete?: boolean;
}

const PROTECTED_CORE_VOICES = new Set(['voice-en-warm', 'voice-vi-calm']);

const STYLE_TAG_OPTIONS: Array<VoiceProfile['voiceStyleTags'][number]> = [
  'warm',
  'calm',
  'playful',
  'teacher-like',
];

export function AdminVoicesSection({
  interfaceLocale,
  canHardDelete = false,
}: AdminVoicesSectionProps) {
  const isVi = interfaceLocale === 'vi';
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [viewFilter, setViewFilter] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add voice form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVoiceId, setNewVoiceId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newProviderId, setNewProviderId] = useState('web-speech-adapter');
  const [newLocales, setNewLocales] = useState('en, en-US');
  const [newStyleTag, setNewStyleTag] =
    useState<VoiceProfile['voiceStyleTags'][number]>('warm');
  const [newPitch, setNewPitch] = useState('1.05');
  const [newRate, setNewRate] = useState('0.9');
  const [creating, setCreating] = useState(false);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.listAdminVoices({ includeArchived: true });
      setVoices(res.voices);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load voices'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  const activeItems = voices.filter((v) => !v.archivedAt);
  const archivedItems = voices.filter((v) => Boolean(v.archivedAt));
  const visibleItems = viewFilter === 'active' ? activeItems : archivedItems;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const voiceId = newVoiceId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-');
    const locales = newLocales
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!voiceId || !newDisplayName.trim() || locales.length === 0) return;

    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.createAdminVoice({
        voiceId,
        displayName: newDisplayName.trim(),
        providerId: newProviderId,
        supportedLocales: locales,
        voiceStyleTags: [newStyleTag],
        ageAppropriate: true,
        pitch: Number(newPitch) || 1.0,
        defaultRate: Number(newRate) || 0.9,
      });
      setNewVoiceId('');
      setNewDisplayName('');
      setShowAddForm(false);
      setNotice(
        isVi
          ? `Đã đăng ký hồ sơ giọng đọc "${voiceId}".`
          : `Registered voice profile "${voiceId}".`
      );
      await loadVoices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to register voice profile'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAgeAppropriate = async (voice: VoiceProfile) => {
    setBusyId(voice.voiceId);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.updateAdminVoice(voice.voiceId, {
        ageAppropriate: !voice.ageAppropriate,
      });
      setVoices((prev) =>
        prev.map((v) => (v.voiceId === voice.voiceId ? res.voice : v))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (voiceId: string, mode: DeleteMode) => {
    setBusyId(voiceId);
    setError(null);
    setNotice(null);
    try {
      await apiClient.deleteAdminVoice(voiceId, mode);
      setNotice(
        mode === 'hard'
          ? isVi
            ? `Đã xóa vĩnh viễn hồ sơ giọng đọc "${voiceId}".`
            : `Permanently deleted voice profile "${voiceId}".`
          : isVi
            ? `Đã lưu trữ hồ sơ giọng đọc "${voiceId}" (có thể khôi phục).`
            : `Archived voice profile "${voiceId}" (restorable).`
      );
      await loadVoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (voiceId: string) => {
    setBusyId(voiceId);
    setError(null);
    setNotice(null);
    try {
      await apiClient.restoreAdminVoice(voiceId);
      setNotice(
        isVi
          ? `Đã khôi phục hồ sơ giọng đọc "${voiceId}".`
          : `Restored voice profile "${voiceId}".`
      );
      await loadVoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  };

  const handlePreviewVoice = (voice: VoiceProfile) => {
    const primaryLocale = voice.supportedLocales[0] || 'en';
    const sampleText = primaryLocale.startsWith('vi')
      ? 'Xin chào bé! Hôm nay chúng ta cùng học từ mới và đọc truyện nhé.'
      : 'Hello little explorer! Let us learn a new word together.';
    speakText({
      text: sampleText,
      locale: primaryLocale,
      rate: voice.defaultRate,
      voiceProfile: voice,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
            <Mic className="w-4 h-4" aria-hidden="true" />
            <span>{isVi ? 'Giọng đọc' : 'Voice Profiles'}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isVi
              ? 'Danh mục giọng đọc & Hồ sơ âm thanh'
              : 'Voice & Audio Profiles'}
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            {isVi
              ? 'Quản lý danh sách giọng đọc thân thiện với trẻ 3–5 tuổi, nghe thử trực tiếp và lưu trữ hoặc khôi phục.'
              : 'Manage child-friendly voice profiles, preview playback live, and archive or restore entries.'}
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
            <span>{isVi ? 'Thêm giọng đọc' : 'Add Voice'}</span>
          </button>

          <button
            type="button"
            onClick={() => void loadVoices()}
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
            {isVi ? 'Đăng ký hồ sơ giọng đọc mới' : 'Register New Voice Profile'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                Voice ID
              </span>
              <input
                type="text"
                required
                value={newVoiceId}
                onChange={(e) => setNewVoiceId(e.target.value)}
                placeholder="voice-ja-gentle"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tên hiển thị' : 'Display name'}
              </span>
              <input
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Hana (Gentle Storyteller)"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                Provider
              </span>
              <select
                value={newProviderId}
                onChange={(e) => setNewProviderId(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="web-speech-adapter">web-speech-adapter</option>
                <option value="gemini-3.8-flash-lite-tts">
                  gemini-3.8-flash-lite-tts
                </option>
                <option value="custom-audio-storage">custom-audio-storage</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi
                  ? 'Locales hỗ trợ (cách nhau dấu phẩy)'
                  : 'Supported locales (comma-separated)'}
              </span>
              <input
                type="text"
                required
                value={newLocales}
                onChange={(e) => setNewLocales(e.target.value)}
                placeholder="en, en-US, vi"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Phong cách giọng' : 'Style tag'}
              </span>
              <select
                value={newStyleTag}
                onChange={(e) =>
                  setNewStyleTag(
                    e.target.value as VoiceProfile['voiceStyleTags'][number]
                  )
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {STYLE_TAG_OPTIONS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">
                  Pitch
                </span>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1.6"
                  value={newPitch}
                  onChange={(e) => setNewPitch(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">
                  Rate
                </span>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1.4"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
                  ? 'Lưu giọng đọc'
                  : 'Save Voice'}
            </button>
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
          {isVi ? 'Đang tải danh sách giọng đọc...' : 'Loading voices...'}
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">
          {viewFilter === 'archived'
            ? isVi
              ? 'Chưa có giọng đọc nào trong kho lưu trữ.'
              : 'No archived voices.'
            : isVi
              ? 'Chưa có giọng đọc nào.'
              : 'No voices registered.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 pr-4">
                  {isVi ? 'Hồ sơ giọng đọc' : 'Voice Profile'}
                </th>
                <th className="py-3 px-3">Provider</th>
                <th className="py-3 px-3">Locales</th>
                <th className="py-3 px-3">
                  {isVi ? 'Tốc độ / Cao độ' : 'Rate / Pitch'}
                </th>
                <th className="py-3 px-3 text-center">
                  {isVi ? 'Trẻ 3–5t' : 'Ages 3–5'}
                </th>
                <th className="py-3 pl-4 text-right">
                  {isVi ? 'Thao tác' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.map((voice) => {
                const isBusy = busyId === voice.voiceId;
                const isArchived = Boolean(voice.archivedAt);
                const isCore = PROTECTED_CORE_VOICES.has(voice.voiceId);
                return (
                  <tr key={voice.voiceId}>
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-slate-900">
                        {voice.displayName}
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        {voice.voiceId} · {voice.voiceStyleTags.join(', ')}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-600">
                      {voice.providerId}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-700">
                      {voice.supportedLocales.join(', ')}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-slate-700 tabular-nums">
                      {voice.defaultRate.toFixed(2)}x / {voice.pitch.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        disabled={isBusy || isArchived}
                        checked={voice.ageAppropriate}
                        onChange={() => void handleToggleAgeAppropriate(voice)}
                        className="w-4 h-4 accent-sky-600 cursor-pointer disabled:opacity-40"
                        aria-label={`${voice.voiceId} ageAppropriate`}
                      />
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() => handlePreviewVoice(voice)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Volume2
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>{isVi ? 'Nghe thử' : 'Test'}</span>
                          </button>
                        )}
                        <DeleteActionsControl
                          isArchived={isArchived}
                          isVi={isVi}
                          busy={isBusy}
                          canHardDelete={canHardDelete && !isCore}
                          hardDeleteProtectedHint={
                            canHardDelete && isCore
                              ? isVi
                                ? 'Giọng đọc lõi không thể xóa vĩnh viễn'
                                : 'Core voice cannot be permanently deleted'
                              : undefined
                          }
                          onDelete={(mode) => handleDelete(voice.voiceId, mode)}
                          onRestore={() => handleRestore(voice.voiceId)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
