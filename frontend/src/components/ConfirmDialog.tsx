import { motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}: Props) {
  if (!open) return null;

  const colors = {
    danger: 'text-red-500 bg-red-500/10 border-red-500/30',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    info: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  };

  const btnColors = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    info: 'bg-blue-500 hover:bg-blue-600 text-white',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4">
          <div className={`rounded-full p-2 ${colors[variant]}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">{title}</h3>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{message}</p>
          </div>
          <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" onClick={onCancel}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <button
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${btnColors[variant]}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
