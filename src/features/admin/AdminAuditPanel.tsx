'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw, Search, Shield, Users } from 'lucide-react';
import type {
  AuthUserProfile,
  ManagedUserRecord,
  StaffAuditLogEntry,
  StaffRoleRecord,
  UserRole,
} from '../../../packages/contracts/types';
import { isRootRoleList } from '../../../packages/contracts/permissions';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';

interface AdminAuditPanelProps {
  authUser: AuthUserProfile;
  interfaceLocale: string;
  messages: UiMessages;
}

export function AdminAuditPanel({
  authUser,
  interfaceLocale,
  messages,
}: AdminAuditPanelProps) {
  const isVi = interfaceLocale === 'vi';
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [roles, setRoles] = useState<StaffRoleRecord[]>([]);
  const [logs, setLogs] = useState<StaffAuditLogEntry[]>([]);
  const [iamSource, setIamSource] = useState<'tm-hub' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditCategory, setAuditCategory] = useState<
    'all' | 'cms' | 'ai' | 'delete' | 'iam'
  >('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes, logsRes] = await Promise.all([
        apiClient.listAdminUsers(),
        apiClient.listStaffRoles().catch(() => ({ roles: [], source: 'local' as const })),
        apiClient.listAuditLogs(40).catch(() => ({ logs: [], source: 'local' as const })),
      ]);
      setUsers(usersRes.users);
      setIamSource(usersRes.source);
      setRoles(rolesRes.roles);
      setLogs(logsRes.logs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load staff IAM data'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRoleChange = async (userId: string, nextRole: UserRole) => {
    setUpdatingId(userId);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.updateUserRole(userId, nextRole);
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId ? res.user : u))
      );
      setNotice(
        isVi
          ? `Đã cập nhật vai trò cho ${res.user.email}.`
          : `Updated role for ${res.user.email}.`
      );
      const logsRes = await apiClient.listAuditLogs(40).catch(() => null);
      if (logsRes) setLogs(logsRes.logs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update staff role'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>
                {isVi ? 'Quản lý nhân sự' : 'Staff Management'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {isVi
                ? 'Nhân sự quản trị & Phân quyền'
                : 'Staff Accounts & Permissions'}
            </h2>
            <p className="text-sm text-slate-600">
              {isVi
                ? 'Tài khoản quản trị tách biệt hoàn toàn với tài khoản phụ huynh. Thao tác xóa vĩnh viễn chỉ dành riêng cho tài khoản Root; Quản trị viên và Giáo viên sử dụng Lưu trữ và Khôi phục.'
                : 'Staff accounts are kept separate from parent accounts. Permanent deletion is reserved exclusively for Root; Administrators and Teachers use Archive and Restore.'}
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
          </button>
        </div>

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

        {loading && users.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 rounded-lg bg-slate-100" />
            <div className="h-10 rounded-lg bg-slate-100" />
            <div className="h-10 rounded-lg bg-slate-100" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">{isVi ? 'Tài khoản' : 'Staff Account'}</th>
                  <th className="py-3 px-4">{isVi ? 'Vai trò' : 'Role'}</th>
                  <th className="py-3 pl-4 text-right">{isVi ? 'Phân quyền' : 'Assign'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isSelf = user.userId === authUser.id;
                  const isRowRoot = isRootRoleList(user.roles);
                  const busy = updatingId === user.userId;
                  return (
                    <tr key={user.userId}>
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-slate-900">
                          {user.displayName ?? user.email}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            isRowRoot
                              ? 'text-rose-700'
                              : user.role === 'admin'
                                ? 'text-sky-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {isRowRoot
                            ? isVi
                              ? 'Root (Toàn quyền)'
                              : 'Root (Full Access)'
                            : user.role === 'admin'
                              ? messages.parent.roleAdmin
                              : messages.parent.roleTeacher}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">
                            {isVi ? 'Phiên hiện tại' : 'Current session'}
                          </span>
                        ) : isRowRoot ? (
                          <span className="text-xs text-slate-400">
                            {isVi ? 'Bảo vệ (Root)' : 'Protected (Root)'}
                          </span>
                        ) : (
                          <select
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

      {/* Capability Roles Matrix */}
      {roles.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">
              {isVi ? 'Danh mục Vai trò & Capabilities' : 'Roles & Capabilities'}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200 p-4 space-y-2"
              >
                <p className="font-semibold text-slate-900">{r.name}</p>
                {r.description && (
                  <p className="text-xs text-slate-600">{r.description}</p>
                )}
                <p className="font-mono text-[11px] text-slate-500 leading-relaxed">
                  {r.permissions.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audit Logs */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">
              {isVi ? 'Nhật ký hoạt động quản trị' : 'Admin Activity Log'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder={isVi ? 'Tìm theo hành động, người dùng...' : 'Search logs...'}
                className="pl-8 pr-3 py-1.5 min-h-[34px] rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={auditCategory}
              onChange={(e) =>
                setAuditCategory(
                  e.target.value as 'all' | 'cms' | 'ai' | 'delete' | 'iam'
                )
              }
              aria-label={isVi ? 'Lọc theo nhóm hành động' : 'Filter audit category'}
              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
            >
              <option value="all">{isVi ? 'Tất cả nhóm' : 'All categories'}</option>
              <option value="cms">{isVi ? 'Nội dung & Xuất bản' : 'Content & Publish'}</option>
              <option value="ai">{isVi ? 'Công cụ AI' : 'AI Tools'}</option>
              <option value="delete">{isVi ? 'Lưu trữ / Xóa' : 'Archive / Delete'}</option>
              <option value="iam">{isVi ? 'Nhân sự & Cấu hình' : 'Staff & Settings'}</option>
            </select>
          </div>
        </div>

        {(() => {
          const q = auditQuery.trim().toLowerCase();
          const filteredLogs = logs.filter((entry) => {
            const actionLower = entry.action.toLowerCase();
            if (auditCategory === 'cms') {
              if (
                !actionLower.includes('cms') &&
                !actionLower.includes('publish') &&
                !actionLower.includes('rollback') &&
                !actionLower.includes('story') &&
                !actionLower.includes('package')
              ) {
                return false;
              }
            } else if (auditCategory === 'ai') {
              if (
                !actionLower.includes('ai') &&
                !actionLower.includes('generate') &&
                !actionLower.includes('adapt') &&
                !actionLower.includes('safety') &&
                !actionLower.includes('tts')
              ) {
                return false;
              }
            } else if (auditCategory === 'delete') {
              if (
                !actionLower.includes('delete') &&
                !actionLower.includes('archive') &&
                !actionLower.includes('restore')
              ) {
                return false;
              }
            } else if (auditCategory === 'iam') {
              if (
                !actionLower.includes('role') &&
                !actionLower.includes('user') &&
                !actionLower.includes('provider') &&
                !actionLower.includes('voice') &&
                !actionLower.includes('language')
              ) {
                return false;
              }
            }
            if (!q) return true;
            return (
              actionLower.includes(q) ||
              entry.actorName.toLowerCase().includes(q) ||
              entry.summary.toLowerCase().includes(q)
            );
          });

          if (filteredLogs.length === 0) {
            return (
              <p className="text-sm text-slate-500">
                {logs.length === 0
                  ? isVi
                    ? 'Chưa có nhật ký thao tác nào.'
                    : 'No audit logs recorded yet.'
                  : isVi
                    ? 'Không tìm thấy bản ghi nhật ký phù hợp bộ lọc.'
                    : 'No audit log entries match your filter.'}
              </p>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-500">
                    <th className="py-2.5 pr-4">{isVi ? 'Thời gian' : 'Time'}</th>
                    <th className="py-2.5 px-4">{isVi ? 'Người thực hiện' : 'Actor'}</th>
                    <th className="py-2.5 px-4">{isVi ? 'Hành động' : 'Action'}</th>
                    <th className="py-2.5 pl-4">{isVi ? 'Chi tiết' : 'Summary'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2.5 pr-4 text-slate-500 tabular-nums whitespace-nowrap">
                        {new Date(entry.at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        {entry.actorName}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {entry.action}
                      </td>
                      <td className="py-2.5 pl-4 text-slate-700">
                        {entry.summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
