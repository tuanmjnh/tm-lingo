'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Globe,
  Headphones,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  ExternalStoryCatalogItem,
  StoryBook,
  StoryCategoryKey,
  StorySourceConfig,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import { AssetImage } from '../../components/AssetImage';
import { playSuccessChime } from '../../audio/soundEffects';

interface StorySourceDiscoveryProps {
  interfaceLocale: string;
  ageGroups: AgeGroupConfig[];
  initialAgeBand?: string;
  defaultFormat?: 'all' | 'audiobook' | 'picture_book';
  bedtimeMode?: boolean;
  onStoryImported: (story: StoryBook) => void;
  onOpenExistingStory: (storyId: string) => void;
}

interface CategoryOption {
  key: StoryCategoryKey;
  labelVi: string;
  labelEn: string;
}

export function StorySourceDiscovery({
  interfaceLocale,
  ageGroups,
  initialAgeBand,
  defaultFormat = 'all',
  bedtimeMode = false,
  onStoryImported,
  onOpenExistingStory,
}: StorySourceDiscoveryProps) {
  const isVi = interfaceLocale === 'vi';

  const [sources, setSources] = useState<StorySourceConfig[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [items, setItems] = useState<ExternalStoryCatalogItem[]>([]);
  const [warnings, setWarnings] = useState<
    Array<{ sourceId: string; sourceName: string; message: string }>
  >([]);

  const [selectedSourceId, setSelectedSourceId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<
    StoryCategoryKey | 'all'
  >('all');
  const [selectedAgeBand, setSelectedAgeBand] = useState<string>('all');
  const [selectedLocale, setSelectedLocale] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<
    'all' | 'audiobook' | 'picture_book'
  >(defaultFormat);
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');

  useEffect(() => {
    setSelectedFormat(defaultFormat);
  }, [defaultFormat]);

  // Keep initialAgeBand accessible via dropdown while defaulting to 'all' so every live audiobook source is visible immediately
  void initialAgeBand;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(
    async (override?: {
      sourceId?: string;
      category?: StoryCategoryKey | 'all';
      q?: string;
      ageBand?: string;
      locale?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.browseStorySourcesCatalog({
          sourceId: override?.sourceId ?? selectedSourceId,
          category: override?.category ?? selectedCategory,
          q: override?.q ?? activeQuery,
          ageBand: override?.ageBand ?? selectedAgeBand,
          locale: override?.locale ?? selectedLocale,
        });
        setSources(res.sources);
        setCategories(res.categories);
        setItems(res.items);
        setWarnings(res.warnings);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isVi
              ? 'Không thể tải danh sách truyện từ các nguồn lúc này.'
              : 'Unable to load stories from sources right now.'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      selectedSourceId,
      selectedCategory,
      activeQuery,
      selectedAgeBand,
      selectedLocale,
      isVi,
    ]
  );

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput.trim());
  };

  const handleDownloadAndRead = async (item: ExternalStoryCatalogItem) => {
    if (item.alreadyImportedStoryId) {
      onOpenExistingStory(item.alreadyImportedStoryId);
      return;
    }

    const key = `${item.sourceId}:${item.externalId}`;
    setImportingKey(key);
    setError(null);
    setImportNotice(null);

    try {
      const res = await apiClient.importStoryFromSource({
        sourceId: item.sourceId,
        externalId: item.externalId,
      });
      playSuccessChime();
      setItems((prev) =>
        prev.map((entry) =>
          entry.sourceId === item.sourceId &&
          entry.externalId === item.externalId
            ? { ...entry, alreadyImportedStoryId: res.story.id }
            : entry
        )
      );
      setImportNotice(
        isVi
          ? `Đã tải xong "${res.story.titles.vi || res.story.titles.en}" về kệ truyện của bé!`
          : `Downloaded "${res.story.titles.en || Object.values(res.story.titles)[0]}" to your library!`
      );
      onStoryImported(res.story);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isVi
            ? 'Không thể tải truyện này lúc này.'
            : 'Unable to download this story right now.'
      );
    } finally {
      setImportingKey(null);
    }
  };

  const getCategoryLabel = (key: StoryCategoryKey) => {
    const found = categories.find((c) => c.key === key);
    if (!found) return key;
    return isVi ? found.labelVi : found.labelEn;
  };

  const surfaceCard = bedtimeMode
    ? 'border-stone-700 bg-[#26221F] text-[#F5EFE6]'
    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';

  const inputStyle = bedtimeMode
    ? 'border-stone-700 bg-stone-900 text-stone-100 placeholder:text-stone-500'
    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400';

  return (
    <div className="space-y-5">
      {/* Discovery Filter Bar */}
      <section className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${surfaceCard}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold inline-flex items-center gap-2">
              <Sparkles
                className={`w-4 h-4 ${bedtimeMode ? 'text-amber-300' : 'text-accent'}`}
                aria-hidden="true"
              />
              <span>
                {isVi
                  ? 'Khám phá & tải Sách nói, Truyện dài từ các nguồn mở'
                  : 'Discover & download Audiobooks & Long Stories'}
              </span>
            </h3>
            <p
              className={`text-xs mt-1 ${
                bedtimeMode
                  ? 'text-stone-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isVi
                ? 'Kết nối trực tiếp Kho Song ngữ TM-Lingo, Sách nói MP3 LibriVox, Kho Cổ tích Tiếng Việt Wikisource & Internet Archive — nghe đọc tự do không giới hạn thời gian.'
                : 'Connected live to TM-Lingo Bilingual Library, LibriVox MP3 Audiobooks, Vietnamese Wikisource & Internet Archive — unlimited listening anytime.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadCatalog()}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
              bedtimeMode
                ? 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
          </button>
        </div>

        {/* Search + Dropdown Filters */}
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 md:grid-cols-12 gap-2.5"
        >
          <div className="md:col-span-5 relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                isVi
                  ? 'Tìm tên truyện, tác giả, chủ đề (ví dụ: rùa, fairy, moon)...'
                  : 'Search titles, authors, topics (e.g. fairy, rabbit, moon)...'
              }
              className={`w-full min-h-[40px] rounded-xl border pl-9 pr-3 text-xs ${inputStyle}`}
            />
          </div>

          <select
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
            aria-label={isVi ? 'Chọn nguồn truyện' : 'Filter by story source'}
            className={`md:col-span-3 min-h-[40px] rounded-xl border px-3 text-xs font-medium ${inputStyle}`}
          >
            <option value="all">
              {isVi
                ? `Tất cả nguồn đang bật (${sources.length})`
                : `All enabled sources (${sources.length})`}
            </option>
            {sources.map((src) => (
              <option key={src.id} value={src.id}>
                {isVi ? src.name.vi : src.name.en}
              </option>
            ))}
          </select>

          <select
            value={selectedAgeBand}
            onChange={(e) => setSelectedAgeBand(e.target.value)}
            aria-label={isVi ? 'Lọc theo nhóm tuổi' : 'Filter by age group'}
            className={`md:col-span-2 min-h-[40px] rounded-xl border px-3 text-xs font-medium ${inputStyle}`}
          >
            <option value="all">{isVi ? 'Mọi lứa tuổi' : 'All ages'}</option>
            {ageGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {isVi ? g.shortLabels.vi : g.shortLabels.en}
              </option>
            ))}
          </select>

          <div className="md:col-span-2 flex gap-2">
            <select
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value)}
              aria-label={isVi ? 'Lọc theo ngôn ngữ' : 'Filter by language'}
              className={`flex-1 min-h-[40px] rounded-xl border px-2.5 text-xs font-medium ${inputStyle}`}
            >
              <option value="all">{isVi ? 'Mọi ngôn ngữ' : 'Any language'}</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
            </select>
            <button
              type="submit"
              className="px-3.5 min-h-[40px] rounded-xl btn-accent text-xs font-semibold cursor-pointer shrink-0"
            >
              {isVi ? 'Tìm' : 'Search'}
            </button>
          </div>
        </form>

        {/* Category Filter Tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label={isVi ? 'Danh mục truyện' : 'Story categories'}
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'btn-accent'
                : bedtimeMode
                  ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isVi ? 'Tất cả danh mục' : 'All categories'}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat.key
                  ? 'btn-accent'
                  : bedtimeMode
                    ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isVi ? cat.labelVi : cat.labelEn}
            </button>
          ))}
        </div>

        {/* Format Quick Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {(
            [
              ['all', isVi ? 'Tất cả định dạng' : 'All formats'],
              ['audiobook', isVi ? 'Sách nói & Truyện dài' : 'Audiobooks & Long Stories'],
              ['picture_book', isVi ? 'Truyện tranh ngắn' : 'Short Picture Stories'],
            ] as const
          ).map(([fmtKey, label]) => (
            <button
              key={fmtKey}
              type="button"
              onClick={() => setSelectedFormat(fmtKey)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                selectedFormat === fmtKey
                  ? bedtimeMode
                    ? 'border-amber-400 bg-amber-950/70 text-amber-200'
                    : 'border-accent bg-accent-soft'
                  : bedtimeMode
                    ? 'border-stone-700 bg-stone-900 text-stone-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Feedback & Source Warnings */}
      {importNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{importNotice}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs flex flex-wrap items-center gap-2 ${
            bedtimeMode
              ? 'border-amber-700/60 bg-amber-950/40 text-amber-200'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {isVi
              ? `Một số nguồn ngoài đang phản hồi chậm (${warnings.map((w) => w.sourceName).join(', ')}). Các nguồn còn lại vẫn hiển thị bình thường.`
              : `Some external sources responded slowly (${warnings.map((w) => w.sourceName).join(', ')}). Remaining sources are shown below.`}
          </span>
        </div>
      )}

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`rounded-2xl border p-4 space-y-3 animate-pulse ${surfaceCard}`}
            >
              <div className="aspect-[16/9] rounded-xl bg-slate-200/70" />
              <div className="h-4 w-3/4 rounded bg-slate-200/70" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-9 w-full rounded-xl bg-slate-200/70" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className={`rounded-2xl border p-8 text-center space-y-2 ${surfaceCard}`}
        >
          <BookOpen className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
          <p className="text-sm font-bold">
            {isVi
              ? 'Không tìm thấy truyện phù hợp với bộ lọc hiện tại'
              : 'No stories matched your current filters'}
          </p>
          <p
            className={`text-xs ${
              bedtimeMode ? 'text-stone-400' : 'text-slate-500'
            }`}
          >
            {isVi
              ? 'Thử chọn "Tất cả danh mục" hoặc đổi từ khóa tìm kiếm khác nhé.'
              : 'Try clearing your search keyword or switching to all categories.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedSourceId('all');
              setSelectedCategory('all');
              setSelectedAgeBand('all');
              setSelectedLocale('all');
              setSearchInput('');
              setActiveQuery('');
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
          >
            {isVi ? 'Đặt lại bộ lọc' : 'Reset filters'}
          </button>
        </div>
      ) : (() => {
        const visibleItems = items.filter((it) => {
          const isLong =
            it.storyFormat === 'audiobook' ||
            it.storyFormat === 'long_story' ||
            Boolean(it.hasAudio);
          if (selectedFormat === 'audiobook') return isLong;
          if (selectedFormat === 'picture_book') return !isLong;
          return true;
        });

        if (visibleItems.length === 0) {
          return (
            <div
              className={`rounded-2xl border p-8 text-center space-y-2 ${surfaceCard}`}
            >
              <BookOpen className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
              <p className="text-sm font-bold">
                {isVi
                  ? 'Không có sách/truyện nào khớp định dạng đang lọc'
                  : 'No items matched this format filter'}
              </p>
              <button
                type="button"
                onClick={() => setSelectedFormat('all')}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
              >
                {isVi ? 'Xem tất cả định dạng' : 'Show all formats'}
              </button>
            </div>
          );
        }

        return (
        <div className="space-y-3">
          <p
            className={`text-xs font-semibold ${
              bedtimeMode ? 'text-stone-400' : 'text-slate-500'
            }`}
          >
            {isVi
              ? `Tìm thấy ${visibleItems.length} sách nói & truyện sẵn sàng tải về`
              : `Found ${visibleItems.length} audiobooks & stories ready to download`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((item) => {
              const cardKey = `${item.sourceId}:${item.externalId}`;
              const isImporting = importingKey === cardKey;
              const isDownloaded = Boolean(item.alreadyImportedStoryId);
              const displayTitle =
                isVi && item.titleVi ? item.titleVi : item.title;
              const displaySummary =
                isVi && item.summaryVi ? item.summaryVi : item.summary;

              return (
                <article
                  key={cardKey}
                  className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-sm ${surfaceCard}`}
                >
                  <div>
                    <div className="relative aspect-[16/10] w-full bg-[#FAF8F2] overflow-hidden border-b border-slate-100">
                      <AssetImage
                        assetRef={item.coverAssetRef}
                        altOverride={displayTitle}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 text-white text-[11px] font-semibold">
                          {getCategoryLabel(item.category)}
                        </span>
                        {item.storyFormat === 'audiobook' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-600 text-white text-[11px] font-semibold inline-flex items-center gap-1">
                            <Headphones className="w-3 h-3" aria-hidden="true" />
                            <span>{isVi ? 'Sách nói MP3' : 'MP3 Audio'}</span>
                          </span>
                        ) : item.storyFormat === 'long_story' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white text-[11px] font-semibold inline-flex items-center gap-1">
                            <BookOpen className="w-3 h-3" aria-hidden="true" />
                            <span>{isVi ? 'Truyện dài' : 'Long Story'}</span>
                          </span>
                        ) : item.hasAudio ? (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold inline-flex items-center gap-1">
                            <Headphones className="w-3 h-3" aria-hidden="true" />
                            <span>Audio</span>
                          </span>
                        ) : null}
                      </div>
                      {isDownloaded && (
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          <span>{isVi ? 'Đã tải' : 'Saved'}</span>
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`font-semibold truncate ${
                            bedtimeMode ? 'text-amber-300' : 'text-sky-700'
                          }`}
                        >
                          {isVi ? item.sourceName.vi : item.sourceName.en}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 shrink-0 ${
                            bedtimeMode ? 'text-stone-400' : 'text-slate-400'
                          }`}
                        >
                          <Globe className="w-3 h-3" aria-hidden="true" />
                          {item.availableLocales.join(' / ').toUpperCase()}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold leading-snug line-clamp-2">
                        {displayTitle}
                      </h4>

                      {item.author && (
                        <p
                          className={`text-[11px] truncate ${
                            bedtimeMode ? 'text-stone-400' : 'text-slate-500'
                          }`}
                        >
                          {item.author}
                        </p>
                      )}

                      <p
                        className={`text-xs leading-relaxed line-clamp-3 ${
                          bedtimeMode
                            ? 'text-stone-300'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {displaySummary}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-1 space-y-2.5">
                    <div
                      className={`flex items-center justify-between text-[11px] ${
                        bedtimeMode
                          ? 'text-stone-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span>
                        {item.chapterCount
                          ? `${item.chapterCount} ${isVi ? 'chương' : 'chapters'}`
                          : `${isVi ? 'Độ tuổi:' : 'Ages:'} ${item.ageBands.join(', ')}`}
                      </span>
                      {item.estimatedMinutes && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3" aria-hidden="true" />~
                          {item.estimatedMinutes}{' '}
                          {isVi ? 'phút' : 'min'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => void handleDownloadAndRead(item)}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 ${
                        isDownloaded
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'btn-accent'
                      }`}
                    >
                      {isImporting ? (
                        <>
                          <Loader2
                            className="w-4 h-4 animate-spin"
                            aria-hidden="true"
                          />
                          <span>
                            {isVi ? 'Đang tải về kệ...' : 'Downloading...'}
                          </span>
                        </>
                      ) : isDownloaded ? (
                        <>
                          <Headphones className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {isVi ? 'Mở nghe & đọc ngay' : 'Open & Listen'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {isVi ? 'Tải về & Nghe ngay' : 'Download & Listen'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
