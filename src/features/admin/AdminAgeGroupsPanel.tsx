'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Plus,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  AgeGroupStage,
  AgeGroupUiProfile,
  ContentStatus,
  DeleteMode,
  LearningLevel,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import { DeleteActionsControl } from './DeleteActionsControl';

interface AdminAgeGroupsPanelProps {
  interfaceLocale: string;
  canPublish: boolean;
  canHardDelete?: boolean;
  onAgeGroupsUpdated: () => void;
}

const ACCENT_PREVIEW: Record<AgeGroupUiProfile['accentTone'], string> = {
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
};

export function AdminAgeGroupsPanel({
  interfaceLocale,
  canPublish,
  canHardDelete = false,
  onAgeGroupsUpdated,
}: AdminAgeGroupsPanelProps) {
  const isVi = interfaceLocale === 'vi';
  const [ageGroups, setAgeGroups] = useState<AgeGroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'active' | 'archived'>('active');

  // Add new age group form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newStage, setNewStage] = useState<AgeGroupStage>('custom');
  const [newMinAge, setNewMinAge] = useState(19);
  const [newMaxAge, setNewMaxAge] = useState(22);
  const [newGradesText, setNewGradesText] = useState('');
  const [newGradeRangeVi, setNewGradeRangeVi] = useState('');
  const [newGradeRangeEn, setNewGradeRangeEn] = useState('');
  const [newNameVi, setNewNameVi] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newCefr, setNewCefr] = useState('B2 – C1');
  const [newLevel, setNewLevel] = useState<LearningLevel>('advanced');
  const [creating, setCreating] = useState(false);

  const loadAgeGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.listAdminAgeGroups({ includeArchived: true });
      setAgeGroups(res.ageGroups);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load age groups'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgeGroups();
  }, [loadAgeGroups]);

  const activeItems = ageGroups.filter((g) => !g.archivedAt);
  const archivedItems = ageGroups.filter((g) => Boolean(g.archivedAt));
  const visibleItems = viewFilter === 'active' ? activeItems : archivedItems;

  const handlePatch = async (
    group: AgeGroupConfig,
    patch: Omit<
      Parameters<typeof apiClient.updateAdminAgeGroup>[1],
      'uiProfile'
    > & {
      uiProfile?: Partial<AgeGroupConfig['uiProfile']>;
    }
  ) => {
    if (!canPublish) return;
    setBusyId(group.id);
    setError(null);
    setNotice(null);
    try {
      const mergedPatch: Parameters<typeof apiClient.updateAdminAgeGroup>[1] = {
        ...patch,
        uiProfile: patch.uiProfile
          ? { ...group.uiProfile, ...patch.uiProfile }
          : undefined,
      };
      const res = await apiClient.updateAdminAgeGroup(group.id, mergedPatch);
      setAgeGroups((prev) =>
        prev.map((item) => (item.id === group.id ? res.ageGroup : item))
      );
      setNotice(
        isVi
          ? `Đã lưu cấu hình nhóm tuổi ${res.ageGroup.shortLabels.vi}.`
          : `Saved configuration for ${res.ageGroup.shortLabels.en}.`
      );
      onAgeGroupsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, mode: DeleteMode) => {
    if (!canPublish) return;
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiClient.deleteAdminAgeGroup(id, mode);
      setNotice(
        mode === 'hard'
          ? isVi
            ? `Đã xóa vĩnh viễn nhóm tuổi ${id}.`
            : `Permanently deleted age group ${id}.`
          : isVi
            ? `Đã lưu trữ nhóm tuổi ${id} (có thể khôi phục).`
            : `Archived age group ${id} (restorable).`
      );
      await loadAgeGroups();
      onAgeGroupsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (id: string) => {
    if (!canPublish) return;
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiClient.restoreAdminAgeGroup(id);
      setNotice(
        isVi ? `Đã khôi phục nhóm tuổi ${id}.` : `Restored age group ${id}.`
      );
      await loadAgeGroups();
      onAgeGroupsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newNameVi.trim() || !newNameEn.trim()) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const parsedGrades = newGradesText
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);

      const gradeVi = newGradeRangeVi.trim() || `${newMinAge}–${newMaxAge} tuổi`;
      const gradeEn = newGradeRangeEn.trim() || `Ages ${newMinAge}–${newMaxAge}`;

      await apiClient.createAdminAgeGroup({
        id: newId.trim().toLowerCase(),
        stage: newStage,
        minAge: newMinAge,
        maxAge: newMaxAge,
        grades: parsedGrades,
        gradeRange: { vi: gradeVi, en: gradeEn },
        displayNames: { vi: newNameVi.trim(), en: newNameEn.trim() },
        shortLabels: {
          vi: `${newMinAge}–${newMaxAge} tuổi · ${gradeVi}`,
          en: `Ages ${newMinAge}–${newMaxAge} · ${gradeEn}`,
        },
        descriptions: {
          vi: `Lộ trình học tập dành riêng cho nhóm ${newNameVi.trim()}.`,
          en: `Tailored learning pathway for ${newNameEn.trim()}.`,
        },
        cefrRange: newCefr.trim() || 'A2 – B1',
        defaultLearningLevel: newLevel,
        contentStatus: 'planned',
        enabled: true,
        sortOrder: ageGroups.length + 1,
        uiProfile: {
          visualDensity: newMinAge >= 12 ? 'medium' : 'low',
          typographyScale: newMinAge >= 12 ? 'standard' : 'comfortable',
          touchTarget: newMinAge >= 12 ? 'md' : 'lg',
          accentTone: 'indigo',
          illustrationEmphasis: newMinAge >= 15 ? 'text-focused' : 'balanced',
          showPhoneticsByDefault: newMinAge >= 6,
          showBilingualExplanation: true,
          defaultAudioSpeed: newMinAge >= 12 ? 1.0 : 0.92,
          defaultDailyMinutes: newMinAge >= 12 ? 30 : 20,
          recommendedModes: [
            'guided',
            'flashcards',
            'listening',
            'game',
            'explore',
            'story',
          ],
          interactionPacing: newMinAge >= 12 ? 'self-paced' : 'guided-step',
          gamificationStyle:
            newMinAge >= 15 ? 'progress-metrics' : 'badges-streaks',
        },
      });
      setNewId('');
      setNewNameVi('');
      setNewNameEn('');
      setNewGradeRangeVi('');
      setNewGradeRangeEn('');
      setNewGradesText('');
      setShowAddForm(false);
      setNotice(
        isVi
          ? 'Đã thêm nhóm tuổi mới vào danh mục.'
          : 'Added new age group to the catalog.'
      );
      await loadAgeGroups();
      onAgeGroupsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add age group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
            <GraduationCap className="w-4 h-4" aria-hidden="true" />
            <span>
              {isVi
                ? 'Lộ trình độ tuổi Mầm non – Lớp 12'
                : 'Preschool through Grade 12 Age Groups'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isVi
              ? 'Cấu hình Nhóm tuổi & Giao diện thích ứng'
              : 'Age Groups & Adaptive UI Configuration'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {isVi
              ? 'Cấu hình sẵn đầy đủ 5 nhóm tuổi từ Mầm non (3–5 tuổi) đến hết Lớp 12 (15–18 tuổi). Mỗi nhóm có mật độ giao diện, cỡ chữ, tốc độ đọc và thời lượng học mặc định riêng, đồng thời cho phép mở rộng thêm nhóm mới bất cứ lúc nào.'
              : 'Pre-configured across 5 developmental bands from Preschool (3–5) through Grade 12 (15–18). Each group defines its adaptive interface density, typography, audio speed, and daily study defaults, and you can add new groups anytime.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => setViewFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer whitespace-nowrap ${
                viewFilter === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Đang dùng' : 'Active'} ({activeItems.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer whitespace-nowrap ${
                viewFilter === 'archived'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Lưu trữ' : 'Archived'} ({archivedItems.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() => void loadAgeGroups()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
          </button>
          {canPublish && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Thêm nhóm tuổi' : 'Add Age Group'}</span>
            </button>
          )}
        </div>
      </div>

      {showAddForm && canPublish && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4"
        >
          <p className="text-sm font-bold text-slate-900">
            {isVi ? 'Thêm nhóm tuổi mới' : 'Create Custom Age Group'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Mã nhóm (vd: 19-22)' : 'Group ID (e.g. 19-22)'}
              </span>
              <input
                type="text"
                required
                pattern="[a-z0-9-]+"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="19-22"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tuổi nhỏ nhất' : 'Min age'}
              </span>
              <input
                type="number"
                min={2}
                max={25}
                required
                value={newMinAge}
                onChange={(e) => setNewMinAge(Number(e.target.value))}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tuổi lớn nhất' : 'Max age'}
              </span>
              <input
                type="number"
                min={2}
                max={99}
                required
                value={newMaxAge}
                onChange={(e) => setNewMaxAge(Number(e.target.value))}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Khung trình độ (CEFR)' : 'CEFR Range'}
              </span>
              <input
                type="text"
                value={newCefr}
                onChange={(e) => setNewCefr(e.target.value)}
                placeholder="B2 – C1"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tên hiển thị (Tiếng Việt)' : 'Display Name (VI)'}
              </span>
              <input
                type="text"
                required
                value={newNameVi}
                onChange={(e) => setNewNameVi(e.target.value)}
                placeholder="Sinh viên & Người mới đi làm"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tên hiển thị (English)' : 'Display Name (EN)'}
              </span>
              <input
                type="text"
                required
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="University & Young Adults"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Cấp học (VI)' : 'Grade Range (VI)'}
              </span>
              <input
                type="text"
                value={newGradeRangeVi}
                onChange={(e) => setNewGradeRangeVi(e.target.value)}
                placeholder="Đại học"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Các lớp (vd: 10,11,12)' : 'Grades (e.g. 10,11,12)'}
              </span>
              <input
                type="text"
                value={newGradesText}
                onChange={(e) => setNewGradesText(e.target.value)}
                placeholder="10, 11, 12"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Cấp học (EN)' : 'Grade Range (EN)'}
              </span>
              <input
                type="text"
                value={newGradeRangeEn}
                onChange={(e) => setNewGradeRangeEn(e.target.value)}
                placeholder="University"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Phân bậc' : 'Stage'}
              </span>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value as AgeGroupStage)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="preschool">{isVi ? 'Mầm non' : 'Preschool'}</option>
                <option value="primary_lower">{isVi ? 'Tiểu học nền tảng' : 'Lower Primary'}</option>
                <option value="primary_upper">{isVi ? 'Tiểu học nâng cao' : 'Upper Primary'}</option>
                <option value="middle_school">{isVi ? 'THCS' : 'Middle School'}</option>
                <option value="high_school">{isVi ? 'THPT' : 'High School'}</option>
                <option value="custom">{isVi ? 'Tùy chỉnh' : 'Custom'}</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Mức độ mặc định' : 'Default Level'}
              </span>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value as LearningLevel)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="starter">Starter</option>
                <option value="foundation">Foundation</option>
                <option value="elementary">Elementary</option>
                <option value="intermediate">Intermediate</option>
                <option value="upper_intermediate">Upper-Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
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
                  ? 'Lưu nhóm tuổi'
                  : 'Save Age Group'}
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
        <div className="space-y-3 animate-pulse">
          <div className="h-20 rounded-xl bg-slate-100" />
          <div className="h-20 rounded-xl bg-slate-100" />
          <div className="h-20 rounded-xl bg-slate-100" />
        </div>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">
          {viewFilter === 'archived'
            ? isVi
              ? 'Chưa có nhóm tuổi nào trong kho lưu trữ.'
              : 'No archived age groups.'
            : isVi
              ? 'Chưa có nhóm tuổi nào.'
              : 'No age groups configured.'}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((group) => {
            const isBusy = busyId === group.id;
            const isArchived = Boolean(group.archivedAt);
            const isCore = group.id === '3-5';
            const isExpanded = expandedId === group.id;

            return (
              <div
                key={group.id}
                className={`rounded-xl border border-slate-200 overflow-hidden ${
                  isArchived ? 'bg-slate-50/70' : 'bg-white'
                }`}
              >
                <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${ACCENT_PREVIEW[group.uiProfile.accentTone]}`}
                        aria-hidden="true"
                      />
                      <h3 className="text-sm font-bold text-slate-900">
                        {isVi ? group.displayNames.vi : group.displayNames.en}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {isVi ? group.gradeRange.vi : group.gradeRange.en} ·{' '}
                      {group.minAge}–{group.maxAge}{' '}
                      {isVi ? 'tuổi' : 'yrs'} · {group.cefrRange} ·{' '}
                      {group.uiProfile.defaultDailyMinutes}{' '}
                      {isVi ? 'phút/ngày' : 'min/day'} ·{' '}
                      {group.uiProfile.defaultAudioSpeed.toFixed(2)}x
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isVi ? group.descriptions.vi : group.descriptions.en}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      disabled={!canPublish || isBusy || isArchived}
                      value={group.contentStatus}
                      onChange={(e) =>
                        void handlePatch(group, {
                          contentStatus: e.target.value as ContentStatus,
                        })
                      }
                      aria-label={isVi ? 'Trạng thái học liệu' : 'Content status'}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="ready">
                        {isVi ? 'Sẵn sàng' : 'Ready'}
                      </option>
                      <option value="partial">
                        {isVi ? 'Đang bổ sung' : 'Partial'}
                      </option>
                      <option value="planned">
                        {isVi ? 'Dự kiến' : 'Planned'}
                      </option>
                    </select>

                    <button
                      type="button"
                      disabled={!canPublish || isBusy || isArchived}
                      onClick={() =>
                        void handlePatch(group, { enabled: !group.enabled })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                        group.enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {group.enabled
                        ? isVi
                          ? 'Đang bật'
                          : 'Enabled'
                        : isVi
                          ? 'Đang tắt'
                          : 'Disabled'}
                    </button>

                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : group.id)
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                      >
                        <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isVi ? 'Giao diện' : 'UI Profile'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    )}

                    {canPublish && (
                      <DeleteActionsControl
                        isArchived={isArchived}
                        isVi={isVi}
                        busy={isBusy}
                        canHardDelete={canHardDelete && !isCore}
                        hardDeleteProtectedHint={
                          isCore
                            ? isVi
                              ? 'Nhóm tuổi cốt lõi không thể xóa vĩnh viễn'
                              : 'Core age group cannot be permanently deleted'
                            : undefined
                        }
                        onDelete={(mode) => handleDelete(group.id, mode)}
                        onRestore={() => handleRestore(group.id)}
                      />
                    )}
                  </div>
                </div>

                {isExpanded && !isArchived && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {isVi ? 'Mật độ giao diện' : 'Visual density'}
                      </span>
                      <select
                        disabled={!canPublish || isBusy}
                        value={group.uiProfile.visualDensity}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              visualDensity: e.target
                                .value as AgeGroupUiProfile['visualDensity'],
                            },
                          })
                        }
                        className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                      >
                        <option value="low">
                          {isVi ? 'Thoáng rộng (Trẻ nhỏ)' : 'Spacious (Young kids)'}
                        </option>
                        <option value="medium">
                          {isVi ? 'Cân đối (Tiểu học – THCS)' : 'Balanced (Primary–Middle)'}
                        </option>
                        <option value="high">
                          {isVi ? 'Tập trung (THPT)' : 'Focused (High School)'}
                        </option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {isVi ? 'Tỷ lệ hình ảnh & chữ' : 'Media emphasis'}
                      </span>
                      <select
                        disabled={!canPublish || isBusy}
                        value={group.uiProfile.illustrationEmphasis}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              illustrationEmphasis: e.target
                                .value as AgeGroupUiProfile['illustrationEmphasis'],
                            },
                          })
                        }
                        className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                      >
                        <option value="picture-first">
                          {isVi ? 'Ưu tiên tranh minh họa' : 'Picture-first'}
                        </option>
                        <option value="balanced">
                          {isVi ? 'Cân bằng hình & văn bản' : 'Balanced'}
                        </option>
                        <option value="text-focused">
                          {isVi ? 'Ưu tiên nội dung học thuật' : 'Text-focused'}
                        </option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {isVi ? 'Thời lượng gợi ý / ngày' : 'Daily goal (min)'}
                      </span>
                      <select
                        disabled={!canPublish || isBusy}
                        value={group.uiProfile.defaultDailyMinutes}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              defaultDailyMinutes: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 tabular-nums"
                      >
                        {[10, 15, 20, 25, 30, 40, 45, 60].map((m) => (
                          <option key={m} value={m}>
                            {m} {isVi ? 'phút' : 'min'}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {isVi ? 'Tốc độ giọng đọc mặc định' : 'Default audio speed'}
                      </span>
                      <select
                        disabled={!canPublish || isBusy}
                        value={group.uiProfile.defaultAudioSpeed}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              defaultAudioSpeed: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 tabular-nums"
                      >
                        {[0.8, 0.85, 0.9, 0.92, 0.95, 0.98, 1.0, 1.05, 1.1].map(
                          (s) => (
                            <option key={s} value={s}>
                              {s.toFixed(2)}x
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {isVi ? 'Tông màu nhấn' : 'Accent tone'}
                      </span>
                      <select
                        disabled={!canPublish || isBusy}
                        value={group.uiProfile.accentTone}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              accentTone: e.target
                                .value as AgeGroupUiProfile['accentTone'],
                            },
                          })
                        }
                        className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                      >
                        <option value="sky">Sky</option>
                        <option value="emerald">Emerald</option>
                        <option value="amber">Amber</option>
                        <option value="indigo">Indigo</option>
                        <option value="violet">Violet</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {isVi ? 'Nhịp độ tương tác' : 'Interaction pacing'}
                      </span>
                      <select
                        disabled={!canPublish || isBusy}
                        value={group.uiProfile.interactionPacing}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              interactionPacing: e.target
                                .value as AgeGroupUiProfile['interactionPacing'],
                            },
                          })
                        }
                        className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                      >
                        <option value="child-led">
                          {isVi ? 'Bé tự khám phá' : 'Child-led'}
                        </option>
                        <option value="guided-step">
                          {isVi ? 'Hướng dẫn từng bước' : 'Guided step'}
                        </option>
                        <option value="self-paced">
                          {isVi ? 'Chủ động tốc độ' : 'Self-paced'}
                        </option>
                      </select>
                    </label>

                    <label className="flex items-center gap-2 pt-5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canPublish || isBusy}
                        checked={group.uiProfile.showPhoneticsByDefault}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              showPhoneticsByDefault: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        {isVi ? 'Hiện phiên âm mặc định' : 'Show phonetics'}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 pt-5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canPublish || isBusy}
                        checked={group.uiProfile.showBilingualExplanation}
                        onChange={(e) =>
                          void handlePatch(group, {
                            uiProfile: {
                              showBilingualExplanation: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        {isVi
                          ? 'Hiện giải thích song ngữ'
                          : 'Show bilingual notes'}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
