'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Cpu,
  FolderOpen,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  Music,
  Play,
  Rss,
  Search,
  ShieldCheck,
  Square,
  Upload,
  Users,
  Volume2,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  AuthUserProfile,
  DeleteMode,
  LocaleConfig,
  MediaAssetRecord,
} from '../../../packages/contracts/types';
import { isRootStaff } from '../../../packages/contracts/permissions';
import type { UiMessages } from '../../i18n/messages';
import { NotificationManager } from '../notifications/NotificationManager';
import { AdminAgeGroupsPanel } from './AdminAgeGroupsPanel';
import { AdminAuditPanel } from './AdminAuditPanel';
import { AdminCmsStudio } from './AdminCmsStudio';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import { AdminLanguagesPanel } from './AdminLanguagesPanel';
import { AdminProvidersPanel } from './AdminProvidersPanel';
import { AdminStorySourcesPanel } from './AdminStorySourcesPanel';
import { DeleteActionsControl } from './DeleteActionsControl';

export type AdminSection =
  | 'overview'
  | 'cms'
  | 'story-sources'
  | 'age-groups'
  | 'media'
  | 'notifications'
  | 'providers'
  | 'languages'
  | 'users';

interface AdminWorkspaceProps {
  staffUser: AuthUserProfile;
  iamMode: 'tm-hub' | 'local-dev';
  interfaceLocale: string;
  activeLearningLocale: string;
  initialSection?: AdminSection;
  languages: LocaleConfig[];
  ageGroups: AgeGroupConfig[];
  mediaAssets: MediaAssetRecord[];
  storageSummary: { bucket: string; provider: string };
  messages: UiMessages;
  onUploadMedia: (payload: {
    file: File;
    title: string;
    locale: string;
  }) => Promise<void>;
  onDeleteMedia: (assetId: string, mode: DeleteMode) => Promise<void>;
  onRestoreMedia: (assetId: string) => Promise<void>;
  onReloadMedia: () => Promise<void>;
  onStaffSignOut: () => Promise<void>;
  onContentPublished: () => void;
  onLanguagesUpdated: () => void;
  onAgeGroupsUpdated: () => void;
}

function hasCap(user: AuthUserProfile, cap: string): boolean {
  const caps = user.capabilities ?? [];
  if (caps.includes('*') || caps.includes(cap)) return true;
  if (user.role === 'admin') return true;
  return false;
}

export function AdminWorkspace({
  staffUser,
  iamMode,
  interfaceLocale,
  activeLearningLocale,
  initialSection = 'overview',
  languages,
  ageGroups,
  mediaAssets,
  storageSummary,
  messages,
  onUploadMedia,
  onDeleteMedia,
  onRestoreMedia,
  onReloadMedia,
  onStaffSignOut,
  onContentPublished,
  onLanguagesUpdated,
  onAgeGroupsUpdated,
}: AdminWorkspaceProps) {
  const isVi = interfaceLocale === 'vi';
  const isRoot = isRootStaff(staffUser);
  const canManageProviders = hasCap(staffUser, 'tm-lingo.providers.manage');
  const canManageUsers = hasCap(staffUser, 'users.read');
  const canPublishCms = hasCap(staffUser, 'tm-lingo.content.publish');

  const [section, setSection] = useState<AdminSection>(initialSection);

  // Sync external section jumps (e.g. from NotificationBell)
  const lastInitialRef = useRef(initialSection);
  if (lastInitialRef.current !== initialSection) {
    lastInitialRef.current = initialSection;
    setSection(initialSection);
  }

  // Media upload & filter state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaActionId, setMediaActionId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [mediaView, setMediaView] = useState<'active' | 'archived'>('active');
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaKindFilter, setMediaKindFilter] = useState<'all' | 'image' | 'audio'>('all');

  // Direct browser audio preview state
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null);
  const [previewErrorById, setPreviewErrorById] = useState<Record<string, string>>({});

  const stopAudioPreview = () => {
    const current = previewAudioRef.current;
    if (current) {
      current.onended = null;
      current.onerror = null;
      current.onplaying = null;
      current.pause();
      current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setPlayingAssetId(null);
    setLoadingAssetId(null);
  };

  useEffect(() => {
    return () => {
      const current = previewAudioRef.current;
      if (current) {
        current.onended = null;
        current.onerror = null;
        current.onplaying = null;
        current.pause();
        current.currentTime = 0;
        previewAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (section !== 'media') {
      const current = previewAudioRef.current;
      if (current) {
        current.onended = null;
        current.onerror = null;
        current.onplaying = null;
        current.pause();
        current.currentTime = 0;
        previewAudioRef.current = null;
      }
      setPlayingAssetId(null);
      setLoadingAssetId(null);
    }
  }, [section]);

  const handleToggleAudioPreview = async (asset: MediaAssetRecord) => {
    if (playingAssetId === asset.id || loadingAssetId === asset.id) {
      stopAudioPreview();
      return;
    }

    stopAudioPreview();
    setPreviewErrorById((prev) => {
      if (!prev[asset.id]) return prev;
      const next = { ...prev };
      delete next[asset.id];
      return next;
    });

    if (!asset.publicUrl) {
      setPreviewErrorById((prev) => ({
        ...prev,
        [asset.id]: isVi
          ? 'Không tìm thấy đường dẫn tệp âm thanh.'
          : 'Audio file URL is unavailable.',
      }));
      return;
    }

    setLoadingAssetId(asset.id);
    try {
      const audio = new Audio(asset.publicUrl);
      audio.preload = 'auto';
      previewAudioRef.current = audio;

      audio.onplaying = () => {
        if (previewAudioRef.current === audio) {
          setLoadingAssetId(null);
          setPlayingAssetId(asset.id);
        }
      };
      audio.onended = () => {
        if (previewAudioRef.current === audio) {
          stopAudioPreview();
        }
      };
      audio.onerror = () => {
        if (previewAudioRef.current === audio) {
          stopAudioPreview();
          setPreviewErrorById((prev) => ({
            ...prev,
            [asset.id]: isVi
              ? 'Không thể phát tệp âm thanh này trên trình duyệt.'
              : 'Unable to play this audio asset in the browser.',
          }));
        }
      };

      await audio.play();
      if (previewAudioRef.current === audio) {
        setLoadingAssetId(null);
        setPlayingAssetId(asset.id);
      }
    } catch {
      stopAudioPreview();
      setPreviewErrorById((prev) => ({
        ...prev,
        [asset.id]: isVi
          ? 'Không thể phát bản nghe thử. Vui lòng kiểm tra định dạng tệp.'
          : 'Could not play audio preview. Check file format or network.',
      }));
    }
  };

  const activeMedia = mediaAssets.filter((a) => !a.archivedAt);
  const archivedMedia = mediaAssets.filter((a) => Boolean(a.archivedAt));
  const baseMedia = mediaView === 'active' ? activeMedia : archivedMedia;
  const visibleMedia = baseMedia.filter((a) => {
    if (mediaKindFilter !== 'all' && a.kind !== mediaKindFilter) return false;
    const q = mediaSearch.trim().toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) && !a.locale.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const handleMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile) return;
    setMediaBusy(true);
    setMediaError(null);
    setMediaNotice(null);
    try {
      await onUploadMedia({
        file: mediaFile,
        title: mediaTitle.trim() || mediaFile.name,
        locale: activeLearningLocale,
      });
      setMediaTitle('');
      setMediaFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setMediaNotice(
        isVi
          ? 'Đã tải học liệu lên kho lưu trữ thành công.'
          : 'Uploaded media asset successfully.'
      );
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setMediaBusy(false);
    }
  };

  const handleMediaDelete = async (assetId: string, mode: DeleteMode) => {
    if (playingAssetId === assetId || loadingAssetId === assetId) {
      stopAudioPreview();
    }
    setMediaActionId(assetId);
    setMediaError(null);
    setMediaNotice(null);
    try {
      await onDeleteMedia(assetId, mode);
      setMediaNotice(
        mode === 'hard'
          ? isVi
            ? 'Đã xóa vĩnh viễn tệp học liệu khỏi kho lưu trữ.'
            : 'Permanently deleted media file and record.'
          : isVi
            ? 'Đã lưu trữ học liệu (tệp trên kho lưu trữ được giữ nguyên để có thể khôi phục).'
            : 'Archived media asset (object retained in storage for restore).'
      );
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setMediaActionId(null);
    }
  };

  const handleMediaRestore = async (assetId: string) => {
    setMediaActionId(assetId);
    setMediaError(null);
    setMediaNotice(null);
    try {
      await onRestoreMedia(assetId);
      setMediaNotice(
        isVi ? 'Đã khôi phục học liệu.' : 'Restored media asset.'
      );
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setMediaActionId(null);
    }
  };

  const tabs: Array<{
    key: AdminSection;
    label: string;
    icon: typeof Bell;
  }> = [
    {
      key: 'overview',
      label: isVi ? 'Tổng quan' : 'Overview',
      icon: LayoutDashboard,
    },
    {
      key: 'cms',
      label: isVi ? 'Nội dung & AI' : 'Content Studio',
      icon: Layers,
    },
    {
      key: 'story-sources',
      label: isVi ? 'Nguồn truyện' : 'Story Sources',
      icon: Rss,
    },
    {
      key: 'age-groups',
      label: isVi ? 'Nhóm tuổi (K-12)' : 'Age Groups (K-12)',
      icon: GraduationCap,
    },
    {
      key: 'media',
      label: isVi ? 'Thư viện học liệu' : 'Media Library',
      icon: FolderOpen,
    },
    {
      key: 'notifications',
      label: isVi ? 'Thông báo' : 'Notifications',
      icon: Bell,
    },
    ...(canManageProviders
      ? [
          {
            key: 'providers' as const,
            label: isVi ? 'AI & Lưu trữ' : 'AI & Storage',
            icon: Cpu,
          },
        ]
      : []),
    {
      key: 'languages',
      label: isVi ? 'Ngôn ngữ & Giọng đọc' : 'Languages & Voices',
      icon: Globe,
    },
    ...(canManageUsers
      ? [
          {
            key: 'users' as const,
            label: isVi ? 'Nhân sự & Nhật ký' : 'Staff & Activity',
            icon: Users,
          },
        ]
      : []),
  ];

  const roleLabel = isRoot
    ? isVi
      ? 'Root (Toàn quyền)'
      : 'Root (Full Access)'
    : staffUser.role === 'admin'
      ? isVi
        ? 'Quản trị viên (Admin)'
        : 'Administrator'
      : isVi
        ? 'Giáo viên (Teacher)'
        : 'Teacher';

  const activeTabMeta = tabs.find((t) => t.key === section) ?? tabs[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] gap-6 items-start">
      {/* Desktop Sticky Sidebar (248px) & Mobile Compact Header */}
      <aside className="lg:sticky lg:top-24 rounded-2xl border border-slate-200 bg-white p-4 space-y-5">
        <div className="space-y-2 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-900">
              <ShieldCheck
                className="w-4 h-4 text-sky-600 shrink-0"
                aria-hidden="true"
              />
              <span>{isVi ? 'Quản trị TM-Lingo' : 'TM-Lingo Admin'}</span>
            </div>
            <button
              type="button"
              onClick={() => void onStaffSignOut()}
              title={isVi ? 'Đăng xuất quản trị' : 'Staff sign out'}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Thoát' : 'Sign out'}</span>
            </button>
          </div>
          <div className="text-xs text-slate-600 space-y-0.5">
            <p className="font-semibold text-slate-800 truncate">{roleLabel}</p>
            <p className="text-slate-500 truncate">
              {staffUser.email ?? staffUser.displayName ?? 'Staff'}
            </p>
          </div>
        </div>

        <nav
          role="tablist"
          aria-label={isVi ? 'Phân hệ quản trị' : 'Administration modules'}
          className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(tab.key)}
                className={`inline-flex items-center gap-2.5 px-3 py-2.5 min-h-[40px] rounded-xl text-sm font-semibold transition-colors whitespace-nowrap lg:w-full text-left cursor-pointer ${
                  active
                    ? 'bg-sky-50 text-sky-900 border border-sky-200'
                    : 'text-slate-600 border border-transparent hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-sky-600' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => void onStaffSignOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>{isVi ? 'Đăng xuất quản trị' : 'Staff sign out'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="min-w-0 space-y-6">
        <div className="border-b border-slate-200 pb-4 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {activeTabMeta?.label ??
              (isVi
                ? 'Quản trị hệ thống TM-Lingo'
                : 'TM-Lingo System Administration')}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            {isVi
              ? 'Soạn bài học và truyện kể, quản lý thư viện học liệu, chiến dịch thông báo, cấu hình dịch vụ AI & lưu trữ, ngôn ngữ, giọng đọc và phân quyền nhân sự.'
              : 'Author lessons and stories, manage the media library, notification campaigns, AI & storage connections, languages, voices, and staff permissions.'}
          </p>
        </div>

      {section === 'overview' && (
        <AdminDashboardOverview
          interfaceLocale={interfaceLocale}
          canManageUsers={canManageUsers}
          languages={languages}
          ageGroups={ageGroups}
          mediaAssets={mediaAssets}
          onNavigateSection={setSection}
        />
      )}

      {section === 'cms' && (
        <AdminCmsStudio
          interfaceLocale={interfaceLocale}
          canPublish={canPublishCms}
          canHardDelete={isRoot}
          languages={languages}
          ageGroups={ageGroups}
          mediaAssets={activeMedia}
          onContentPublished={onContentPublished}
          onMediaChanged={() => void onReloadMedia()}
        />
      )}

      {section === 'story-sources' && (
        <AdminStorySourcesPanel
          interfaceLocale={interfaceLocale}
          ageGroups={ageGroups}
          canPublish={canPublishCms}
          canHardDelete={isRoot}
          onSourcesUpdated={onContentPublished}
        />
      )}

      {section === 'age-groups' && (
        <AdminAgeGroupsPanel
          interfaceLocale={interfaceLocale}
          canPublish={canPublishCms}
          canHardDelete={isRoot}
          onAgeGroupsUpdated={onAgeGroupsUpdated}
        />
      )}

      {section === 'notifications' && (
        <NotificationManager
          interfaceLocale={interfaceLocale}
          canHardDelete={isRoot}
          embedded
        />
      )}

      {section === 'providers' && canManageProviders && (
        <AdminProvidersPanel
          interfaceLocale={interfaceLocale}
          canHardDelete={isRoot}
        />
      )}

      {section === 'media' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">
                {messages.parent.mediaHeading}
              </h2>
              <p className="text-sm text-slate-600">
                {messages.parent.mediaSubtitle}{' '}
                {isVi
                  ? 'Lưu trữ giữ lại tệp để khôi phục khi cần; Xóa vĩnh viễn (chỉ quản trị cao nhất) sẽ gỡ bỏ hoàn toàn tệp.'
                  : 'Archiving keeps the file for restore; Permanent Delete (Root only) removes the file completely.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setMediaView('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                    mediaView === 'active'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isVi ? 'Đang dùng' : 'Active'} ({activeMedia.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMediaView('archived')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                    mediaView === 'archived'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isVi ? 'Đã lưu trữ' : 'Archived'} ({archivedMedia.length})
                </button>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleMediaSubmit}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {messages.parent.mediaTitleLabel}
                </span>
                <input
                  type="text"
                  maxLength={80}
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="Red Apple flashcard"
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {messages.parent.mediaFileLabel}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </label>
            </div>

            {mediaNotice && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {mediaNotice}
              </p>
            )}
            {mediaError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {mediaError}
              </p>
            )}

            <button
              type="submit"
              disabled={mediaBusy || !mediaFile}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>
                {mediaBusy
                  ? messages.parent.mediaUploading
                  : messages.parent.mediaUploadButton}
              </span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                placeholder={
                  isVi
                    ? 'Tìm kiếm theo tên học liệu hoặc ngôn ngữ...'
                    : 'Search media by title or language...'
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
              />
            </div>
            <select
              value={mediaKindFilter}
              onChange={(e) =>
                setMediaKindFilter(e.target.value as 'all' | 'image' | 'audio')
              }
              aria-label={isVi ? 'Lọc loại tệp' : 'Filter media kind'}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
            >
              <option value="all">
                {isVi ? 'Tất cả định dạng' : 'All formats'}
              </option>
              <option value="image">{isVi ? 'Hình ảnh' : 'Images'}</option>
              <option value="audio">{isVi ? 'Âm thanh' : 'Audio'}</option>
            </select>
          </div>

          {visibleMedia.length === 0 ? (
            <p className="text-sm text-slate-500">
              {mediaSearch.trim() || mediaKindFilter !== 'all'
                ? isVi
                  ? 'Không tìm thấy học liệu phù hợp với bộ lọc hiện tại.'
                  : 'No media assets match the current filter.'
                : mediaView === 'archived'
                  ? isVi
                    ? 'Chưa có học liệu nào trong kho lưu trữ.'
                    : 'No archived media assets.'
                  : messages.parent.mediaEmpty}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleMedia.map((asset) => {
                const isArchived = Boolean(asset.archivedAt);
                return (
                  <div
                    key={asset.id}
                    className={`rounded-xl border p-3 space-y-2.5 ${
                      isArchived
                        ? 'border-slate-200 bg-slate-50/70'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {asset.kind === 'image' ? (
                      <div className="aspect-[16/10] rounded-lg overflow-hidden bg-slate-50 border border-slate-100">
                        <img
                          src={asset.publicUrl}
                          alt={asset.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg border p-3 space-y-2.5 transition-colors ${
                          playingAssetId === asset.id
                            ? 'bg-sky-50/70 border-sky-200'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 min-w-0">
                            {playingAssetId === asset.id ? (
                              <Volume2
                                className="w-4 h-4 text-sky-600 animate-pulse shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <Music
                                className="w-4 h-4 text-sky-600 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span className="truncate">
                              Audio · {asset.locale.toUpperCase()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleToggleAudioPreview(asset)}
                            aria-pressed={playingAssetId === asset.id}
                            aria-label={
                              playingAssetId === asset.id
                                ? isVi
                                  ? `Dừng nghe thử ${asset.title}`
                                  : `Stop preview for ${asset.title}`
                                : isVi
                                  ? `Nghe thử ${asset.title}`
                                  : `Preview ${asset.title}`
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                              playingAssetId === asset.id
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : loadingAssetId === asset.id
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-sky-600 text-white hover:bg-sky-700'
                            }`}
                          >
                            {loadingAssetId === asset.id ? (
                              <>
                                <Loader2
                                  className="w-3.5 h-3.5 animate-spin"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'Đang tải' : 'Loading'}</span>
                              </>
                            ) : playingAssetId === asset.id ? (
                              <>
                                <Square
                                  className="w-3 h-3 fill-current"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'Dừng' : 'Stop'}</span>
                              </>
                            ) : (
                              <>
                                <Play
                                  className="w-3.5 h-3.5 fill-current"
                                  aria-hidden="true"
                                />
                                <span>{isVi ? 'Nghe thử' : 'Preview'}</span>
                              </>
                            )}
                          </button>
                        </div>
                        <audio
                          controls
                          src={asset.publicUrl}
                          onPlay={stopAudioPreview}
                          className="w-full h-9"
                        />
                        {previewErrorById[asset.id] && (
                          <p
                            role="alert"
                            className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1"
                          >
                            <AlertCircle
                              className="w-3.5 h-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{previewErrorById[asset.id]}</span>
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          {asset.kind === 'image' && (
                            <ImageIcon
                              className="w-3.5 h-3.5 text-slate-400 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate">{asset.title}</span>
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {(asset.sizeBytes / 1024).toFixed(0)} KB ·{' '}
                          {asset.locale.toUpperCase()}
                        </p>
                      </div>
                      <div className="flex justify-end pt-1 border-t border-slate-100">
                        <DeleteActionsControl
                          isArchived={isArchived}
                          isVi={isVi}
                          busy={mediaActionId === asset.id}
                          canHardDelete={isRoot}
                          onDelete={(mode) => handleMediaDelete(asset.id, mode)}
                          onRestore={() => handleMediaRestore(asset.id)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {section === 'languages' && (
        <AdminLanguagesPanel
          interfaceLocale={interfaceLocale}
          canHardDelete={isRoot}
          onLanguagesUpdated={onLanguagesUpdated}
        />
      )}

      {section === 'users' && canManageUsers && (
        <AdminAuditPanel
          authUser={staffUser}
          interfaceLocale={interfaceLocale}
          messages={messages}
        />
      )}
      </div>
    </div>
  );
}
