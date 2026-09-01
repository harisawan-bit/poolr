import { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Card, Input, Button } from './ui';
import type { ProfileData } from './kokonut/ProfileSetup';

interface Props {
  profile: ProfileData | null;
  onClose: () => void;
  onSave: (data: ProfileData) => void;
}

export default function ProfileModal({ profile, onClose, onSave }: Props) {
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarId, setAvatarId] = useState(profile?.avatarId || 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-[16px] font-semibold">Profile</h2>
          <button className="btn-ghost" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="text-[10.5px] text-[var(--color-text-muted)]">Display Name</label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" />
          </div>

          <div>
            <label className="text-[10.5px] text-[var(--color-text-muted)]">Avatar</label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4].map(id => (
                <button
                  key={id}
                  className={`h-12 w-12 rounded-full border-2 ${avatarId === id ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
                  onClick={() => setAvatarId(id)}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--color-surface-2)]">
                    <span className="text-[14px] font-medium">{String.fromCharCode(64 + id)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-[11px] text-[var(--color-text-muted)]">
            <p>Your data stays on your device. Cloud sync coming soon.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <Button variant="default" onClick={() => onSave({ username, avatarId })}>Save</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
