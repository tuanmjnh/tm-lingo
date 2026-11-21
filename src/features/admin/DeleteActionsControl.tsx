'use client';

import { useState } from 'react';
import { Archive, RotateCcw, Trash2, X } from 'lucide-react';
import type { DeleteMode } from '../../../packages/contracts/types';

interface DeleteActionsControlProps {
  isArchived: boolean;
  isVi: boolean;
  busy?: boolean;
  canHardDelete?: boolean;
  hardDeleteProtectedHint?: string;
  onDelete: (mode: DeleteMode) => Promise<void> | void;
  onRestore: () => Promise<void> | void;
}

export function DeleteActionsControl({
  isArchived,
  isVi,
  busy = false,
  canHardDelete = false,
  hardDeleteProtectedHint,
  onDelete,
  onRestore,
}: DeleteActionsControlProps) {
  const [confirmingHard, setConfirmingHard] = useState(false);

  if (confirmingHard) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1">
        <span className="text-[11px] font-semibold text-rose-800 whitespace-nowrap">
          {isVi ? 'Xóa vĩnh viễn?' : 'Delete forever?'}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConfirmingHard(false);
            void onDelete('hard');
          }}
          className="px-2 py-1 rounded-md bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          {isVi ? 'Xác nhận' : 'Confirm'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmingHard(false)}
          className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white cursor-pointer"
          aria-label={isVi ? 'Hủy' : 'Cancel'}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {isArchived ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRestore()}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isVi ? 'Khôi phục' : 'Restore'}</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDelete('soft')}
          title={
            isVi
              ? 'Lưu trữ (có thể khôi phục)'
              : 'Archive (restorable)'
          }
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isVi ? 'Lưu trữ' : 'Archive'}</span>
        </button>
      )}

      {canHardDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmingHard(true)}
          title={
            isVi
              ? 'Xóa vĩnh viễn'
              : 'Permanently delete'
          }
          aria-label={isVi ? 'Xóa vĩnh viễn' : 'Permanently delete'}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      ) : (
        hardDeleteProtectedHint && (
          <span
            title={hardDeleteProtectedHint}
            className="text-[11px] text-slate-400 px-1.5 whitespace-nowrap"
          >
            {isVi ? 'Mặc định' : 'Core'}
          </span>
        )
      )}
    </div>
  );
}
