import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  Edit3,
  Plus,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type {
  NotificationCampaign,
  NotificationCategory,
  NotificationDeliveryLog,
  NotificationStatus,
  PushSubscriptionSummary,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import { requestFcmWebPushToken } from '../../firebase';
import {
  getPushSupportState,
  showLocalPreviewNotification,
  subscribeBrowserToPush,
  type PushSupportState,
} from '../../shared/pushClient';
import { PWAInstallButton } from '../../components/PWAInstallButton';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface NotificationManagerProps {
  interfaceLocale: string;
}

const ALL_CATEGORIES: NotificationCategory[] = [
  'reminder',
  'story',
  'progress',
  'announcement',
];

export function NotificationManager({
  interfaceLocale,
}: NotificationManagerProps) {
  const isVi = interfaceLocale === 'vi';
  const isOnline = useOnlineStatus();

  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [logs, setLogs] = useState<NotificationDeliveryLog[]>([]);
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionSummary[]>(
    []
  );
  const [statusFilter, setStatusFilter] = useState<'all' | NotificationStatus>(
    'all'
  );
  const [pushSupport, setPushSupport] = useState<PushSupportState>({
    supported: false,
    permission: 'unsupported',
    serviceWorkerReady: false,
  });

  // Composer form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('reminder');
  const [locale, setLocale] = useState(interfaceLocale);
  const [targetUrl, setTargetUrl] = useState('/');
  const [status, setStatus] = useState<NotificationStatus>('draft');
  const [scheduledFor, setScheduledFor] = useState('19:30');

  // Device subscription state
  const [deviceLabel, setDeviceLabel] = useState('Parent browser');
  const [selectedTopics, setSelectedTopics] =
    useState<NotificationCategory[]>([...ALL_CATEGORIES]);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryLabels: Record<NotificationCategory, string> = isVi
    ? {
        reminder: 'Nhắc học nhẹ nhàng',
        story: 'Truyện kể mới',
        progress: 'Tóm tắt tiến độ',
        announcement: 'Thông báo hệ thống',
      }
    : {
        reminder: 'Gentle reminder',
        story: 'New story',
        progress: 'Progress digest',
        announcement: 'Announcement',
      };

  const statusLabels: Record<NotificationStatus, string> = isVi
    ? {
        draft: 'Bản nháp',
        scheduled: 'Đã lên lịch',
        sent: 'Đã gửi',
      }
    : {
        draft: 'Draft',
        scheduled: 'Scheduled',
        sent: 'Sent',
      };

  const loadData = useCallback(async () => {
    try {
      const [cmpRes, subRes, support] = await Promise.all([
        apiClient.getNotificationCampaigns(),
        apiClient.getPushSubscriptions(),
        getPushSupportState(),
      ]);
      setCampaigns(cmpRes.campaigns);
      setLogs(cmpRes.logs);
      setSubscriptions(subRes.subscriptions);
      setPushSupport(support);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load notifications'
      );
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const showTempNotice = (msg: string) => {
    setError(null);
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const resetComposer = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setCategory('reminder');
    setLocale(interfaceLocale);
    setTargetUrl('/');
    setStatus('draft');
    setScheduledFor('19:30');
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        category,
        locale,
        targetUrl,
        status,
        scheduledFor: status === 'scheduled' ? scheduledFor : null,
      };
      if (editingId) {
        await apiClient.updateNotificationCampaign(editingId, payload);
        showTempNotice(
          isVi ? 'Đã cập nhật mẫu thông báo.' : 'Notification campaign updated.'
        );
      } else {
        await apiClient.createNotificationCampaign(payload);
        showTempNotice(
          isVi ? 'Đã tạo mẫu thông báo mới.' : 'Notification campaign created.'
        );
      }
      resetComposer();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
    } finally {
      setBusy(false);
    }
  };

  const handleEditCampaign = (cmp: NotificationCampaign) => {
    setEditingId(cmp.id);
    setTitle(cmp.title);
    setBody(cmp.body);
    setCategory(cmp.category);
    setLocale(cmp.locale);
    setTargetUrl(cmp.targetUrl);
    setStatus(cmp.status === 'sent' ? 'draft' : cmp.status);
    setScheduledFor(cmp.scheduledFor ?? '19:30');
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.deleteNotificationCampaign(campaignId);
      if (editingId === campaignId) resetComposer();
      await loadData();
      showTempNotice(isVi ? 'Đã xóa thông báo.' : 'Campaign deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  const handleSendCampaign = async (cmp: NotificationCampaign) => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.sendNotificationCampaign(cmp.id);
      await loadData();
      if (result.log.mode === 'no-subscribers') {
        showTempNotice(
          isVi
            ? 'Đã ghi nhận lịch sử gửi (chưa có thiết bị đăng ký push — hãy bật Push ở cột bên phải).'
            : 'Logged send event (no subscribed devices yet — enable Push on the right).'
        );
      } else {
        showTempNotice(
          isVi
            ? `Đã gửi Push tới ${result.log.sentCount} thiết bị.`
            : `Sent Web Push to ${result.log.sentCount} device(s).`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send push');
    } finally {
      setBusy(false);
    }
  };

  const handleLocalPreview = async (cmp: NotificationCampaign) => {
    setError(null);
    try {
      await showLocalPreviewNotification({
        title: cmp.title,
        body: cmp.body,
        url: cmp.targetUrl,
      });
      setPushSupport(await getPushSupportState());
      showTempNotice(
        isVi
          ? 'Đã hiển thị thông báo thử trên trình duyệt.'
          : 'Displayed local preview notification.'
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not display preview'
      );
    }
  };

  const handleEnableDevicePush = async () => {
    setBusy(true);
    setError(null);
    try {
      const { publicKey } = await apiClient.getVapidPublicKey();
      const subscription = await subscribeBrowserToPush(publicKey);
      // If user configured VITE_FIREBASE_VAPID_KEY in .env, also warm up FCM token
      await requestFcmWebPushToken().catch(() => null);
      await apiClient.subscribePush({
        subscription,
        deviceLabel: deviceLabel.trim() || 'Parent browser',
        locale: interfaceLocale,
        topics:
          selectedTopics.length > 0 ? selectedTopics : ['reminder', 'story'],
      });
      await loadData();
      showTempNotice(
        isVi
          ? 'Đã đăng ký nhận Push Notification cho thiết bị này.'
          : 'This device is now subscribed to Web Push notifications.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to subscribe this browser to Push.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSubscription = async (subId: string) => {
    setBusy(true);
    try {
      await apiClient.unsubscribePush(subId);
      await loadData();
      showTempNotice(
        isVi ? 'Đã hủy đăng ký thiết bị.' : 'Device subscription removed.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove device');
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = (topic: NotificationCategory) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const filteredCampaigns =
    statusFilter === 'all'
      ? campaigns
      : campaigns.filter((c) => c.status === statusFilter);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          {isVi
            ? 'Quản trị thông báo & PWA Push'
            : 'Notification management & PWA Push'}
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          {isVi
            ? 'Soạn thảo, lên lịch và gửi thông báo nhẹ nhàng cho phụ huynh (không gây áp lực điểm số cho trẻ), đồng thời quản lý cài đặt PWA và thiết bị nhận Web Push.'
            : 'Compose, schedule, and dispatch gentle parent notifications without pressuring children, while managing PWA installation and Web Push devices.'}
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Campaign Composer, List & Delivery Logs */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId
                  ? isVi
                    ? 'Chỉnh sửa thông báo'
                    : 'Edit notification'
                  : isVi
                    ? 'Tạo thông báo mới'
                    : 'Compose notification'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetComposer}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  {isVi ? 'Hủy sửa' : 'Cancel edit'}
                </button>
              )}
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {isVi ? 'Tiêu đề thông báo' : 'Title'}
                </span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isVi
                      ? 'Ví dụ: 5 phút nghe truyện cùng bé tối nay'
                      : 'e.g., Five calm minutes of English story time'
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {isVi ? 'Nội dung' : 'Message body'}
                </span>
                <textarea
                  required
                  rows={3}
                  maxLength={280}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    isVi
                      ? 'Nội dung thân thiện, tích cực dành cho phụ huynh...'
                      : 'Warm, pressure-free message for parents...'
                  }
                  className="w-full rounded-xl border border-slate-200 p-3.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    {isVi ? 'Chủ đề' : 'Category'}
                  </span>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as NotificationCategory)
                    }
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {categoryLabels[cat]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    {isVi ? 'Ngôn ngữ' : 'Locale'}
                  </span>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="vi">Tiếng Việt (vi)</option>
                    <option value="en">English (en)</option>
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    {isVi ? 'Trạng thái' : 'Status'}
                  </span>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as NotificationStatus)
                    }
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="draft">{statusLabels.draft}</option>
                    <option value="scheduled">{statusLabels.scheduled}</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    {isVi ? 'Đích mở khi chạm' : 'Target view'}
                  </span>
                  <select
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="/">{isVi ? 'Bài học (Learn)' : 'Lesson Player'}</option>
                    <option value="/?tab=stories">
                      {isVi ? 'Truyện kể (Stories)' : 'Story Reader'}
                    </option>
                    <option value="/?tab=parents">
                      {isVi ? 'Phụ huynh (Parents)' : 'Parent Controls'}
                    </option>
                  </select>
                </label>

                {status === 'scheduled' && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      {isVi ? 'Giờ nhắc hàng ngày' : 'Daily reminder time'}
                    </span>
                    <input
                      type="time"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 tabular-nums"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {editingId
                      ? isVi
                        ? 'Lưu thay đổi'
                        : 'Save changes'
                      : isVi
                        ? 'Lưu mẫu thông báo'
                        : 'Save notification'}
                  </span>
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                {isVi ? 'Danh sách chiến dịch thông báo' : 'Notification campaigns'}
              </h2>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(['all', 'draft', 'scheduled', 'sent'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {key === 'all'
                      ? isVi
                        ? 'Tất cả'
                        : 'All'
                      : statusLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            {filteredCampaigns.length === 0 ? (
              <p className="text-sm text-slate-500">
                {isVi
                  ? 'Chưa có thông báo nào ở trạng thái này.'
                  : 'No notification campaigns in this filter.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredCampaigns.map((cmp) => (
                  <article key={cmp.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs text-slate-500 tabular-nums">
                          {categoryLabels[cmp.category]} · {cmp.locale.toUpperCase()} ·{' '}
                          {statusLabels[cmp.status]}
                          {cmp.scheduledFor ? ` · ${cmp.scheduledFor}` : ''}
                        </p>
                        <h3 className="text-base font-bold text-slate-900">
                          {cmp.title}
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {cmp.body}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {isVi ? 'Đã gửi' : 'Sent'}: {cmp.sentCount}
                        {cmp.lastSentAt
                          ? ` · ${new Date(cmp.lastSentAt).toLocaleTimeString()}`
                          : ''}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleLocalPreview(cmp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                        >
                          <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Thử hiển thị' : 'Preview'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSendCampaign(cmp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Gửi Push' : 'Send Push'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditCampaign(cmp)}
                          className="p-2 min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                          aria-label="Edit campaign"
                        >
                          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDeleteCampaign(cmp.id)}
                          className="p-2 min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 text-slate-600 hover:text-rose-700 hover:border-rose-200 cursor-pointer"
                          aria-label="Delete campaign"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {isVi ? 'Nhật ký gửi thông báo' : 'Delivery history'}
            </h2>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">
                {isVi
                  ? 'Chưa có lượt gửi Push nào trong phiên này.'
                  : 'No push deliveries recorded yet.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-sm">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {log.campaignTitle}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {categoryLabels[log.category]} ·{' '}
                        {new Date(log.sentAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      {log.sentCount} ok / {log.failedCount} fail
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: PWA Status & Device Push Subscriptions */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-sky-600" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-900">
                {isVi ? 'Ứng dụng cài đặt (PWA)' : 'Installable PWA'}
              </h2>
            </div>

            <dl className="divide-y divide-slate-100 text-sm">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-600">
                  {isVi ? 'Kết nối mạng' : 'Network'}
                </dt>
                <dd className="font-semibold text-slate-900">
                  {isOnline
                    ? isVi
                      ? 'Trực tuyến'
                      : 'Online'
                    : isVi
                      ? 'Ngoại tuyến'
                      : 'Offline'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-600">Service Worker</dt>
                <dd className="font-semibold text-slate-900">
                  {pushSupport.serviceWorkerReady
                    ? isVi
                      ? 'Đã kích hoạt'
                      : 'Active'
                    : isVi
                      ? 'Đang chờ đăng ký'
                      : 'Pending'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-600">
                  {isVi ? 'Quyền thông báo' : 'Notification permission'}
                </dt>
                <dd className="font-semibold text-slate-900">
                  {pushSupport.permission}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-600">FCM Web Push Key</dt>
                <dd className="font-semibold text-slate-900">
                  {import.meta.env.VITE_FIREBASE_VAPID_KEY
                    ? isVi
                      ? 'Đã cấu hình'
                      : 'Configured'
                    : isVi
                      ? 'Đang dùng W3C VAPID'
                      : 'Using W3C VAPID'}
                </dd>
              </div>
            </dl>

            <PWAInstallButton locale={interfaceLocale} showUnavailableHint />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-5 h-5 text-sky-600" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-900">
                {isVi ? 'Đăng ký Web Push trên thiết bị này' : 'Device Push subscription'}
              </h2>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {isVi ? 'Tên gợi nhớ thiết bị' : 'Device label'}
                </span>
                <input
                  type="text"
                  maxLength={60}
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                />
              </label>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  {isVi ? 'Nhóm thông báo muốn nhận' : 'Subscribed topics'}
                </span>
                <div className="space-y-2">
                  {ALL_CATEGORIES.map((topic) => (
                    <label
                      key={topic}
                      className="flex items-center justify-between text-sm text-slate-700 cursor-pointer"
                    >
                      <span>{categoryLabels[topic]}</span>
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic)}
                        onChange={() => toggleTopic(topic)}
                        className="w-4 h-4 accent-sky-600"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleEnableDevicePush()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <BellRing className="w-4 h-4" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {isVi
                    ? 'Bật Push Notification cho trình duyệt này'
                    : 'Enable Web Push on this browser'}
                </span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 tabular-nums">
                {isVi ? 'Thiết bị đã đăng ký' : 'Registered devices'} (
                {subscriptions.length})
              </h3>
              {subscriptions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {isVi
                    ? 'Chưa có thiết bị nào đăng ký nhận Push.'
                    : 'No devices subscribed yet.'}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {sub.deviceLabel}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {sub.endpointPreview}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveSubscription(sub.id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-700 cursor-pointer"
                        aria-label="Unsubscribe device"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
