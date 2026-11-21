'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import type {
  CmsLearningPackage,
  PublicationSnapshotRecord,
  StoryBook,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';

interface SnapshotHistoryModalProps {
  isVi: boolean;
  entityType: 'package' | 'story';
  entityId: string;
  entityTitle: string;
  currentVersion?: number;
  canPublish: boolean;
  onClose: () => void;
  onRolledBack: (message: string) => void;
}

export function SnapshotHistoryModal({
  isVi,
  entityType,
  entityId,
  entityTitle,
  currentVersion,
  canPublish,
  onClose,
  onRolledBack,
}: SnapshotHistoryModalProps) {
  const [snapshots, setSnapshots] = useState<PublicationSnapshotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySnapshotId, setBusySnapshotId] = useState<string | null>(null);
  const [confirmSnapshotId, setConfirmSnapshotId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.listCmsSnapshots({
        entityType,
        entityId,
        limit: 20,
      });
      setSnapshots(res.snapshots);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load version history'
      );
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const handleRollback = async (snapshot: PublicationSnapshotRecord) => {
    setBusySnapshotId(snapshot.snapshotId);
    setError(null);
    try {
      const res = await apiClient.rollbackCmsSnapshot({
        entityType,
        entityId,
        snapshotId: snapshot.snapshotId,
      });
      setConfirmSnapshotId(null);
      const msg = isVi
        ? `Đã khôi phục từ phiên bản v${res.restoredFromVersion} và xuất bản phiên bản mới v${res.snapshot.version}.`
        : `Restored from v${res.restoredFromVersion} and published version v${res.snapshot.version}.`;
      onRolledBack(msg);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setBusySnapshotId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={
        isVi ? 'Lịch sử phiên bản xuất bản' : 'Published version history'
      }
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isVi
                  ? 'Lịch sử phiên bản đã xuất bản'
                  : 'Published Version History'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 truncate mt-0.5">
              {entityTitle}
            </h2>
            <p className="text-xs font-mono text-slate-500">{entityId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">
              {isVi
                ? 'Đang tải lịch sử phiên bản...'
                : 'Loading version history...'}
            </p>
          ) : snapshots.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              {isVi
                ? 'Chưa có phiên bản xuất bản nào được lưu.'
                : 'No published versions recorded yet.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {snapshots.map((snap, idx) => {
                const isLatest =
                  idx === 0 ||
                  (currentVersion !== undefined &&
                    snap.version === currentVersion);
                const isConfirming = confirmSnapshotId === snap.snapshotId;
                const isBusy = busySnapshotId === snap.snapshotId;

                const countSummary =
                  snap.entityType === 'package'
                    ? (() => {
                        const p = snap.payload as CmsLearningPackage;
                        return isVi
                          ? `${p.concepts?.length ?? 0} từ vựng · ${p.titles?.vi || p.titles?.en || p.id}`
                          : `${p.concepts?.length ?? 0} concepts · ${p.titles?.en || p.titles?.vi || p.id}`;
                      })()
                    : (() => {
                        const s = snap.payload as StoryBook;
                        return isVi
                          ? `${s.segments?.length ?? 0} trang truyện · ${s.titles?.vi || s.titles?.en || s.id}`
                          : `${s.segments?.length ?? 0} pages · ${s.titles?.en || s.titles?.vi || s.id}`;
                      })();

                return (
                  <div
                    key={snap.snapshotId}
                    className="p-4 bg-white flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          v{snap.version}
                        </span>
                        {isLatest && (
                          <span className="text-xs font-semibold text-emerald-700">
                            · {isVi ? 'Phiên bản hiện tại' : 'Current live'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 truncate">
                        {countSummary}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {snap.publishedBy} ·{' '}
                        {new Date(snap.publishedAt).toLocaleString()}
                      </p>
                    </div>

                    {canPublish && !isLatest && (
                      <div className="flex items-center gap-1.5">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleRollback(snap)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                            >
                              <RotateCcw
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {isBusy
                                  ? isVi
                                    ? 'Đang khôi phục...'
                                    : 'Rolling back...'
                                  : isVi
                                    ? `Xác nhận về v${snap.version}`
                                    : `Confirm v${snap.version}`}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmSnapshotId(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                              {isVi ? 'Hủy' : 'Cancel'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmSnapshotId(snap.snapshotId)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <RotateCcw
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>
                              {isVi ? 'Khôi phục bản này' : 'Rollback'}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {isVi
              ? 'Thao tác khôi phục luôn tạo thêm phiên bản mới để bảo toàn lịch sử kiểm toán.'
              : 'Rollbacks append a new version so audit history remains strictly immutable.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
