// Update modal — asks user before downloading/installing.
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { UpdateInfo } from '../lib/updater';

interface Props {
  info: UpdateInfo | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}

export default function UpdateModal({ info, open, onClose, onUpdate }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!info?.available || !open) return null;

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);
    try {
      await onUpdate();
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a1b23] border border-[#2a2b3a] rounded-2xl p-6 max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold text-[#e6e7ea] mb-2">Update Available</h2>
          <p className="text-[#8b8d96] text-sm mb-4">
            A new version of Poolr is available. Would you like to update now?
          </p>

          <div className="bg-[#0c0d11] rounded-lg p-3 mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[#8b8d96]">New version</span>
              <span className="text-[#e6e7ea] font-mono">{info.version}</span>
            </div>
            {info.date && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8b8d96]">Released</span>
                <span className="text-[#e6e7ea]">{info.date}</span>
              </div>
            )}
          </div>

          {info.body && (
            <div className="bg-[#0c0d11] rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              <p className="text-[#8b8d96] text-xs whitespace-pre-wrap">{info.body}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={downloading}
              className="flex-1 px-4 py-2 rounded-lg bg-[#2a2b3a] text-[#e6e7ea] text-sm font-medium hover:bg-[#3a3b4a] disabled:opacity-50 transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              disabled={downloading}
              className="flex-1 px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#2563eb] disabled:opacity-50 transition-colors"
            >
              {downloading ? 'Downloading...' : 'Update Now'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
