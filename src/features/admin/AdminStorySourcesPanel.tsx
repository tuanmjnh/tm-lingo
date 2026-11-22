'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Globe,
  Library,
  Loader2,
  Plus,
  RefreshCw,
  Rss,
  Save,
  X,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  DeleteMode,
  StoryCategoryKey,
  StorySourceAdapterType,
  StorySourceConfig,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import { DeleteActionsControl } from './DeleteActionsControl';

interface AdminStorySourcesPanelProps {
  interfaceLocale: string;
  ageGroups: AgeGroupConfig[];
  canPublish: boolean;
  canHardDelete: boolean;
  onSourcesUpdated: () => void;
}

interface CategoryMeta {
  key: StoryCategoryKey;
  labelVi: string;
  labelEn: string;
}

const ADAPTER_LABELS: Record<
  StorySourceAdapterType,
  { vi: string; en: string; placeholderUrl: string }
> = {
  curated_library: {
    vi: 'Kho sách nói & truyện tuyển chọn nội bộ',
    en: 'Curated Built-in Audiobooks & Stories',
    placeholderUrl: 'internal://curated-bilingual',
  },
  librivox: {
    vi: 'Sách nói MP3 nhiều chương (LibriVox)',
    en: 'Multi-Chapter MP3 Audiobooks (LibriVox)',
    placeholderUrl: 'https://librivox.org/api/feed/audiobooks/',
  },
  wikisource: {
    vi: 'Truyện dài & Cổ tích mở (Wikisource)',
    en: 'Open Folklore & Literature (Wikisource)',
    placeholderUrl: 'https://vi.wikisource.org/w/api.php',
  },
  archive_org: {
    vi: 'Kho Sách nói Internet Archive (MP3)',
    en: 'Internet Archive Audiobooks (MP3)',
    placeholderUrl: 'https://archive.org/advancedsearch.php',
  },
  gutendex: {
    vi: 'Thư viện sách mở (Gutendex)',
    en: 'Open Books Library (Gutendex)',
    placeholderUrl: 'https://gutendex.com/books',
  },
  rss: {
    vi: 'Kênh truyện tự động (RSS / Atom)',
    en: 'Storytelling Feed (RSS / Atom)',
    placeholderUrl: 'https://example.org/stories/feed.xml',
  },
  json_catalog: {
    vi: 'Danh mục truyện JSON',
    en: 'Custom JSON Story Catalog',
    placeholderUrl: 'https://example.org/stories.json',
  },
};

export function AdminStorySourcesPanel({
  interfaceLocale,
  ageGroups,
  canPublish,
  canHardDelete,
  onSourcesUpdated,
}: AdminStorySourcesPanelProps) {
  const isVi = interfaceLocale === 'vi';

  const [sources, setSources] = useState<StorySourceConfig[]>([]);
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<'active' | 'archived'>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Add / Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formId, setFormId] = useState('');
  const [formNameVi, setFormNameVi] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formDescVi, setFormDescVi] = useState('');
  const [formDescEn, setFormDescEn] = useState('');
  const [formAdapter, setFormAdapter] = useState<StorySourceAdapterType>('rss');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formCategories, setFormCategories] = useState<StoryCategoryKey[]>([
    'fables',
    'bedtime',
  ]);
  const [formAgeBands, setFormAgeBands] = useState<string[]>(['3-5', '6-8']);
  const [formLocale, setFormLocale] = useState('en');
  const [formSortOrder, setFormSortOrder] = useState(10);
  const [formEnabled, setFormEnabled] = useState(true);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.listAdminStorySources({
        includeArchived: true,
      });
      setSources(res.sources);
      setCategories(res.categories);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load story sources'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const activeItems = sources.filter((s) => !s.archivedAt);
  const archivedItems = sources.filter((s) => Boolean(s.archivedAt));
  const visibleItems = viewFilter === 'active' ? activeItems : archivedItems;

  const openCreateForm = () => {
    setEditingId(null);
    setFormId('');
    setFormNameVi('');
    setFormNameEn('');
    setFormDescVi('');
    setFormDescEn('');
    setFormAdapter('rss');
    setFormBaseUrl('');
    setFormCategories(['fables', 'bedtime']);
    setFormAgeBands(['3-5', '6-8']);
    setFormLocale('en');
    setFormSortOrder(activeItems.length + 1);
    setFormEnabled(true);
    setShowForm(true);
    setError(null);
    setNotice(null);
  };

  const openEditForm = (src: StorySourceConfig) => {
    setEditingId(src.id);
    setFormId(src.id);
    setFormNameVi(src.name.vi);
    setFormNameEn(src.name.en);
    setFormDescVi(src.description.vi);
    setFormDescEn(src.description.en);
    setFormAdapter(src.adapterType);
    setFormBaseUrl(src.baseUrl);
    setFormCategories(src.categories);
    setFormAgeBands(src.ageBands);
    setFormLocale(src.defaultLocale);
    setFormSortOrder(src.sortOrder);
    setFormEnabled(src.enabled);
    setShowForm(true);
    setError(null);
    setNotice(null);
  };

  const toggleCategory = (key: StoryCategoryKey) => {
    setFormCategories((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  const toggleAgeBand = (bandId: string) => {
    setFormAgeBands((prev) => {
      if (prev.includes(bandId)) {
        return prev.length > 1 ? prev.filter((b) => b !== bandId) : prev;
      }
      return [...prev, bandId];
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const normalizedUrl =
        formAdapter === 'curated_library'
          ? formBaseUrl.trim() || 'internal://curated-bilingual'
          : formBaseUrl.trim();

      if (editingId) {
        await apiClient.updateAdminStorySource(editingId, {
          name: { vi: formNameVi.trim(), en: formNameEn.trim() || formNameVi.trim() },
          description: {
            vi: formDescVi.trim() || formNameVi.trim(),
            en: formDescEn.trim() || formDescVi.trim() || formNameEn.trim(),
          },
          adapterType: formAdapter,
          baseUrl: normalizedUrl,
          categories: formCategories,
          ageBands: formAgeBands,
          defaultLocale: formLocale.trim() || 'en',
          supportedLocales: Array.from(new Set([formLocale.trim() || 'en'])),
          enabled: formEnabled,
          sortOrder: formSortOrder,
        });
        setNotice(
          isVi
            ? `Đã cập nhật nguồn truyện "${formNameVi.trim()}".`
            : `Updated story source "${formNameEn.trim() || formNameVi.trim()}".`
        );
      } else {
        const cleanId =
          formId.trim().toLowerCase() ||
          `src-${formNameVi
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 28) || Date.now()}`;

        await apiClient.createAdminStorySource({
          id: cleanId,
          name: { vi: formNameVi.trim(), en: formNameEn.trim() || formNameVi.trim() },
          description: {
            vi: formDescVi.trim() || formNameVi.trim(),
            en: formDescEn.trim() || formDescVi.trim() || formNameEn.trim(),
          },
          adapterType: formAdapter,
          baseUrl: normalizedUrl,
          categories: formCategories,
          ageBands: formAgeBands,
          defaultLocale: formLocale.trim() || 'en',
          supportedLocales: Array.from(new Set([formLocale.trim() || 'en'])),
          enabled: formEnabled,
          sortOrder: formSortOrder,
        });
        setNotice(
          isVi
            ? `Đã thêm nguồn truyện mới "${formNameVi.trim()}".`
            : `Added story source "${formNameEn.trim() || formNameVi.trim()}".`
        );
      }

      setShowForm(false);
      setEditingId(null);
      await loadSources();
      onSourcesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (src: StorySourceConfig) => {
    if (!canPublish) return;
    setBusyId(src.id);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.updateAdminStorySource(src.id, {
        enabled: !src.enabled,
      });
      setSources((prev) =>
        prev.map((item) => (item.id === src.id ? res.source : item))
      );
      setNotice(
        res.source.enabled
          ? isVi
            ? `Đã bật nguồn "${src.name.vi}".`
            : `Enabled "${src.name.en}".`
          : isVi
            ? `Đã tạm tắt nguồn "${src.name.vi}".`
            : `Disabled "${src.name.en}".`
      );
      onSourcesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleTestSource = async (src: StorySourceConfig) => {
    setTestingId(src.id);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.testAdminStorySource(src.id);
      if (res.source) {
        setSources((prev) =>
          prev.map((item) => (item.id === src.id ? res.source! : item))
        );
      }
      if (res.ok) {
        setNotice(`${src.name.vi}: ${res.message}`);
      } else {
        setError(`${src.name.vi}: ${res.message}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, mode: DeleteMode) => {
    if (!canPublish) return;
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiClient.deleteAdminStorySource(id, mode);
      setNotice(
        mode === 'hard'
          ? isVi
            ? `Đã xóa vĩnh viễn nguồn truyện ${id}.`
            : `Permanently deleted story source ${id}.`
          : isVi
            ? `Đã lưu trữ nguồn truyện ${id} (có thể khôi phục).`
            : `Archived story source ${id} (restorable).`
      );
      await loadSources();
      onSourcesUpdated();
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
      await apiClient.restoreAdminStorySource(id);
      setNotice(
        isVi ? `Đã khôi phục nguồn truyện ${id}.` : `Restored story source ${id}.`
      );
      await loadSources();
      onSourcesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
              <Rss className="w-5 h-5 text-sky-600" aria-hidden="true" />
              <span>
                {isVi
                  ? 'Quản lý Nguồn Truyện Kể Chuyện'
                  : 'Storytelling Sources Management'}
              </span>
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              {isVi
                ? 'Kết nối, bật/tắt, kiểm tra trực tiếp và phân loại các nguồn truyện kể cho mục "Khám phá & Tải truyện". Mọi địa chỉ nguồn ngoài đều được kiểm duyệt an toàn trước khi kết nối.'
                : 'Connect, test, categorize, and control storytelling sources available in the reader discovery shelf. All external feed addresses are validated safely before fetching.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewFilter('active')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  viewFilter === 'archived'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isVi ? 'Đã lưu trữ' : 'Archived'} ({archivedItems.length})
              </button>
            </div>

            {canPublish && (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{isVi ? 'Thêm nguồn truyện' : 'Add Story Source'}</span>
              </button>
            )}
          </div>
        </div>

        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Add / Edit Source Form */}
      {showForm && canPublish && (
        <form
          onSubmit={handleSubmitForm}
          className="rounded-2xl border border-sky-200 bg-sky-50/40 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              {editingId
                ? isVi
                  ? `Chỉnh sửa nguồn: ${editingId}`
                  : `Edit Source: ${editingId}`
                : isVi
                  ? 'Thêm nguồn truyện kể mới'
                  : 'Add New Storytelling Source'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-white cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Mã định danh (slug)' : 'Source ID (slug)'}</span>
              <input
                type="text"
                value={formId}
                disabled={Boolean(editingId)}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="src-truyen-thieu-nhi"
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal disabled:bg-slate-100"
              />
            </label>

            <label className="space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Tên nguồn (Tiếng Việt) *' : 'Source Name (Vietnamese) *'}</span>
              <input
                type="text"
                required
                value={formNameVi}
                onChange={(e) => setFormNameVi(e.target.value)}
                placeholder={isVi ? 'Ví dụ: Kênh Truyện Ngủ Ngon' : 'e.g. Bedtime Stories Feed'}
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal"
              />
            </label>

            <label className="space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Tên nguồn (English)' : 'Source Name (English)'}</span>
              <input
                type="text"
                value={formNameEn}
                onChange={(e) => setFormNameEn(e.target.value)}
                placeholder="Bedtime Stories Feed"
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <label className="md:col-span-4 space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Loại kết nối nguồn *' : 'Source Connector Type *'}</span>
              <select
                value={formAdapter}
                onChange={(e) =>
                  setFormAdapter(e.target.value as StorySourceAdapterType)
                }
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal"
              >
                {(
                  Object.keys(ADAPTER_LABELS) as StorySourceAdapterType[]
                ).map((key) => (
                  <option key={key} value={key}>
                    {isVi ? ADAPTER_LABELS[key].vi : ADAPTER_LABELS[key].en}
                  </option>
                ))}
              </select>
            </label>

            <label className="md:col-span-5 space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Đường dẫn nguồn (HTTPS URL) *' : 'Source URL (HTTPS) *'}</span>
              <input
                type="text"
                required={formAdapter !== 'curated_library'}
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder={ADAPTER_LABELS[formAdapter].placeholderUrl}
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal"
              />
            </label>

            <label className="md:col-span-2 space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Ngôn ngữ chính' : 'Primary Language'}</span>
              <select
                value={formLocale}
                onChange={(e) => setFormLocale(e.target.value)}
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal"
              >
                <option value="vi">Tiếng Việt (vi)</option>
                <option value="en">English (en)</option>
                <option value="fr">Français (fr)</option>
                <option value="es">Español (es)</option>
                <option value="de">Deutsch (de)</option>
              </select>
            </label>

            <label className="md:col-span-1 space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Thứ tự' : 'Order'}</span>
              <input
                type="number"
                min={1}
                max={99}
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value) || 1)}
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-2 text-xs font-normal"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Mô tả ngắn (Tiếng Việt)' : 'Short Description (VI)'}</span>
              <input
                type="text"
                value={formDescVi}
                onChange={(e) => setFormDescVi(e.target.value)}
                placeholder={
                  isVi
                    ? 'Mô tả loại truyện và đối tượng phù hợp...'
                    : 'Describe story style and target readers...'
                }
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              <span>{isVi ? 'Mô tả ngắn (English)' : 'Short Description (EN)'}</span>
              <input
                type="text"
                value={formDescEn}
                onChange={(e) => setFormDescEn(e.target.value)}
                placeholder="Describe story style and target readers..."
                className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal"
              />
            </label>
          </div>

          {/* Categories checkboxes */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">
              {isVi ? 'Danh mục truyện hỗ trợ' : 'Supported Categories'}
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const checked = formCategories.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => toggleCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isVi ? cat.labelVi : cat.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Age bands checkboxes */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">
              {isVi ? 'Nhóm tuổi phù hợp' : 'Recommended Age Groups'}
            </p>
            <div className="flex flex-wrap gap-2">
              {ageGroups.map((group) => {
                const checked = formAgeBands.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleAgeBand(group.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isVi ? group.shortLabels.vi : group.shortLabels.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
                className="w-4 h-4 accent-sky-600"
              />
              <span>
                {isVi
                  ? 'Hiển thị ngay cho người dùng ở mục Khám phá truyện'
                  : 'Enable immediately in user Story Discovery'}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{isVi ? 'Lưu nguồn truyện' : 'Save Source'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Sources List */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {isVi ? 'Đang tải danh sách nguồn truyện...' : 'Loading story sources...'}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-2">
          <Library className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">
            {viewFilter === 'active'
              ? isVi
                ? 'Chưa có nguồn truyện nào đang hoạt động.'
                : 'No active story sources.'
              : isVi
                ? 'Không có nguồn truyện nào trong kho lưu trữ.'
                : 'No archived story sources.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleItems.map((src) => {
            const isBusy = busyId === src.id;
            const isTesting = testingId === src.id;
            const adapterLabel =
              ADAPTER_LABELS[src.adapterType]?.[isVi ? 'vi' : 'en'] ??
              src.adapterType;

            return (
              <article
                key={src.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {isVi ? src.name.vi : src.name.en}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                          src.archivedAt
                            ? 'bg-slate-100 text-slate-600'
                            : src.enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {src.archivedAt
                          ? isVi
                            ? 'Đã lưu trữ'
                            : 'Archived'
                          : src.enabled
                            ? isVi
                              ? 'Đang bật'
                              : 'Enabled'
                            : isVi
                              ? 'Đang tắt'
                              : 'Paused'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {adapterLabel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      {isVi ? src.description.vi : src.description.en}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                      <span className="inline-flex items-center gap-1 break-all">
                        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        {src.baseUrl}
                      </span>
                      <span>
                        {isVi ? 'Ngôn ngữ:' : 'Locale:'}{' '}
                        <strong>{src.supportedLocales.join(', ').toUpperCase()}</strong>
                      </span>
                      <span>
                        {isVi ? 'Độ tuổi:' : 'Ages:'}{' '}
                        <strong>{src.ageBands.join(', ')}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!src.archivedAt && (
                      <>
                        <button
                          type="button"
                          disabled={isTesting}
                          onClick={() => void handleTestSource(src)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-60"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>
                            {isTesting
                              ? isVi
                                ? 'Đang kiểm tra...'
                                : 'Testing...'
                              : isVi
                                ? 'Kiểm tra kết nối'
                                : 'Test Connection'}
                          </span>
                        </button>

                        {canPublish && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleToggleEnabled(src)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                                src.enabled
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {src.enabled
                                ? isVi
                                  ? 'Tạm tắt'
                                  : 'Pause'
                                : isVi
                                  ? 'Bật nguồn'
                                  : 'Enable'}
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(src)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{isVi ? 'Sửa' : 'Edit'}</span>
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {canPublish && (
                      <DeleteActionsControl
                        isVi={isVi}
                        isArchived={Boolean(src.archivedAt)}
                        canHardDelete={canHardDelete}
                        busy={isBusy}
                        onDelete={(mode) => void handleDelete(src.id, mode)}
                        onRestore={() => void handleRestore(src.id)}
                      />
                    )}
                  </div>
                </div>

                {/* Categories + Last Test Result */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {src.categories.map((catKey) => {
                      const cat = categories.find((c) => c.key === catKey);
                      return (
                        <span
                          key={catKey}
                          className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-medium"
                        >
                          {cat ? (isVi ? cat.labelVi : cat.labelEn) : catKey}
                        </span>
                      );
                    })}
                  </div>

                  {src.lastTestMessage && (
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        src.lastTestStatus === 'error'
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {src.lastTestStatus === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>{src.lastTestMessage}</span>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
