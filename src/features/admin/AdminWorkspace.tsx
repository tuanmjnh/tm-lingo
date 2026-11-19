import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Music,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type {
  AuthUserProfile,
  LocaleConfig,
  ManagedUserRecord,
  MediaAssetRecord,
  UserRole,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';
import { NotificationManager } from '../notifications/NotificationManager';

export type AdminSection = 'notifications' | 'media' | 'languages' | 'users';

interface AdminWorkspaceProps {
  authUser: AuthUserProfile;
  interfaceLocale: string;
  activeLearningLocale: string;
  initialSection?: AdminSection;
  languages: LocaleConfig[];
  mediaAssets: MediaAssetRecord[];
  messages: UiMessages;
  onUploadMedia: (payload: {
    file: File;
    title: string;
    locale: string;
  }) => Promise<void>;
  onDeleteMedia: (assetId: string) => Promise<void>;
}

export function AdminWorkspace({
  authUser,
  interfaceLocale,
  activeLearningLocale,
  initialSection = 'notifications',
  languages,
  mediaAssets,
  messages,
  onUploadMedia,
  onDeleteMedia,
}: AdminWorkspaceProps) {
  const isVi = interfaceLocale === 'vi';
  const isAdmin = authUser.role === 'admin';
  const [section, setSection] = useState<AdminSection>(initialSection);

  // Sync external initialSection jumps (e.g. from NotificationBell)
  const lastInitialRef = useRef(initialSection);
  if (lastInitialRef.current !== initialSection) {
    lastInitialRef.current = initialSection;
    setSection(initialSection);
  }

  // Supabase Storage upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Admin Users & Roles state
  const [managedUsers, setManagedUsers] = useState<ManagedUserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersNotice, setUsersNotice] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadManagedUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await apiClient.listAdminUsers();
      setManagedUsers(res.users);
    } catch (err) {
      setUsersError(
        err instanceof Error ? err.message : 'Could not load users'
      );
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (section === 'users' && isAdmin) {
      void loadManagedUsers();
    }
  }, [section, isAdmin, loadManagedUsers]);

  const handleRoleChange = async (userId: string, nextRole: UserRole) => {
    setUpdatingUserId(userId);
    setUsersError(null);
    setUsersNotice(null);
    try {
      const res = await apiClient.updateUserRole(userId, nextRole);
      setManagedUsers((prev) =>
        prev.map((u) => (u.userId === userId ? res.user : u))
      );
      setUsersNotice(
        isVi
          ? `Đã cập nhật quyền cho ${res.user.email ?? res.user.displayName ?? userId}.`
          : `Updated role for ${res.user.email ?? res.user.displayName ?? userId}.`
      );
    } catch (err) {
      setUsersError(
        err instanceof Error ? err.message : 'Could not update role'
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile) return;
    setMediaBusy(true);
    setMediaError(null);
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
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setMediaBusy(false);
    }
  };

  const tabs: Array<{
    key: AdminSection;
    label: string;
    icon: typeof Bell;
  }> = [
    {
      key: 'notifications',
      label: isVi ? 'Thông báo & Push' : 'Notifications & Push',
      icon: Bell,
    },
    {
      key: 'media',
      label: isVi ? 'Thư viện học liệu' : 'Media Library',
      icon: FolderOpen,
    },
    {
      key: 'languages',
      label: 'Language Registry',
      icon: Globe,
    },
    ...(isAdmin
      ? [
          {
            key: 'users' as const,
            label: isVi ? 'Tài khoản & Phân quyền' : 'Users & Roles',
            icon: Users,
          },
        ]
      : []),
  ];

  const roleLabel =
    authUser.role === 'admin'
      ? isVi
        ? 'Quản trị viên (Admin)'
        : 'Administrator'
      : isVi
        ? 'Giáo viên (Teacher)'
        : 'Teacher';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck className="w-4 h-4 text-sky-600" aria-hidden="true" />
            <span className="font-semibold text-slate-800">{roleLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{authUser.email ?? authUser.displayName ?? 'Admin'}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isVi ? 'Quản trị hệ thống TM-Lingo' : 'TM-Lingo System Administration'}
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            {isVi
              ? 'Quản lý kho học liệu trên Supabase Storage, chiến dịch thông báo Web Push, năng lực đa ngôn ngữ và phân quyền giáo viên.'
              : 'Manage Supabase Storage curriculum media, Web Push notification campaigns, language capabilities, and staff role permissions.'}
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          role="tablist"
          aria-label={isVi ? 'Phân hệ quản trị' : 'Administration modules'}
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
                className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {section === 'notifications' && (
        <NotificationManager interfaceLocale={interfaceLocale} embedded />
      )}

      {section === 'media' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">
              {messages.parent.mediaHeading}
            </h2>
            <p className="text-sm text-slate-600">
              {messages.parent.mediaSubtitle}
            </p>
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

          {mediaAssets.length === 0 ? (
            <p className="text-sm text-slate-500">{messages.parent.mediaEmpty}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mediaAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-xl border border-slate-200 p-3 space-y-2.5 bg-white"
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
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <Music className="w-4 h-4 text-sky-600" aria-hidden="true" />
                        <span>Audio · {asset.locale.toUpperCase()}</span>
                      </div>
                      <audio controls src={asset.publicUrl} className="w-full h-9" />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
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
                    <button
                      type="button"
                      onClick={() => void onDeleteMedia(asset.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      aria-label={messages.parent.mediaDelete}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {section === 'languages' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">
              {messages.parent.registryHeading}
            </h2>
            <p className="text-sm text-slate-600">
              {isVi
                ? 'Danh mục ngôn ngữ được tách độc lập giữa giao diện, nội dung học, giải thích và giọng đọc.'
                : 'System locale capabilities separated cleanly across UI, learning content, explanation, and narration.'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">{isVi ? 'Ngôn ngữ' : 'Language'}</th>
                  <th className="py-3 px-4">Locale</th>
                  <th className="py-3 px-4">UI</th>
                  <th className="py-3 px-4">{isVi ? 'Học' : 'Learning'}</th>
                  <th className="py-3 px-4">{isVi ? 'Giải thích' : 'Explanation'}</th>
                  <th className="py-3 px-4">TTS</th>
                  <th className="py-3 pl-4 text-right">{isVi ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {languages.map((lang) => (
                  <tr key={lang.locale}>
                    <td className="py-3.5 pr-4 font-semibold text-slate-900">
                      {lang.nativeName}{' '}
                      <span className="font-normal text-slate-500">
                        ({lang.displayName})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {lang.locale}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {lang.uiEnabled ? 'Yes' : 'No'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {lang.learningEnabled ? 'Yes' : 'No'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {lang.explanationEnabled ? 'Yes' : 'No'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {lang.ttsEnabled ? 'Yes' : 'No'}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <span
                        className={`text-xs font-semibold ${
                          lang.contentStatus === 'ready'
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {lang.contentStatus === 'ready'
                          ? messages.parent.statusReady
                          : messages.parent.statusPlanned}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === 'users' && isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">
                {isVi ? 'Tài khoản & Phân quyền' : 'Users & Role Management'}
              </h2>
              <p className="text-sm text-slate-600">
                {isVi
                  ? 'Mọi tài khoản đăng ký mới hoặc đăng nhập bằng Google mặc định có vai trò Phụ huynh (Parent). Chỉ Quản trị viên mới có thể cấp quyền Giáo viên hoặc Quản trị viên.'
                  : 'All public sign-ups and Google logins default to Parent. Only Administrators can promote accounts to Teacher or Administrator.'}
              </p>
            </div>
            <button
              type="button"
              disabled={usersLoading}
              onClick={() => void loadManagedUsers()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
            </button>
          </div>

          {usersNotice && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {usersNotice}
            </p>
          )}
          {usersError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {usersError}
            </p>
          )}

          {usersLoading && managedUsers.length === 0 ? (
            <p className="text-sm text-slate-500">
              {isVi ? 'Đang tải danh sách tài khoản...' : 'Loading accounts...'}
            </p>
          ) : managedUsers.length === 0 ? (
            <p className="text-sm text-slate-500">
              {isVi ? 'Chưa có tài khoản nào trong hệ thống.' : 'No users found.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-3 pr-4">
                      {isVi ? 'Tài khoản' : 'Account'}
                    </th>
                    <th className="py-3 px-4">
                      {isVi ? 'Vai trò' : 'Role'}
                    </th>
                    <th className="py-3 px-4">
                      {isVi ? 'Cập nhật gần nhất' : 'Last updated'}
                    </th>
                    <th className="py-3 pl-4 text-right">
                      {isVi ? 'Phân quyền' : 'Assign role'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {managedUsers.map((user) => {
                    const isSelf = user.userId === authUser.id;
                    const busy = updatingUserId === user.userId;
                    return (
                      <tr key={user.userId}>
                        <td className="py-3.5 pr-4">
                          <p className="font-semibold text-slate-900">
                            {user.displayName ?? user.email ?? user.userId}
                          </p>
                          {user.email && (
                            <p className="text-xs text-slate-500">{user.email}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-semibold ${
                              user.role === 'admin'
                                ? 'text-sky-700'
                                : user.role === 'teacher'
                                  ? 'text-emerald-700'
                                  : 'text-slate-600'
                            }`}
                          >
                            {user.role === 'admin'
                              ? messages.parent.roleAdmin
                              : user.role === 'teacher'
                                ? messages.parent.roleTeacher
                                : messages.parent.roleParent}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums">
                          {new Date(user.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          {isSelf ? (
                            <span className="text-xs text-slate-400">
                              {isVi ? 'Tài khoản hiện tại' : 'Current session'}
                            </span>
                          ) : (
                            <select
                              aria-label={
                                isVi
                                  ? `Phân quyền cho ${user.email ?? user.userId}`
                                  : `Assign role for ${user.email ?? user.userId}`
                              }
                              disabled={busy}
                              value={user.role}
                              onChange={(e) =>
                                void handleRoleChange(
                                  user.userId,
                                  e.target.value as UserRole
                                )
                              }
                              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 disabled:opacity-50"
                            >
                              <option value="parent">
                                {messages.parent.roleParent} (parent)
                              </option>
                              <option value="teacher">
                                {messages.parent.roleTeacher} (teacher)
                              </option>
                              <option value="admin">
                                {messages.parent.roleAdmin} (admin)
                              </option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
