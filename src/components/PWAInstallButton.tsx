import { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  locale?: string;
  showUnavailableHint?: boolean;
}

export function PWAInstallButton({
  locale = 'vi',
  showUnavailableHint = false,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const isVi = locale === 'vi';

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>{isVi ? 'Cài ứng dụng' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>{isVi ? 'Cài trên iPhone / iPad' : 'Install on iOS'}</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 border border-slate-200 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                {isVi
                  ? 'Cài đặt TM-Lingo trên iPhone / iPad'
                  : 'Install TM-Lingo on iPhone / iPad'}
              </h3>
              <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                <li>
                  {isVi
                    ? 'Chạm nút Chia sẻ (Share) trên thanh công cụ Safari.'
                    : 'Tap the Share button in the Safari toolbar.'}
                </li>
                <li>
                  {isVi
                    ? 'Cuộn xuống và chọn Thêm vào Màn hình chính (Add to Home Screen).'
                    : 'Scroll down and tap Add to Home Screen.'}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
              >
                {isVi ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (showUnavailableHint) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        {isVi
          ? 'Mở ứng dụng trực tiếp trên trình duyệt Chrome/Edge hoặc Safari iOS (ngoài khung iframe) để thấy nút cài đặt lên màn hình chính.'
          : 'Open the app directly in Chrome, Edge, or iOS Safari (outside an iframe) to install it to your home screen.'}
      </p>
    );
  }

  return null;
}
