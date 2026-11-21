'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck, X } from 'lucide-react';
import type { NotificationCampaign } from '../../packages/contracts/types';
import { apiClient } from '../shared/apiClient';

interface NotificationBellProps {
  userId: string;
  interfaceLocale: string;
  onNavigateTab: (tab: 'learn' | 'stories' | 'parents' | 'admin') => void;
}

function getReadStorageKey(userId: string) {
  return `tm_lingo_read_notifs_${userId}`;
}

function loadReadIds(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(getReadStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export function NotificationBell({
  userId,
  interfaceLocale,
  onNavigateTab,
}: NotificationBellProps) {
  const isVi = interfaceLocale === 'vi';
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<NotificationCampaign[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadIds(userId));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setReadIds(loadReadIds(userId));
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getNotificationInbox();
      setItems(res.notifications.slice(0, 15));
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Refresh when slideover opens
  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Close slideover on Escape and lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
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
    const merged = Array.from(
      new Set([...readIds, ...items.map((i) => i.id)])
    );
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

  const slideoverPortal =
    mounted && typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {open && (
              <div
                className="fixed inset-0 z-50 flex justify-end"
                role="dialog"
                aria-modal="true"
                aria-label={isVi ? 'Hộp thư thông báo' : 'Notification inbox'}
              >
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]"
                  aria-hidden="true"
                />

                {/* Slideover Drawer */}
                <motion.aside
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{
                    duration: 0.24,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative z-10 w-full max-w-md bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full flex flex-col"
                >
                  {/* Drawer Header */}
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-accent-soft text-accent shrink-0">
                        <Bell className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                          {isVi ? 'Thông báo của bạn' : 'Your notifications'}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {unreadCount > 0
                            ? isVi
                              ? `${unreadCount} thông báo chưa đọc`
                              : `${unreadCount} unread`
                            : isVi
                              ? 'Bạn đã xem hết thông báo'
                              : 'All caught up'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label={isVi ? 'Đóng thông báo' : 'Close notifications'}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Quick Action Row */}
                  {unreadCount > 0 && (
                    <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-end shrink-0">
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {isVi ? 'Đánh dấu tất cả đã đọc' : 'Mark all read'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Scrollable Notification List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                    {loading && items.length === 0 ? (
                      <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                        {isVi
                          ? 'Đang tải thông báo...'
                          : 'Loading notifications...'}
                      </div>
                    ) : items.length === 0 ? (
                      <div className="px-6 py-14 text-center space-y-2">
                        <div className="mx-auto w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500">
                          <Bell className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {isVi
                            ? 'Hiện chưa có thông báo mới'
                            : 'No new notifications'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isVi
                            ? 'Nhắc nhở học tập và cập nhật bài học sẽ hiển thị tại đây.'
                            : 'Study reminders and lesson updates will appear here.'}
                        </p>
                      </div>
                    ) : (
                      items.map((item) => {
                        const isUnread = !readIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleOpenItem(item)}
                            className={`w-full text-left px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/80 cursor-pointer ${
                              isUnread
                                ? 'bg-accent-soft'
                                : 'bg-white dark:bg-slate-950'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p
                                className={`text-sm leading-snug ${
                                  isUnread
                                    ? 'font-semibold text-slate-900 dark:text-slate-50'
                                    : 'font-medium text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {item.title}
                              </p>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums pt-0.5">
                                {item.scheduledFor ??
                                  (item.lastSentAt
                                    ? new Date(
                                        item.lastSentAt
                                      ).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : item.locale.toUpperCase())}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              {item.body}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isVi ? 'Mở thông báo' : 'Open notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={isVi ? 'Thông báo' : 'Notifications'}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors shrink-0 cursor-pointer ${
          open
            ? 'border-accent bg-accent-soft'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full btn-accent text-[10px] font-bold leading-[18px] text-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {slideoverPortal}
    </>
  );
}
