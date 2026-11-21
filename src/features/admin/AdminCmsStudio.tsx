'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  FilePlus2,
  History,
  Languages,
  Layers,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  AIProviderConnectionView,
  AgeGroupConfig,
  CmsLearningPackage,
  DeleteMode,
  GenerationJobRecord,
  LocaleConfig,
  MediaAssetRecord,
  PublicationWorkflowStatus,
  StoryBook,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import {
  DraftPreviewModal,
  PackageEditorModal,
  StoryEditorModal,
} from './AdminCmsEditorDrawer';
import { AdaptLocaleModal, SafetyReviewModal } from './CmsAiToolsModal';
import { DeleteActionsControl } from './DeleteActionsControl';
import { SnapshotHistoryModal } from './SnapshotHistoryModal';

interface AdminCmsStudioProps {
  interfaceLocale: string;
  canPublish: boolean;
  canHardDelete?: boolean;
  languages: LocaleConfig[];
  ageGroups: AgeGroupConfig[];
  mediaAssets: MediaAssetRecord[];
  onContentPublished: () => void;
  onMediaChanged: () => void;
}

export function AdminCmsStudio({
  interfaceLocale,
  canPublish,
  canHardDelete = false,
  languages,
  ageGroups,
  mediaAssets,
  onContentPublished,
  onMediaChanged,
}: AdminCmsStudioProps) {
  const isVi = interfaceLocale === 'vi';
  const [packages, setPackages] = useState<CmsLearningPackage[]>([]);
  const [stories, setStories] = useState<StoryBook[]>([]);
  const [jobs, setJobs] = useState<GenerationJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [pkgView, setPkgView] = useState<'active' | 'archived'>('active');
  const [storyView, setStoryView] = useState<'active' | 'archived'>('active');
  const [pkgSearch, setPkgSearch] = useState('');
  const [pkgStatusFilter, setPkgStatusFilter] = useState<'all' | 'draft' | 'in_review' | 'published'>('all');
  const [pkgAgeFilter, setPkgAgeFilter] = useState('all');
  const [storySearch, setStorySearch] = useState('');
  const [storyStatusFilter, setStoryStatusFilter] = useState<'all' | 'draft' | 'in_review' | 'published'>('all');
  const [storyAgeFilter, setStoryAgeFilter] = useState('all');

  // Inline editor & draft preview modal states
  const [editingPackage, setEditingPackage] =
    useState<CmsLearningPackage | null>(null);
  const [editingStory, setEditingStory] = useState<StoryBook | null>(null);
  const [previewTarget, setPreviewTarget] = useState<
    | { kind: 'package'; item: CmsLearningPackage }
    | { kind: 'story'; item: StoryBook }
    | null
  >(null);
  const [historyTarget, setHistoryTarget] = useState<{
    entityType: 'package' | 'story';
    entityId: string;
    title: string;
    currentVersion?: number;
  } | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<{
    entityType: 'package' | 'story';
    entityId: string;
    title: string;
  } | null>(null);
  const [adaptTarget, setAdaptTarget] = useState<{
    entityType: 'package' | 'story';
    entityId: string;
    title: string;
    existingLocales: string[];
  } | null>(null);

  // AI Studio form state
  const [aiConnections, setAiConnections] = useState<
    AIProviderConnectionView[]
  >([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [genKind, setGenKind] = useState<'package' | 'story'>('package');
  const [genTopic, setGenTopic] = useState('');
  const [genAgeBand, setGenAgeBand] = useState('3-5');
  const [genLearningLocale, setGenLearningLocale] = useState('en');
  const [genExplanationLocale, setGenExplanationLocale] = useState('vi');
  const [generating, setGenerating] = useState(false);

  // Manual quick draft package form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitleEn, setManualTitleEn] = useState('');
  const [manualTitleVi, setManualTitleVi] = useState('');
  const [manualWord1, setManualWord1] = useState('');
  const [manualWord1Vi, setManualWord1Vi] = useState('');
  const [manualWord2, setManualWord2] = useState('');
  const [manualWord2Vi, setManualWord2Vi] = useState('');
  const [manualWord3, setManualWord3] = useState('');
  const [manualWord3Vi, setManualWord3Vi] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgRes, storyRes, jobRes] = await Promise.all([
        apiClient.listCmsPackages({ includeArchived: true }),
        apiClient.listCmsStories({ includeArchived: true }),
        apiClient.listGenerationJobs(),
      ]);
      setPackages(pkgRes.packages);
      setStories(storyRes.stories);
      setJobs(jobRes.jobs);
      // Optional: load active AI connections for provenance selector if staff has access
      apiClient
        .listAIProviders()
        .then((aiRes) => {
          setAiConnections(aiRes.connections.filter((c) => c.enabled));
        })
        .catch(() => undefined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load CMS content'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim()) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.generateCmsDraft({
        kind: genKind,
        topic: genTopic.trim(),
        ageBand: genAgeBand,
        learningLocale: genLearningLocale,
        explanationLocale: genExplanationLocale,
        connectionId: selectedConnectionId || undefined,
      });
      setGenTopic('');
      setNotice(
        isVi
          ? `Đã tạo bản nháp ${res.kind === 'package' ? 'gói bài học' : 'truyện kể'} mới qua ${res.providerUsed} (${res.modelUsed}).`
          : `Generated new draft ${res.kind} using ${res.providerUsed} (${res.modelUsed}).`
      );
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'AI content generation failed'
      );
      await loadAll();
    } finally {
      setGenerating(false);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitleEn.trim() || !manualWord1.trim()) return;
    setSavingManual(true);
    setError(null);
    setNotice(null);
    try {
      const slug =
        manualTitleEn
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'custom';
      const rawConcepts = [
        {
          en: manualWord1.trim(),
          vi: manualWord1Vi.trim() || manualWord1.trim(),
          asset: 'img-apple',
        },
        ...(manualWord2.trim()
          ? [
              {
                en: manualWord2.trim(),
                vi: manualWord2Vi.trim() || manualWord2.trim(),
                asset: 'img-banana',
              },
            ]
          : []),
        ...(manualWord3.trim()
          ? [
              {
                en: manualWord3.trim(),
                vi: manualWord3Vi.trim() || manualWord3.trim(),
                asset: 'img-orange',
              },
            ]
          : []),
      ];

      const targetGroup = ageGroups.find((g) => g.id === genAgeBand);
      await apiClient.createCmsPackage({
        topicId: `topic.${slug}`,
        ageBand: [genAgeBand || '3-5'],
        learningLevel: targetGroup?.defaultLearningLevel ?? 'starter',
        learningLocales: ['en'],
        explanationLocales: ['vi', 'en'],
        titles: {
          en: manualTitleEn.trim(),
          vi: manualTitleVi.trim() || manualTitleEn.trim(),
        },
        summaries: {
          en: `Practice ${rawConcepts.map((c) => c.en).join(', ')} with audio and gentle activities.`,
          vi: `Làm quen từ vựng ${rawConcepts.map((c) => c.vi).join(', ')} qua âm thanh và trò chơi nhẹ nhàng.`,
        },
        concepts: rawConcepts.map((c, idx) => ({
          conceptId: `${slug}.item-${idx + 1}`,
          schemaVersion: 1,
          assetRef: c.asset,
          localizations: {
            en: {
              term: c.en,
              example: `This is ${c.en}.`,
              explanation: `A friendly ${c.en} for ages 3–5.`,
            },
            vi: {
              term: c.vi,
              example: `Đây là ${c.vi}.`,
              explanation: `Từ vựng về ${c.vi} dành cho bé 3–5 tuổi.`,
            },
          },
        })),
      });

      setManualTitleEn('');
      setManualTitleVi('');
      setManualWord1('');
      setManualWord1Vi('');
      setManualWord2('');
      setManualWord2Vi('');
      setManualWord3('');
      setManualWord3Vi('');
      setShowManualForm(false);
      setNotice(
        isVi
          ? 'Đã tạo gói bài học nháp mới.'
          : 'Created new draft learning package.'
      );
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create draft package'
      );
    } finally {
      setSavingManual(false);
    }
  };

  const handlePackageStatus = async (
    packageId: string,
    status: PublicationWorkflowStatus
  ) => {
    setBusyId(packageId);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.transitionCmsPackage(packageId, status);
      setNotice(
        res.snapshot
          ? isVi
            ? `Đã xuất bản gói bài học (phiên bản v${res.snapshot.version}). Nội dung đã hiển thị ngay ở trang Học bài.`
            : `Published package (version v${res.snapshot.version}). Now live in the Learn view.`
          : isVi
            ? `Đã chuyển trạng thái gói bài học sang ${status}.`
            : `Updated package status to ${status}.`
      );
      await loadAll();
      onContentPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePackage = async (packageId: string, mode: DeleteMode) => {
    setBusyId(packageId);
    setError(null);
    setNotice(null);
    try {
      await apiClient.deleteCmsPackage(packageId, mode);
      setNotice(
        mode === 'hard'
          ? isVi
            ? 'Đã xóa vĩnh viễn gói bài học.'
            : 'Permanently deleted learning package.'
          : isVi
            ? 'Đã chuyển gói bài học vào kho lưu trữ (có thể khôi phục).'
            : 'Archived learning package (restorable).'
      );
      await loadAll();
      onContentPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete package');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestorePackage = async (packageId: string) => {
    setBusyId(packageId);
    setError(null);
    setNotice(null);
    try {
      await apiClient.restoreCmsPackage(packageId);
      setNotice(
        isVi
          ? 'Đã khôi phục gói bài học về trạng thái bản nháp.'
          : 'Restored learning package to Draft.'
      );
      await loadAll();
      onContentPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleStoryStatus = async (
    storyId: string,
    status: PublicationWorkflowStatus
  ) => {
    setBusyId(storyId);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.transitionCmsStory(storyId, status);
      setNotice(
        res.snapshot
          ? isVi
            ? `Đã xuất bản truyện kể (phiên bản v${res.snapshot.version}).`
            : `Published story (version v${res.snapshot.version}).`
          : isVi
            ? `Đã chuyển trạng thái truyện sang ${status}.`
            : `Updated story status to ${status}.`
      );
      await loadAll();
      onContentPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Story status update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteStory = async (storyId: string, mode: DeleteMode) => {
    setBusyId(storyId);
    setError(null);
    setNotice(null);
    try {
      await apiClient.deleteCmsStory(storyId, mode);
      setNotice(
        mode === 'hard'
          ? isVi
            ? 'Đã xóa vĩnh viễn truyện kể.'
            : 'Permanently deleted story.'
          : isVi
            ? 'Đã chuyển truyện kể vào kho lưu trữ (có thể khôi phục).'
            : 'Archived story (restorable).'
      );
      await loadAll();
      onContentPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete story');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestoreStory = async (storyId: string) => {
    setBusyId(storyId);
    setError(null);
    setNotice(null);
    try {
      await apiClient.restoreCmsStory(storyId);
      setNotice(
        isVi
          ? 'Đã khôi phục truyện kể về trạng thái bản nháp.'
          : 'Restored story to Draft.'
      );
      await loadAll();
      onContentPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  };

  const learningLocales = languages.filter((l) => l.enabled && l.learningEnabled);
  const explanationLocales = languages.filter(
    (l) => l.enabled && l.explanationEnabled
  );

  const activePackages = packages.filter((p) => !p.archivedAt);
  const archivedPackages = packages.filter((p) => Boolean(p.archivedAt));
  const basePackages = pkgView === 'active' ? activePackages : archivedPackages;
  const visiblePackages = basePackages.filter((pkg) => {
    if (pkgView === 'active' && pkgStatusFilter !== 'all' && pkg.status !== pkgStatusFilter) {
      return false;
    }
    if (pkgAgeFilter !== 'all' && !pkg.ageBand.includes(pkgAgeFilter)) {
      return false;
    }
    const q = pkgSearch.trim().toLowerCase();
    if (q) {
      const hay = `${Object.values(pkg.titles).join(' ')} ${pkg.topicId} ${pkg.ageBand.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const activeStories = stories.filter((s) => !s.archivedAt);
  const archivedStories = stories.filter((s) => Boolean(s.archivedAt));
  const baseStories = storyView === 'active' ? activeStories : archivedStories;
  const visibleStories = baseStories.filter((story) => {
    if (storyView === 'active' && storyStatusFilter !== 'all' && story.status !== storyStatusFilter) {
      return false;
    }
    if (storyAgeFilter !== 'all' && !story.ageBands.includes(storyAgeFilter)) {
      return false;
    }
    const q = storySearch.trim().toLowerCase();
    if (q) {
      const hay = `${Object.values(story.titles).join(' ')} ${story.ageBands.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const getPackageWarnings = (pkg: CmsLearningPackage): string[] => {
    const warnings: string[] = [];
    const missingVi = pkg.concepts.some((c) => !c.localizations.vi?.term?.trim());
    if (missingVi) warnings.push(isVi ? 'Thiếu dịch tiếng Việt' : 'Missing VI text');
    const missingAudio = pkg.concepts.some((c) => !c.localizations.en?.audioUrl);
    if (missingAudio) warnings.push(isVi ? 'Chưa có giọng thu sẵn' : 'No recorded audio');
    return warnings;
  };

  const getStoryWarnings = (story: StoryBook): string[] => {
    const warnings: string[] = [];
    const missingVi = story.segments.some(
      (s) => !s.explanationByLocale?.vi?.trim() && !s.textByLocale?.vi?.trim()
    );
    if (missingVi) warnings.push(isVi ? 'Thiếu giải thích VI' : 'Missing VI note');
    const missingAudio = story.segments.some((s) => !s.audioUrlByLocale?.en);
    if (missingAudio) warnings.push(isVi ? 'Chưa có giọng thu sẵn' : 'No recorded audio');
    return warnings;
  };

  const statusText = (s: PublicationWorkflowStatus) => {
    if (s === 'published') return isVi ? 'Đã xuất bản' : 'Published';
    if (s === 'in_review') return isVi ? 'Chờ duyệt' : 'In Review';
    if (s === 'archived') return isVi ? 'Đã lưu trữ' : 'Archived';
    return isVi ? 'Bản nháp' : 'Draft';
  };

  return (
    <div className="space-y-6">
      {/* AI Content Studio Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>AI Content Studio</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {isVi
                ? 'Soạn thảo học liệu bằng AI (Draft → Review → Publish)'
                : 'AI Curriculum Drafting (Draft → Review → Publish)'}
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              {isVi
                ? 'Sinh bản nháp gói từ vựng hoặc truyện kể đa ngôn ngữ, chỉnh sửa chi tiết từng thẻ, tạo giọng đọc AI và xem thử trực tiếp trước khi xuất bản.'
                : 'Generate multilingual vocabulary packages or stories, edit cards/pages inline, synthesize AI voices, and preview drafts before publishing.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {aiConnections.length > 0 && (
              <select
                value={selectedConnectionId}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                aria-label="AI Provider Connection"
                className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                <option value="">
                  {isVi ? 'AI mặc định (Auto)' : 'Default AI (Auto)'}
                </option>
                {aiConnections.map((conn) => (
                  <option key={conn.connectionId} value={conn.connectionId}>
                    {conn.providerName} · {conn.connectionId}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setShowManualForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Tạo nháp thủ công' : 'Manual Draft'}</span>
            </button>
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleGenerate}
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <label className="md:col-span-2 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {isVi ? 'Loại nội dung' : 'Type'}
            </span>
            <select
              value={genKind}
              onChange={(e) =>
                setGenKind(e.target.value as 'package' | 'story')
              }
              className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="package">
                {isVi ? 'Gói bài học' : 'Learning Package'}
              </option>
              <option value="story">
                {isVi ? 'Truyện kể' : 'Picture Story'}
              </option>
            </select>
          </label>

          <label className="md:col-span-3 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {isVi
                ? 'Chủ đề (vd: Động vật, Du lịch)'
                : 'Topic (e.g. Animals, Travel)'}
            </span>
            <input
              type="text"
              required
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder={
                isVi ? 'Động vật nông trại / Farm Animals' : 'Farm Animals'
              }
              className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </label>

          <label className="md:col-span-2 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {isVi ? 'Nhóm tuổi' : 'Age Group'}
            </span>
            <select
              value={genAgeBand}
              onChange={(e) => setGenAgeBand(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              {(ageGroups.length > 0
                ? ageGroups
                : [
                    {
                      id: '3-5',
                      shortLabels: {
                        vi: '3–5 tuổi · Mầm non',
                        en: 'Ages 3–5 · Preschool',
                      },
                    },
                  ]
              ).map((g) => (
                <option key={g.id} value={g.id}>
                  {isVi ? g.shortLabels.vi : g.shortLabels.en}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {isVi ? 'Ngôn ngữ học' : 'Learn'}
            </span>
            <select
              value={genLearningLocale}
              onChange={(e) => setGenLearningLocale(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              {(learningLocales.length > 0
                ? learningLocales
                : [{ locale: 'en', nativeName: 'English' }]
              ).map((l) => (
                <option key={l.locale} value={l.locale}>
                  {l.nativeName} ({l.locale})
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-1 block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              {isVi ? 'Giải thích' : 'Explain'}
            </span>
            <select
              value={genExplanationLocale}
              onChange={(e) => setGenExplanationLocale(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              {(explanationLocales.length > 0
                ? explanationLocales
                : [
                    { locale: 'vi', nativeName: 'Tiếng Việt' },
                    { locale: 'en', nativeName: 'English' },
                  ]
              ).map((l) => (
                <option key={l.locale} value={l.locale}>
                  {l.nativeName} ({l.locale})
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={generating || !genTopic.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">
                {generating
                  ? isVi
                    ? 'Đang tạo...'
                    : 'Generating...'
                  : isVi
                    ? 'Sinh nháp AI'
                    : 'Generate'}
              </span>
            </button>
          </div>
        </form>

        {showManualForm && (
          <form
            onSubmit={handleManualCreate}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
          >
            <p className="text-sm font-bold text-slate-900">
              {isVi
                ? 'Tạo nhanh gói bài học nháp (Thủ công)'
                : 'Create Draft Package Manually'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={manualTitleEn}
                onChange={(e) => setManualTitleEn(e.target.value)}
                placeholder="English Title (e.g. Colors)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                value={manualTitleVi}
                onChange={(e) => setManualTitleVi(e.target.value)}
                placeholder="Tiêu đề tiếng Việt (vd: Màu sắc)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                required
                value={manualWord1}
                onChange={(e) => setManualWord1(e.target.value)}
                placeholder="Word 1 (EN, e.g. Red)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                value={manualWord1Vi}
                onChange={(e) => setManualWord1Vi(e.target.value)}
                placeholder="Từ 1 (VI, vd: Màu đỏ)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                value={manualWord2}
                onChange={(e) => setManualWord2(e.target.value)}
                placeholder="Word 2 (EN, e.g. Blue)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                value={manualWord2Vi}
                onChange={(e) => setManualWord2Vi(e.target.value)}
                placeholder="Từ 2 (VI, vd: Màu xanh dương)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                value={manualWord3}
                onChange={(e) => setManualWord3(e.target.value)}
                placeholder="Word 3 (EN, e.g. Yellow)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                value={manualWord3Vi}
                onChange={(e) => setManualWord3Vi(e.target.value)}
                placeholder="Từ 3 (VI, vd: Màu vàng)"
                className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={savingManual}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {savingManual
                  ? isVi
                    ? 'Đang lưu...'
                    : 'Saving...'
                  : isVi
                    ? 'Lưu bản nháp'
                    : 'Save Draft'}
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
      </section>

      {/* Learning Packages Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-900">
              {isVi
                ? 'Gói bài học'
                : 'Learning Packages'}
            </h3>
          </div>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => setPkgView('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                pkgView === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Đang hoạt động' : 'Active'} ({activePackages.length})
            </button>
            <button
              type="button"
              onClick={() => setPkgView('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                pkgView === 'archived'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Đã lưu trữ' : 'Archived'} ({archivedPackages.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-6 relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={pkgSearch}
              onChange={(e) => setPkgSearch(e.target.value)}
              placeholder={
                isVi
                  ? 'Tìm kiếm gói bài học theo tên hoặc chủ đề...'
                  : 'Search packages by title or topic...'
              }
              className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>
          <select
            value={pkgAgeFilter}
            onChange={(e) => setPkgAgeFilter(e.target.value)}
            aria-label={isVi ? 'Lọc theo nhóm tuổi' : 'Filter by age group'}
            className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
          >
            <option value="all">{isVi ? 'Mọi nhóm tuổi' : 'All age groups'}</option>
            {ageGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {isVi ? g.shortLabels.vi : g.shortLabels.en}
              </option>
            ))}
          </select>
          <select
            value={pkgStatusFilter}
            onChange={(e) =>
              setPkgStatusFilter(
                e.target.value as 'all' | 'draft' | 'in_review' | 'published'
              )
            }
            disabled={pkgView === 'archived'}
            aria-label={isVi ? 'Lọc theo trạng thái' : 'Filter by status'}
            className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            <option value="all">{isVi ? 'Mọi trạng thái' : 'All statuses'}</option>
            <option value="published">{isVi ? 'Đã xuất bản' : 'Published'}</option>
            <option value="in_review">{isVi ? 'Chờ duyệt' : 'In Review'}</option>
            <option value="draft">{isVi ? 'Bản nháp' : 'Draft'}</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading packages...</p>
        ) : visiblePackages.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">
            {pkgSearch.trim() || pkgAgeFilter !== 'all' || pkgStatusFilter !== 'all'
              ? isVi
                ? 'Không tìm thấy gói bài học khớp bộ lọc.'
                : 'No packages match your current filters.'
              : pkgView === 'archived'
                ? isVi
                  ? 'Chưa có gói bài học nào trong kho lưu trữ.'
                  : 'No archived learning packages.'
                : isVi
                  ? 'Chưa có gói bài học nào.'
                  : 'No learning packages yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">
                    {isVi ? 'Gói bài học' : 'Package'}
                  </th>
                  <th className="py-3 px-4">{isVi ? 'Từ vựng' : 'Concepts'}</th>
                  <th className="py-3 px-4">
                    {isVi ? 'Trạng thái' : 'Status'}
                  </th>
                  <th className="py-3 pl-4 text-right">
                    {isVi ? 'Thao tác' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePackages.map((pkg) => {
                  const title =
                    pkg.titles[interfaceLocale] ||
                    pkg.titles.en ||
                    Object.values(pkg.titles)[0] ||
                    pkg.id;
                  const isBusy = busyId === pkg.id;
                  const isArchived = Boolean(pkg.archivedAt);
                  const isStarter = pkg.id === 'lp-fruits-a1';
                  const warnings = getPackageWarnings(pkg);
                  return (
                    <tr key={pkg.id}>
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-slate-900">{title}</p>
                        <p className="text-xs text-slate-500">
                          {pkg.ageBand.join(', ')} ·{' '}
                          {pkg.learningLocales.join(', ').toUpperCase()}
                        </p>
                        {!isArchived && warnings.length > 0 && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>{warnings.join(' · ')}</span>
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 tabular-nums">
                        {pkg.concepts.length}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            isArchived
                              ? 'text-slate-500'
                              : pkg.status === 'published'
                                ? 'text-emerald-700'
                                : pkg.status === 'in_review'
                                  ? 'text-sky-700'
                                  : 'text-slate-600'
                          }`}
                        >
                          {statusText(isArchived ? 'archived' : pkg.status)}
                          {pkg.publishedVersion && !isArchived
                            ? ` · v${pkg.publishedVersion}`
                            : ''}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewTarget({ kind: 'package', item: pkg })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{isVi ? 'Xem' : 'Preview'}</span>
                          </button>

                          {pkg.publishedVersion && (
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryTarget({
                                  entityType: 'package',
                                  entityId: pkg.id,
                                  title,
                                  currentVersion: pkg.publishedVersion,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <History
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>{isVi ? 'Lịch sử' : 'History'}</span>
                            </button>
                          )}

                          {!isArchived && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingPackage(pkg)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Edit3
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'Sửa' : 'Edit'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setAdaptTarget({
                                    entityType: 'package',
                                    entityId: pkg.id,
                                    title,
                                    existingLocales: Array.from(
                                      new Set([
                                        ...pkg.learningLocales,
                                        ...pkg.explanationLocales,
                                      ])
                                    ),
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Languages
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'Dịch AI' : 'Adapt'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setSafetyTarget({
                                    entityType: 'package',
                                    entityId: pkg.id,
                                    title,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <ShieldCheck
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'An toàn' : 'Safety'}</span>
                              </button>

                              {pkg.status === 'draft' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handlePackageStatus(pkg.id, 'in_review')
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Send className="w-3 h-3" aria-hidden="true" />
                                  <span>{isVi ? 'Gửi duyệt' : 'Review'}</span>
                                </button>
                              )}

                              {canPublish && pkg.status !== 'published' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handlePackageStatus(pkg.id, 'published')
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
                                >
                                  <CheckCircle2
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                  <span>{isVi ? 'Xuất bản' : 'Publish'}</span>
                                </button>
                              )}

                              {canPublish &&
                                pkg.status === 'published' &&
                                !isStarter && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handlePackageStatus(pkg.id, 'draft')
                                    }
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                  >
                                    {isVi ? 'Gỡ nháp' : 'Unpublish'}
                                  </button>
                                )}
                            </>
                          )}

                          {canPublish && (
                            <DeleteActionsControl
                              isArchived={isArchived}
                              isVi={isVi}
                              busy={isBusy}
                              canHardDelete={canHardDelete && !isStarter}
                              hardDeleteProtectedHint={
                                canHardDelete && isStarter
                                  ? isVi
                                    ? 'Gói khởi đầu không thể xóa vĩnh viễn'
                                    : 'Starter package cannot be hard-deleted'
                                  : undefined
                              }
                              onDelete={(mode) =>
                                handleDeletePackage(pkg.id, mode)
                              }
                              onRestore={() => handleRestorePackage(pkg.id)}
                            />
                          )}
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

      {/* Stories Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-900">
              {isVi ? 'Thư viện truyện kể' : 'Picture Stories'}
            </h3>
          </div>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => setStoryView('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                storyView === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Đang hoạt động' : 'Active'} ({activeStories.length})
            </button>
            <button
              type="button"
              onClick={() => setStoryView('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                storyView === 'archived'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isVi ? 'Đã lưu trữ' : 'Archived'} ({archivedStories.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-6 relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={storySearch}
              onChange={(e) => setStorySearch(e.target.value)}
              placeholder={
                isVi
                  ? 'Tìm kiếm truyện kể theo tên...'
                  : 'Search stories by title...'
              }
              className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>
          <select
            value={storyAgeFilter}
            onChange={(e) => setStoryAgeFilter(e.target.value)}
            aria-label={isVi ? 'Lọc truyện theo nhóm tuổi' : 'Filter stories by age'}
            className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
          >
            <option value="all">{isVi ? 'Mọi nhóm tuổi' : 'All age groups'}</option>
            {ageGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {isVi ? g.shortLabels.vi : g.shortLabels.en}
              </option>
            ))}
          </select>
          <select
            value={storyStatusFilter}
            onChange={(e) =>
              setStoryStatusFilter(
                e.target.value as 'all' | 'draft' | 'in_review' | 'published'
              )
            }
            disabled={storyView === 'archived'}
            aria-label={isVi ? 'Lọc truyện theo trạng thái' : 'Filter stories by status'}
            className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            <option value="all">{isVi ? 'Mọi trạng thái' : 'All statuses'}</option>
            <option value="published">{isVi ? 'Đã xuất bản' : 'Published'}</option>
            <option value="in_review">{isVi ? 'Chờ duyệt' : 'In Review'}</option>
            <option value="draft">{isVi ? 'Bản nháp' : 'Draft'}</option>
          </select>
        </div>

        {visibleStories.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">
            {storySearch.trim() || storyAgeFilter !== 'all' || storyStatusFilter !== 'all'
              ? isVi
                ? 'Không tìm thấy truyện kể khớp bộ lọc.'
                : 'No stories match your current filters.'
              : storyView === 'archived'
                ? isVi
                  ? 'Chưa có truyện kể nào trong kho lưu trữ.'
                  : 'No archived stories.'
                : isVi
                  ? 'Chưa có truyện kể nào.'
                  : 'No stories yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">{isVi ? 'Truyện kể' : 'Story'}</th>
                  <th className="py-3 px-4">{isVi ? 'Số đoạn' : 'Segments'}</th>
                  <th className="py-3 px-4">
                    {isVi ? 'Trạng thái' : 'Status'}
                  </th>
                  <th className="py-3 pl-4 text-right">
                    {isVi ? 'Thao tác' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStories.map((story) => {
                  const title =
                    story.titles[interfaceLocale] ||
                    story.titles.en ||
                    Object.values(story.titles)[0] ||
                    story.id;
                  const isBusy = busyId === story.id;
                  const isArchived = Boolean(story.archivedAt);
                  const isStarter = story.id === 'story-fruit-market';
                  const warnings = getStoryWarnings(story);
                  return (
                    <tr key={story.id}>
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-slate-900">{title}</p>
                        <p className="text-xs text-slate-500">
                          {story.ageBands.join(', ')} ·{' '}
                          {story.availableLocales.join(', ').toUpperCase()}
                        </p>
                        {!isArchived && warnings.length > 0 && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>{warnings.join(' · ')}</span>
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 tabular-nums">
                        {story.segments.length}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            isArchived
                              ? 'text-slate-500'
                              : story.status === 'published'
                                ? 'text-emerald-700'
                                : story.status === 'in_review'
                                  ? 'text-sky-700'
                                  : 'text-slate-600'
                          }`}
                        >
                          {statusText(isArchived ? 'archived' : story.status)}
                          {story.publishedVersion && !isArchived
                            ? ` · v${story.publishedVersion}`
                            : ''}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewTarget({ kind: 'story', item: story })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{isVi ? 'Xem' : 'Preview'}</span>
                          </button>

                          {story.publishedVersion && (
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryTarget({
                                  entityType: 'story',
                                  entityId: story.id,
                                  title,
                                  currentVersion: story.publishedVersion,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <History
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>{isVi ? 'Lịch sử' : 'History'}</span>
                            </button>
                          )}

                          {!isArchived && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingStory(story)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Edit3
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'Sửa' : 'Edit'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setAdaptTarget({
                                    entityType: 'story',
                                    entityId: story.id,
                                    title,
                                    existingLocales: Array.from(
                                      new Set([
                                        ...story.availableLocales,
                                        ...story.availableExplanationLocales,
                                      ])
                                    ),
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Languages
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'Dịch AI' : 'Adapt'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setSafetyTarget({
                                    entityType: 'story',
                                    entityId: story.id,
                                    title,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <ShieldCheck
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'An toàn' : 'Safety'}</span>
                              </button>

                              {story.status === 'draft' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleStoryStatus(story.id, 'in_review')
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Send className="w-3 h-3" aria-hidden="true" />
                                  <span>{isVi ? 'Gửi duyệt' : 'Review'}</span>
                                </button>
                              )}

                              {canPublish && story.status !== 'published' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleStoryStatus(story.id, 'published')
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
                                >
                                  <CheckCircle2
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                  <span>{isVi ? 'Xuất bản' : 'Publish'}</span>
                                </button>
                              )}
                            </>
                          )}

                          {canPublish && (
                            <DeleteActionsControl
                              isArchived={isArchived}
                              isVi={isVi}
                              busy={isBusy}
                              canHardDelete={canHardDelete && !isStarter}
                              hardDeleteProtectedHint={
                                canHardDelete && isStarter
                                  ? isVi
                                    ? 'Truyện khởi đầu không thể xóa vĩnh viễn'
                                    : 'Starter story cannot be hard-deleted'
                                  : undefined
                              }
                              onDelete={(mode) =>
                                handleDeleteStory(story.id, mode)
                              }
                              onRestore={() => handleRestoreStory(story.id)}
                            />
                          )}
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

      {/* Recent AI Generation Jobs */}
      {jobs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            {isVi ? 'Lịch sử sinh nội dung AI' : 'Recent AI Generation Jobs'}
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {jobs.slice(0, 6).map((job) => (
              <div
                key={job.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold text-slate-900">
                    {job.topic}
                  </span>{' '}
                  <span className="text-slate-500">
                    ({job.kind} · {job.learningLocale}/{job.explanationLocale})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 tabular-nums">
                  <span>
                    {job.providerUsed} / {job.modelUsed}
                  </span>
                  <span
                    className={`font-semibold ${
                      job.status === 'completed'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inline Editor & Preview Modals */}
      {editingPackage && (
        <PackageEditorModal
          pkg={editingPackage}
          isVi={isVi}
          ageGroups={ageGroups}
          mediaAssets={mediaAssets}
          onClose={() => setEditingPackage(null)}
          onMediaChanged={onMediaChanged}
          onSaved={(updated) => {
            setPackages((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
            setNotice(
              isVi
                ? 'Đã lưu chỉnh sửa gói bài học.'
                : 'Saved learning package changes.'
            );
            onContentPublished();
          }}
        />
      )}

      {editingStory && (
        <StoryEditorModal
          story={editingStory}
          isVi={isVi}
          ageGroups={ageGroups}
          mediaAssets={mediaAssets}
          onClose={() => setEditingStory(null)}
          onMediaChanged={onMediaChanged}
          onSaved={(updated) => {
            setStories((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            );
            setNotice(
              isVi
                ? 'Đã lưu chỉnh sửa truyện kể.'
                : 'Saved story changes.'
            );
            onContentPublished();
          }}
        />
      )}

      {previewTarget && (
        <DraftPreviewModal
          isVi={isVi}
          target={previewTarget}
          onClose={() => setPreviewTarget(null)}
        />
      )}

      {historyTarget && (
        <SnapshotHistoryModal
          isVi={isVi}
          entityType={historyTarget.entityType}
          entityId={historyTarget.entityId}
          entityTitle={historyTarget.title}
          currentVersion={historyTarget.currentVersion}
          canPublish={canPublish}
          onClose={() => setHistoryTarget(null)}
          onRolledBack={(msg) => {
            setNotice(msg);
            void loadAll();
            onContentPublished();
          }}
        />
      )}

      {safetyTarget && (
        <SafetyReviewModal
          isVi={isVi}
          entityType={safetyTarget.entityType}
          entityId={safetyTarget.entityId}
          entityTitle={safetyTarget.title}
          connectionId={selectedConnectionId || undefined}
          onClose={() => setSafetyTarget(null)}
        />
      )}

      {adaptTarget && (
        <AdaptLocaleModal
          isVi={isVi}
          entityType={adaptTarget.entityType}
          entityId={adaptTarget.entityId}
          entityTitle={adaptTarget.title}
          existingLocales={adaptTarget.existingLocales}
          languages={languages}
          connectionId={selectedConnectionId || undefined}
          onClose={() => setAdaptTarget(null)}
          onAdapted={(msg) => {
            setNotice(msg);
            void loadAll();
            onContentPublished();
          }}
        />
      )}
    </div>
  );
}
