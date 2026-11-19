import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  locale?: string;
}

export function OfflineIndicator({ locale = 'vi' }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm"
    >
      <WifiOff className="w-4 h-4 text-amber-700" aria-hidden="true" />
      <span>
        {locale === 'vi'
          ? 'Đang ngoại tuyến — đang dùng dữ liệu đã lưu bộ nhớ đệm.'
          : 'Offline mode — using cached learning content.'}
      </span>
    </div>
  );
}
