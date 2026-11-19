import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import type { NotificationCampaign } from '../../packages/contracts/types';
import { apiClient } from '../shared/apiClient';

interface NotificationBellProps {
  userId: string;
  isStaff: boolean;
  interfaceLocale: string;
  onNavigateTab: (tab: 'learn' | 'stories' | 'parents' | 'admin') => void;
  onOpenAdminNotifications: () => void;
}

function getReadStorageKey(userId: string) {
  return `tm_lingo_read_notifs_${userId}`;
}

function loadReadIds(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(getReadStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function NotificationBell({
  userId,
  isStaff,
  interfaceLocale,
  onNavigateTab,
  onOpenAdminNotifications,
}: NotificationBellProps) {
  const isVi = interfaceLocale === 'vi';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationCampaign[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadIds(userId));
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReadIds(loadReadIds(userId));
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getNotificationInbox();
      setItems(res.notifications.slice(0, 8));
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const saveReadIds = (next: string[]) => {
    setReadIds(next);
    try {
      window.localStorage.setItem(
        getReadStorageKey(userId),
        JSON.stringify(next)
      );
    } catch {
      // ignore storage quota errors
    }
  };

  const unreadCount = items.filter((item) => !readIds.includes(item.id)).length;

  const markAllRead = () => {
    const merged = Array.from(new Set([...readIds, ...items.map((i) => i.id)]));
    saveReadIds(merged);
  };

  const handleOpenItem = (item: NotificationCampaign) => {
    if (!readIds.includes(item.id)) {
      saveReadIds([...readIds, item.id]);
    }
    setOpen(false);
    if (item.targetUrl.includes('stories')) {
      onNavigateTab('stories');
    } else if (item.targetUrl.includes('parents')) {
      onNavigateTab('parents');
    } else {
      onNavigateTab('learn');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isVi ? 'Thông báo' : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors cursor-pointer ${
          open
            ? 'border-sky-300 bg-sky-50 text-sky-700'
            : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold leading-[18px] text-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={isVi ? 'Hộp thư thông báo' : 'Notification inbox'}
          className="absolute right-0 mt-2 w-[340px] sm:w-[380px] rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden z-40"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">
              {isVi ? 'Thông báo của bạn' : 'Your notifications'}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isVi ? 'Đánh dấu đã đọc' : 'Mark all read'}</span>
              </button>
            )}
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                {isVi ? 'Đang tải thông báo...' : 'Loading notifications...'}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                {isVi
                  ? 'Hiện chưa có thông báo mới.'
                  : 'You are all caught up.'}
              </div>
            ) : (
              items.map((item) => {
                const isUnread = !readIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenItem(item)}
                    className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-slate-50 cursor-pointer ${
                      isUnread ? 'bg-sky-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-snug ${
                          isUnread
                            ? 'font-semibold text-slate-900'
                            : 'font-medium text-slate-700'
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                        {item.scheduledFor ??
                          (item.lastSentAt
                            ? new Date(item.lastSentAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : item.locale.toUpperCase())}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {isStaff && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenAdminNotifications();
                }}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-sky-700 py-1 cursor-pointer"
              >
                <span>
                  {isVi
                    ? 'Mở quản trị thông báo trong Hệ thống'
                    : 'Manage notifications in System Admin'}
                </span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
