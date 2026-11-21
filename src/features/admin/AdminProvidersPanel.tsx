'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  HardDrive,
  KeyRound,
  Plus,
  RefreshCw,
  Star,
  Wifi,
  XCircle,
} from 'lucide-react';
import type {
  AIProviderConnectionView,
  AIProviderModelView,
  DeleteMode,
  StorageConnectionView,
  StorageProviderKind,
} from '../../../packages/contracts/types';
import {
  apiClient,
  type SupportedAIProviderMeta,
} from '../../shared/apiClient';
import { DeleteActionsControl } from './DeleteActionsControl';

interface AdminProvidersPanelProps {
  interfaceLocale: string;
  canHardDelete?: boolean;
}

export function AdminProvidersPanel({
  interfaceLocale,
  canHardDelete = false,
}: AdminProvidersPanelProps) {
  const isVi = interfaceLocale === 'vi';
  const [subTab, setSubTab] = useState<'ai' | 'storage'>('ai');

  // AI Providers state
  const [aiConnections, setAiConnections] = useState<
    AIProviderConnectionView[]
  >([]);
  const [supportedAI, setSupportedAI] = useState<SupportedAIProviderMeta[]>([]);
  const [envFallbackAvailable, setEnvFallbackAvailable] = useState(false);
  const [envFallbackModel, setEnvFallbackModel] = useState('gemini-4-hydrogen');
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [testingAiId, setTestingAiId] = useState<string | null>(null);

  // AI form
  const [providerKey, setProviderKey] = useState('google_ai');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');

  // Storage Providers state
  const [storageConnections, setStorageConnections] = useState<
    StorageConnectionView[]
  >([]);
  const [storageEnvFallback, setStorageEnvFallback] = useState(false);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [storageSaving, setStorageSaving] = useState(false);
  const [testingStorageId, setTestingStorageId] = useState<string | null>(null);

  // Storage form
  const [storageName, setStorageName] = useState('');
  const [storageKind, setStorageKind] =
    useState<StorageProviderKind>('cloudflare_r2');
  const [storageEndpoint, setStorageEndpoint] = useState('');
  const [storageRegion, setStorageRegion] = useState('auto');
  const [storageBucket, setStorageBucket] = useState('');
  const [storagePublicUrl, setStoragePublicUrl] = useState('');
  const [storagePathPrefix, setStoragePathPrefix] = useState('media');
  const [storageAccessKey, setStorageAccessKey] = useState('');
  const [storageSecretKey, setStorageSecretKey] = useState('');

  const [aiView, setAiView] = useState<'active' | 'archived'>('active');
  const [storageView, setStorageView] = useState<'active' | 'archived'>(
    'active'
  );
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  const loadAI = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiClient.listAIProviders({ includeArchived: true });
      setAiConnections(res.connections);
      setSupportedAI(res.supportedProviders);
      setEnvFallbackAvailable(res.envFallbackAvailable);
      setEnvFallbackModel(res.envFallbackModel);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to load AI providers'
      );
    } finally {
      setAiLoading(false);
    }
  }, []);

  const loadStorage = useCallback(async () => {
    setStorageLoading(true);
    setStorageError(null);
    try {
      const res = await apiClient.listStorageProviders({
        includeArchived: true,
      });
      setStorageConnections(res.connections);
      setStorageEnvFallback(res.envFallbackAvailable);
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : 'Unable to load storage providers'
      );
    } finally {
      setStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAI();
    void loadStorage();
  }, [loadAI, loadStorage]);

  const handleSelectProviderKey = (nextKey: string) => {
    setProviderKey(nextKey);
    const meta = supportedAI.find((p) => p.key === nextKey);
    if (meta) {
      setAiBaseUrl(meta.defaultBaseUrl);
    }
  };

  const handleSaveAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiSaving(true);
    setAiError(null);
    setAiNotice(null);
    try {
      const res = await apiClient.saveAIProvider({
        providerKey,
        baseUrl: aiBaseUrl.trim() || undefined,
        apiKey: aiApiKey.trim() || undefined,
        enabled: true,
      });
      setAiApiKey('');
      setAiNotice(
        isVi
          ? `Đã lưu kết nối ${res.connection.providerName} thành công.`
          : `Saved ${res.connection.providerName} connection.`
      );
      await loadAI();
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Failed to save AI connection'
      );
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAI = async (connectionId: string) => {
    setTestingAiId(connectionId);
    setAiError(null);
    setAiNotice(null);
    try {
      const res = await apiClient.testAIProvider(connectionId);
      if (res.ok) {
        setAiNotice(res.message);
      } else {
        setAiError(res.message);
      }
      await loadAI();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTestingAiId(null);
    }
  };

  const handleTogglePrimaryModel = async (
    conn: AIProviderConnectionView,
    targetModelId: string
  ) => {
    const nextModels: AIProviderModelView[] = conn.models.map((m) => ({
      ...m,
      isPrimary: m.modelId === targetModelId,
      enabled: m.modelId === targetModelId ? true : m.enabled,
    }));
    try {
      const res = await apiClient.updateAIProviderModels(
        conn.connectionId,
        nextModels
      );
      setAiConnections((prev) =>
        prev.map((c) =>
          c.connectionId === conn.connectionId ? res.connection : c
        )
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to update models');
    }
  };

  const handleDeleteAI = async (connectionId: string, mode: DeleteMode) => {
    setBusyProviderId(connectionId);
    setAiError(null);
    setAiNotice(null);
    try {
      await apiClient.deleteAIProvider(connectionId, mode);
      setAiNotice(
        mode === 'hard'
          ? isVi
            ? 'Đã xóa vĩnh viễn kết nối AI Provider.'
            : 'Permanently deleted AI connection.'
          : isVi
            ? 'Đã lưu trữ kết nối AI Provider (có thể khôi phục).'
            : 'Archived AI connection (restorable).'
      );
      await loadAI();
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to remove AI connection'
      );
    } finally {
      setBusyProviderId(null);
    }
  };

  const handleRestoreAI = async (connectionId: string) => {
    setBusyProviderId(connectionId);
    setAiError(null);
    setAiNotice(null);
    try {
      await apiClient.restoreAIProvider(connectionId);
      setAiNotice(
        isVi ? 'Đã khôi phục AI Provider.' : 'Restored AI connection.'
      );
      await loadAI();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyProviderId(null);
    }
  };

  const handleSaveStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storageName.trim() || !storageEndpoint.trim() || !storageBucket.trim()) {
      return;
    }
    setStorageSaving(true);
    setStorageError(null);
    setStorageNotice(null);
    try {
      const res = await apiClient.saveStorageProvider({
        name: storageName.trim(),
        provider: storageKind,
        endpoint: storageEndpoint.trim(),
        region: storageRegion.trim() || 'auto',
        bucket: storageBucket.trim(),
        publicBaseUrl: storagePublicUrl.trim() || undefined,
        pathPrefix: storagePathPrefix.trim() || 'media',
        accessKeyId: storageAccessKey.trim() || undefined,
        secretAccessKey: storageSecretKey.trim() || undefined,
        isDefault: storageConnections.length === 0,
      });
      setStorageName('');
      setStorageEndpoint('');
      setStorageBucket('');
      setStoragePublicUrl('');
      setStorageAccessKey('');
      setStorageSecretKey('');
      setStorageNotice(
        isVi
          ? `Đã lưu cấu hình kho lưu trữ "${res.connection.name}".`
          : `Saved storage connection "${res.connection.name}".`
      );
      await loadStorage();
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : 'Failed to save storage provider'
      );
    } finally {
      setStorageSaving(false);
    }
  };

  const handleTestStorage = async (connectionId: string) => {
    setTestingStorageId(connectionId);
    setStorageError(null);
    setStorageNotice(null);
    try {
      const res = await apiClient.testStorageProvider(connectionId);
      if (res.ok) {
        setStorageNotice(res.message);
      } else {
        setStorageError(res.message);
      }
      await loadStorage();
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : 'Storage test failed');
    } finally {
      setTestingStorageId(null);
    }
  };

  const handleSetDefaultStorage = async (connectionId: string) => {
    try {
      await apiClient.setDefaultStorageProvider(connectionId);
      await loadStorage();
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : 'Could not change default storage'
      );
    }
  };

  const handleDeleteStorage = async (connectionId: string, mode: DeleteMode) => {
    setBusyProviderId(connectionId);
    setStorageError(null);
    setStorageNotice(null);
    try {
      await apiClient.deleteStorageProvider(connectionId, mode);
      setStorageNotice(
        mode === 'hard'
          ? isVi
            ? 'Đã xóa vĩnh viễn cấu hình kho lưu trữ.'
            : 'Permanently deleted storage configuration.'
          : isVi
            ? 'Đã lưu trữ cấu hình kho lưu trữ (có thể khôi phục).'
            : 'Archived storage configuration (restorable).'
      );
      await loadStorage();
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : 'Could not delete storage configuration'
      );
    } finally {
      setBusyProviderId(null);
    }
  };

  const handleRestoreStorage = async (connectionId: string) => {
    setBusyProviderId(connectionId);
    setStorageError(null);
    setStorageNotice(null);
    try {
      await apiClient.restoreStorageProvider(connectionId);
      setStorageNotice(
        isVi ? 'Đã khôi phục cấu hình kho lưu trữ.' : 'Restored storage configuration.'
      );
      await loadStorage();
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyProviderId(null);
    }
  };

  const activeAiConnections = aiConnections.filter((c) => !c.archivedAt);
  const archivedAiConnections = aiConnections.filter((c) =>
    Boolean(c.archivedAt)
  );
  const visibleAiConnections =
    aiView === 'active' ? activeAiConnections : archivedAiConnections;

  const activeStorageConnections = storageConnections.filter(
    (c) => !c.archivedAt
  );
  const archivedStorageConnections = storageConnections.filter((c) =>
    Boolean(c.archivedAt)
  );
  const visibleStorageConnections =
    storageView === 'active'
      ? activeStorageConnections
      : archivedStorageConnections;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          <button
            type="button"
            onClick={() => setSubTab('ai')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'ai'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4" aria-hidden="true" />
            <span>
              {isVi ? 'Kết nối AI' : 'AI Connections'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('storage')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'storage'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" aria-hidden="true" />
            <span>
              {isVi ? 'Lưu trữ học liệu' : 'Media Storage'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadAI();
            void loadStorage();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isVi ? 'Làm mới' : 'Refresh'}</span>
        </button>
      </div>

      {subTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                {isVi ? 'Thêm kết nối AI' : 'Add AI Connection'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isVi
                  ? 'Cấu hình khóa truy cập cho công cụ tạo bài học, dịch đa ngôn ngữ và tạo giọng đọc. Khóa được mã hóa bảo mật một chiều và không bao giờ hiển thị lại.'
                  : 'Configure access keys for lesson generation, translation, and voice synthesis. Keys are encrypted write-only and never displayed again.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-slate-900">
                {isVi ? 'Cấu hình AI mặc định' : 'Default AI Configuration'}
              </p>
              <p>
                {envFallbackAvailable
                  ? isVi
                    ? `Dịch vụ AI mặc định đang sẵn sàng (${envFallbackModel}) — tự động sử dụng khi chưa bật kết nối tùy chỉnh.`
                    : `Default AI service is ready (${envFallbackModel}) — used automatically when no custom connection is enabled.`
                  : isVi
                    ? 'Chưa có cấu hình mặc định. Hãy thêm một kết nối AI bên dưới.'
                    : 'No default AI service configured. Add a connection below.'}
              </p>
            </div>

            <form onSubmit={handleSaveAI} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {isVi ? 'Nhà cung cấp AI' : 'AI Provider'}
                </span>
                <select
                  value={providerKey}
                  onChange={(e) => handleSelectProviderKey(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {(supportedAI.length > 0
                    ? supportedAI
                    : [
                        {
                          key: 'google_ai',
                          name: 'Google AI (Gemini)',
                          defaultBaseUrl:
                            'https://generativelanguage.googleapis.com/v1beta/openai',
                        },
                        {
                          key: 'openai',
                          name: 'OpenAI',
                          defaultBaseUrl: 'https://api.openai.com/v1',
                        },
                      ]
                  ).map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  Base URL ({isVi ? 'tùy chọn' : 'optional'})
                </span>
                <input
                  type="url"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {isVi ? 'Khóa truy cập (bảo mật)' : 'Access key (protected)'}
                </span>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </label>

              <button
                type="submit"
                disabled={aiSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>
                  {aiSaving
                    ? isVi
                      ? 'Đang lưu...'
                      : 'Saving...'
                    : isVi
                      ? 'Lưu kết nối AI'
                      : 'Save AI Connection'}
                </span>
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {isVi
                    ? 'Danh sách AI Providers đã lưu'
                    : 'Configured AI Providers'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isVi
                    ? 'Kiểm tra kết nối để tự động khám phá danh sách model và chọn model chính cho AI Content Studio.'
                    : 'Test connections to discover models and select the primary model for AI Content Studio.'}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setAiView('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                    aiView === 'active'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isVi ? 'Đang dùng' : 'Active'} ({activeAiConnections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAiView('archived')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                    aiView === 'archived'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isVi ? 'Lưu trữ' : 'Archived'} (
                  {archivedAiConnections.length})
                </button>
              </div>
            </div>

            {aiNotice && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {aiNotice}
              </p>
            )}
            {aiError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {aiError}
              </p>
            )}

            {aiLoading ? (
              <p className="text-sm text-slate-500">
                {isVi ? 'Đang tải danh sách...' : 'Loading connections...'}
              </p>
            ) : visibleAiConnections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                {aiView === 'archived'
                  ? isVi
                    ? 'Chưa có AI Provider nào trong kho lưu trữ.'
                    : 'No archived AI providers.'
                  : isVi
                    ? 'Chưa có kết nối AI tùy chỉnh nào. Công cụ tạo nội dung sẽ dùng dịch vụ mặc định nếu có.'
                    : 'No custom AI connections saved yet. Content tools will use the default service if available.'}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleAiConnections.map((conn) => {
                  const isArchived = Boolean(conn.archivedAt);
                  return (
                    <div
                      key={conn.connectionId}
                      className={`rounded-xl border border-slate-200 p-4 space-y-3 ${
                        isArchived ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900">
                            {conn.providerName}{' '}
                            <span className="font-mono text-xs font-normal text-slate-500">
                              {conn.connectionId}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-2">
                            <KeyRound
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>
                              {conn.hasKey
                                ? isVi
                                  ? 'Đã lưu khóa bảo mật'
                                  : 'Key saved securely'
                                : isVi
                                  ? 'Không cần khóa / chưa đặt khóa'
                                  : 'Keyless / no key set'}
                            </span>
                            {conn.baseUrl && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate max-w-[240px]">
                                  {conn.baseUrl}
                                </span>
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {!isArchived && (
                            <button
                              type="button"
                              disabled={testingAiId === conn.connectionId}
                              onClick={() =>
                                void handleTestAI(conn.connectionId)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                            >
                              <Wifi
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {testingAiId === conn.connectionId
                                  ? isVi
                                    ? 'Đang kiểm tra...'
                                    : 'Testing...'
                                  : isVi
                                    ? 'Kiểm tra'
                                    : 'Test'}
                              </span>
                            </button>
                          )}
                          <DeleteActionsControl
                            isArchived={isArchived}
                            isVi={isVi}
                            busy={busyProviderId === conn.connectionId}
                            canHardDelete={canHardDelete}
                            onDelete={(mode) =>
                              handleDeleteAI(conn.connectionId, mode)
                            }
                            onRestore={() => handleRestoreAI(conn.connectionId)}
                          />
                        </div>
                      </div>

                      {!isArchived && conn.models.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">
                            Models ({conn.models.length})
                          </p>
                          <div className="divide-y divide-slate-100 text-xs">
                            {conn.models.slice(0, 6).map((m) => (
                              <div
                                key={m.modelId}
                                className="py-1.5 flex items-center justify-between gap-2"
                              >
                                <span className="font-mono text-slate-800 truncate">
                                  {m.modelId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleTogglePrimaryModel(
                                      conn,
                                      m.modelId
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                                    m.isPrimary
                                      ? 'text-sky-700'
                                      : 'text-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      m.isPrimary
                                        ? 'fill-sky-600 text-sky-600'
                                        : ''
                                    }`}
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {m.isPrimary
                                      ? isVi
                                        ? 'Model chính'
                                        : 'Primary'
                                      : isVi
                                        ? 'Chọn chính'
                                        : 'Set primary'}
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {subTab === 'storage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                {isVi
                  ? 'Thêm kho lưu trữ học liệu'
                  : 'Add Media Storage Connection'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isVi
                  ? 'Kết nối kho lưu trữ đám mây để lưu tranh minh họa và file âm thanh học liệu. Khi chưa kết nối, tệp sẽ được lưu tại bộ nhớ mặc định.'
                  : 'Connect cloud storage for curriculum illustrations and audio files. When none is configured, uploads use the default storage.'}
              </p>
            </div>

            {storageEnvFallback && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {isVi
                  ? 'Kho lưu trữ mặc định đang sẵn sàng sử dụng.'
                  : 'Default storage is ready.'}
              </div>
            )}

            <form onSubmit={handleSaveStorage} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    {isVi ? 'Tên kết nối' : 'Connection name'}
                  </span>
                  <input
                    type="text"
                    required
                    value={storageName}
                    onChange={(e) => setStorageName(e.target.value)}
                    placeholder="TM-Lingo R2 Media"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Provider
                  </span>
                  <select
                    value={storageKind}
                    onChange={(e) =>
                      setStorageKind(e.target.value as StorageProviderKind)
                    }
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="cloudflare_r2">Cloudflare R2</option>
                    <option value="aws_s3">AWS S3</option>
                    <option value="s3_compatible">S3 Compatible / MinIO</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700">
                  Endpoint URL
                </span>
                <input
                  type="url"
                  required
                  value={storageEndpoint}
                  onChange={(e) => setStorageEndpoint(e.target.value)}
                  placeholder="https://<account-id>.r2.cloudflarestorage.com"
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Bucket
                  </span>
                  <input
                    type="text"
                    required
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    placeholder="tm-lingo-media"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Region
                  </span>
                  <input
                    type="text"
                    value={storageRegion}
                    onChange={(e) => setStorageRegion(e.target.value)}
                    placeholder="auto"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Public CDN URL
                  </span>
                  <input
                    type="url"
                    value={storagePublicUrl}
                    onChange={(e) => setStoragePublicUrl(e.target.value)}
                    placeholder="https://media.tm-lingo.app"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Path Prefix
                  </span>
                  <input
                    type="text"
                    value={storagePathPrefix}
                    onChange={(e) => setStoragePathPrefix(e.target.value)}
                    placeholder="media"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Access Key ID
                  </span>
                  <input
                    type="password"
                    value={storageAccessKey}
                    onChange={(e) => setStorageAccessKey(e.target.value)}
                    autoComplete="new-password"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Secret Access Key
                  </span>
                  <input
                    type="password"
                    value={storageSecretKey}
                    onChange={(e) => setStorageSecretKey(e.target.value)}
                    autoComplete="new-password"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={storageSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>
                  {storageSaving
                    ? isVi
                      ? 'Đang lưu...'
                      : 'Saving...'
                    : isVi
                      ? 'Lưu Storage Provider'
                      : 'Save Storage Provider'}
                </span>
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {isVi
                    ? 'Kho lưu trữ đã cấu hình'
                    : 'Configured Storage'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isVi
                    ? 'Kho mặc định được sử dụng khi giáo viên tải ảnh và âm thanh trong Thư viện học liệu.'
                    : 'The default storage handles all media uploads from the Media Library.'}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setStorageView('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                    storageView === 'active'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isVi ? 'Đang dùng' : 'Active'} (
                  {activeStorageConnections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStorageView('archived')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                    storageView === 'archived'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isVi ? 'Lưu trữ' : 'Archived'} (
                  {archivedStorageConnections.length})
                </button>
              </div>
            </div>

            {storageNotice && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {storageNotice}
              </p>
            )}
            {storageError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {storageError}
              </p>
            )}

            {storageLoading ? (
              <p className="text-sm text-slate-500">
                {isVi ? 'Đang tải...' : 'Loading storage...'}
              </p>
            ) : visibleStorageConnections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                {storageView === 'archived'
                  ? isVi
                    ? 'Chưa có kho lưu trữ nào trong mục lưu trữ.'
                    : 'No archived storage.'
                  : isVi
                    ? 'Chưa có kho lưu trữ đám mây nào được cấu hình. Học liệu tải lên sẽ sử dụng kho lưu trữ mặc định.'
                    : 'No cloud storage connection configured yet. Uploaded media will use default storage.'}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleStorageConnections.map((conn) => {
                  const isArchived = Boolean(conn.archivedAt);
                  return (
                    <div
                      key={conn.connectionId}
                      className={`rounded-xl border border-slate-200 p-4 space-y-2.5 ${
                        isArchived ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>{conn.name}</span>
                            {conn.isDefault && !isArchived && (
                              <span className="text-xs font-semibold text-sky-700">
                                · {isVi ? 'Mặc định' : 'Default'}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {conn.bucket} · {conn.region}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-md">
                            {conn.publicBaseUrl}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {!isArchived && !conn.isDefault && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSetDefaultStorage(conn.connectionId)
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              {isVi ? 'Đặt mặc định' : 'Set default'}
                            </button>
                          )}
                          {!isArchived && (
                            <button
                              type="button"
                              disabled={testingStorageId === conn.connectionId}
                              onClick={() =>
                                void handleTestStorage(conn.connectionId)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                            >
                              <Wifi
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {testingStorageId === conn.connectionId
                                  ? isVi
                                    ? 'Đang kiểm tra...'
                                    : 'Testing...'
                                  : isVi
                                    ? 'Kiểm tra'
                                    : 'Test'}
                              </span>
                            </button>
                          )}
                          <DeleteActionsControl
                            isArchived={isArchived}
                            isVi={isVi}
                            busy={busyProviderId === conn.connectionId}
                            canHardDelete={canHardDelete}
                            onDelete={(mode) =>
                              handleDeleteStorage(conn.connectionId, mode)
                            }
                            onRestore={() =>
                              handleRestoreStorage(conn.connectionId)
                            }
                          />
                        </div>
                      </div>

                      {conn.lastTestAt && (
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
                          {conn.lastTestOk ? (
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <XCircle
                              className="w-3.5 h-3.5 text-amber-600 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span className="text-slate-600 truncate">
                            {conn.lastTestMessage ||
                              (conn.lastTestOk ? 'OK' : 'Failed')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
