'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  FolderOpen,
  Globe,
  GraduationCap,
  Layers,
  RefreshCw,
  Users,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  CmsLearningPackage,
  LocaleConfig,
  MediaAssetRecord,
  NotificationCampaign,
  StaffAuditLogEntry,
  StoryBook,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import type { AdminSection } from './AdminWorkspace';

interface AdminDashboardOverviewProps {
  interfaceLocale: string;
  canManageUsers: boolean;
  languages: LocaleConfig[];
  ageGroups: AgeGroupConfig[];
  mediaAssets: MediaAssetRecord[];
  onNavigateSection: (section: AdminSection) => void;
}

export function AdminDashboardOverview({
  interfaceLocale,
  canManageUsers,
  languages,
  ageGroups,
  mediaAssets,
  onNavigateSection,
}: AdminDashboardOverviewProps) {
  const isVi = interfaceLocale === 'vi';
  const [packages, setPackages] = useState<CmsLearningPackage[]>([]);
  const [stories, setStories] = useState<StoryBook[]>([]);
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [pkgRes, storyRes, notifRes] = await Promise.all([
        apiClient.listCmsPackages({ includeArchived: true }).catch(() => ({
          packages: [],
        })),
        apiClient.listCmsStories({ includeArchived: true }).catch(() => ({
          stories: [],
        })),
        apiClient.getNotificationCampaigns().catch(() => ({
          campaigns: [],
          logs: [],
        })),
      ]);
      setPackages(pkgRes.packages);
      setStories(storyRes.stories);
      setCampaigns(notifRes.campaigns);

      if (canManageUsers) {
        const logRes = await apiClient
          .listAuditLogs(8)
          .catch(() => ({ logs: [], source: 'local' as const }));
        setAuditLogs(logRes.logs);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers]);

  const activePackages = packages.filter((p) => !p.archivedAt);
  const publishedPackages = activePackages.filter((p) => p.status === 'published');
  const reviewPackages = activePackages.filter((p) => p.status === 'in_review');

  const activeStories = stories.filter((s) => !s.archivedAt);
  const publishedStories = activeStories.filter((s) => s.status === 'published');
  const reviewStories = activeStories.filter((s) => s.status === 'in_review');

  const activeMedia = mediaAssets.filter((m) => !m.archivedAt);
  const enabledLanguages = languages.filter((l) => l.enabled);
  const enabledAgeGroups = ageGroups.filter((g) => g.enabled && !g.archivedAt);

  const pendingReviewCount = reviewPackages.length + reviewStories.length;

  const missingAudioPackages = activePackages.filter((pkg) =>
    pkg.concepts.some((c) => !c.localizations.en?.audioUrl)
  ).length;

  const metrics: Array<{
    label: string;
    value: string;
    subtext: string;
    icon: typeof Layers;
    target: AdminSection;
  }> = [
    {
      label: isVi ? 'Gói bài học' : 'Learning Packages',
      value: `${publishedPackages.length} / ${activePackages.length}`,
      subtext: isVi
        ? `${publishedPackages.length} đã xuất bản · ${activePackages.length - publishedPackages.length} nháp/chờ duyệt`
        : `${publishedPackages.length} published · ${activePackages.length - publishedPackages.length} draft/review`,
      icon: Layers,
      target: 'cms',
    },
    {
      label: isVi ? 'Truyện tranh tương tác' : 'Interactive Stories',
      value: `${publishedStories.length} / ${activeStories.length}`,
      subtext: isVi
        ? `${publishedStories.length} đang hiển thị cho học sinh`
        : `${publishedStories.length} visible to learners`,
      icon: BookOpen,
      target: 'cms',
    },
    {
      label: isVi ? 'Nhóm tuổi (Mầm non – Lớp 12)' : 'Age Groups (Pre-K – G12)',
      value: String(enabledAgeGroups.length),
      subtext: isVi
        ? 'Cấu hình sẵn lộ trình và giao diện thích ứng'
        : 'Adaptive pacing and curriculum bands active',
      icon: GraduationCap,
      target: 'age-groups',
    },
    {
      label: isVi ? 'Thư viện học liệu' : 'Media Assets',
      value: String(activeMedia.length),
      subtext: isVi
        ? `${activeMedia.filter((m) => m.kind === 'image').length} hình ảnh · ${activeMedia.filter((m) => m.kind === 'audio').length} âm thanh`
        : `${activeMedia.filter((m) => m.kind === 'image').length} images · ${activeMedia.filter((m) => m.kind === 'audio').length} audio`,
      icon: FolderOpen,
      target: 'media',
    },
    {
      label: isVi ? 'Ngôn ngữ hoạt động' : 'Active Languages',
      value: String(enabledLanguages.length),
      subtext: enabledLanguages.map((l) => l.locale.toUpperCase()).join(' · '),
      icon: Globe,
      target: 'languages',
    },
    {
      label: isVi ? 'Chiến dịch thông báo' : 'Notifications',
      value: String(campaigns.length),
      subtext: isVi
        ? `${campaigns.filter((c) => c.status === 'sent').length} đã gửi tới phụ huynh`
        : `${campaigns.filter((c) => c.status === 'sent').length} delivered to families`,
      icon: Bell,
      target: 'notifications',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isVi ? 'Tổng quan học liệu & vận hành' : 'Curriculum & Operations Overview'}
          </h2>
          <p className="text-sm text-slate-600">
            {isVi
              ? 'Theo dõi nhanh số lượng bài học, truyện kể, nhóm tuổi và các mục cần kiểm duyệt.'
              : 'Live snapshot of packages, stories, K-12 age groups, media, and pending reviews.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMetrics()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{isVi ? 'Cập nhật số liệu' : 'Refresh metrics'}</span>
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigateSection(card.target)}
              className="text-left rounded-2xl border border-slate-200 bg-white p-5 hover:border-sky-300 transition-colors flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : card.value}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span className="truncate">{card.subtext}</span>
                <ArrowRight
                  className="w-3.5 h-3.5 text-slate-400 shrink-0"
                  aria-hidden="true"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Attention & Age Group Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">
              {isVi ? 'Mục cần lưu ý' : 'Items Needing Attention'}
            </h3>
            <button
              type="button"
              onClick={() => onNavigateSection('cms')}
              className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
            >
              {isVi ? 'Mở trình soạn thảo' : 'Open Content Studio'}
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  {isVi ? 'Nội dung đang chờ duyệt' : 'Pending Review Queue'}
                </p>
                <p className="text-xs text-slate-500">
                  {isVi
                    ? 'Các bài học và truyện kể đã gửi duyệt nhưng chưa xuất bản'
                    : 'Packages and stories submitted for publication review'}
                </p>
              </div>
              <span className="text-base font-bold text-sky-700 tabular-nums">
                {pendingReviewCount}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  {isVi
                    ? 'Bài học dùng giọng đọc tự động (chưa có tệp thu sẵn)'
                    : 'Packages without pre-recorded audio'}
                </p>
                <p className="text-xs text-slate-500">
                  {isVi
                    ? 'Có thể tạo giọng đọc AI trực tiếp trong cửa sổ Chỉnh sửa'
                    : 'You can generate voice recordings inside the package editor'}
                </p>
              </div>
              <span className="text-base font-bold text-slate-800 tabular-nums">
                {missingAudioPackages}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">
              {isVi ? 'Phủ nội dung theo nhóm tuổi K-12' : 'K-12 Age Group Coverage'}
            </h3>
            <button
              type="button"
              onClick={() => onNavigateSection('age-groups')}
              className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
            >
              {isVi ? 'Cấu hình nhóm tuổi' : 'Configure groups'}
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {enabledAgeGroups.map((group) => {
              const pkgCount = activePackages.filter((p) =>
                p.ageBand.includes(group.id)
              ).length;
              const storyCount = activeStories.filter((s) =>
                s.ageBands.includes(group.id)
              ).length;
              return (
                <div
                  key={group.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">
                      {isVi ? group.displayNames.vi : group.displayNames.en}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {group.minAge}–{group.maxAge} {isVi ? 'tuổi' : 'yrs'} ·{' '}
                      {group.uiProfile.defaultDailyMinutes}{' '}
                      {isVi ? 'phút/buổi' : 'min/session'}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {pkgCount} {isVi ? 'bài' : 'pkg'} · {storyCount}{' '}
                    {isVi ? 'truyện' : 'stories'}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Recent Staff Activity */}
      {canManageUsers && auditLogs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">
                {isVi ? 'Hoạt động quản trị gần đây' : 'Recent Staff Activity'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('users')}
              className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
            >
              {isVi ? 'Xem toàn bộ nhật ký' : 'View full log'}
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800">
                    {log.actorEmail || log.actorName}
                  </span>{' '}
                  <span className="text-slate-500">· {log.action}</span>
                  {(log.summary || log.docId) && (
                    <span className="text-slate-500">
                      {' '}
                      · {log.summary || log.docId}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 tabular-nums">
                  {new Date(log.at).toLocaleString(
                    isVi ? 'vi-VN' : 'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
