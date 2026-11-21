'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  getPendingQueueCount,
  subscribeOfflineQueue,
} from '../lib/offlineQueue';

interface OfflineIndicatorProps {
  locale?: string;
  lastSyncedCount?: number;
}

export function OfflineIndicator({
  locale = 'vi',
  lastSyncedCount = 0,
}: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getPendingQueueCount().then((count) => {
        if (active) setPendingCount(count);
      });
    };
    refresh();
    const unsub = subscribeOfflineQueue(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);

  if (!isOnline) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm tabular-nums"
      >
        <WifiOff className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
        <span>
          {locale === 'vi'
            ? pendingCount > 0
              ? `Đang ngoại tuyến · ${pendingCount} tiến độ chờ đồng bộ`
              : 'Đang ngoại tuyến — dùng dữ liệu đã lưu bộ nhớ đệm.'
            : pendingCount > 0
              ? `Offline · ${pendingCount} progress item(s) queued`
              : 'Offline mode — using cached learning content.'}
        </span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-900 shadow-sm tabular-nums"
      >
        <CloudUpload
          className="w-4 h-4 text-sky-700 shrink-0"
          aria-hidden="true"
        />
        <span>
          {locale === 'vi'
            ? `Đang chờ đồng bộ ${pendingCount} tiến độ học...`
            : `Syncing ${pendingCount} queued item(s)...`}
        </span>
      </div>
    );
  }

  if (lastSyncedCount > 0) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 shadow-sm tabular-nums"
      >
        <CheckCircle2
          className="w-4 h-4 text-emerald-700 shrink-0"
          aria-hidden="true"
        />
        <span>
          {locale === 'vi'
            ? `Đã đồng bộ ${lastSyncedCount} tiến độ ngoại tuyến.`
            : `Synced ${lastSyncedCount} offline item(s).`}
        </span>
      </div>
    );
  }

  return null;
}
