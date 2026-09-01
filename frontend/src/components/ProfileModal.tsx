import { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Input, Button } from './ui';
import type { ProfileData } from './kokonut/ProfileSetup';

// Avatar component from ProfileSetup
const AVATAR_RGB: Record<number, string> = {
  1: "255, 0, 91",
  2: "255, 125, 16",
  3: "10, 3, 16",
  4: "137, 252, 179",
};

function AvatarSvg({ bg, fg, mouth = "#000000", seed = 0 }: { bg: string; fg: string; mouth?: string; seed?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height="40" viewBox="0 0 36 36" width="40" xmlns="http://www.w3.org/2000/svg">
      <rect fill={bg} height="36" width="36" />
      <rect
        fill={fg}
        height="36"
        rx="6"
        transform={seed % 2 ? "translate(5 -1) rotate(55 18 18) scale(1.1)" : "translate(9 -5) rotate(219 18 18) scale(1)"}
        width="36"
      />
      <g transform={`translate(${seed === 3 ? -3 : 4.5} ${seed === 3 ? 3.5 : -4}) rotate(${seed === 3 ? 7 : 9} 18 18)`}>
        <path d="M15 19c2 1 4 1 6 0" fill="none" stroke={mouth} strokeLinecap="round" />
        <rect fill={mouth} height="2" rx="1" width="1.5" x={seed === 3 ? 12 : 10} y="14" />
        <rect fill={mouth} height="2" rx="1" width="1.5" x={seed === 3 ? 22 : 24} y="14" />
      </g>
    </svg>
  );
}

const avatars = [
  { id: 1, svg: <AvatarSvg bg="#ff005b" fg="#ffb238" seed={0} />, alt: "Ember" },
  { id: 2, svg: <AvatarSvg bg="#ff7d10" fg="#0a0310" mouth="#FFFFFF" seed={1} />, alt: "Amber" },
  { id: 3, svg: <AvatarSvg bg="#0a0310" fg="#ff005b" mouth="#FFFFFF" seed={2} />, alt: "Ink" },
  { id: 4, svg: <AvatarSvg bg="#d8fcb3" fg="#89fcb3" seed={3} />, alt: "Sage" },
];

interface Props {
  profile: ProfileData | null;
  onClose: () => void;
  onSave: (data: ProfileData) => void;
}

export default function ProfileModal({ profile, onClose, onSave }: Props) {
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarId, setAvatarId] = useState(profile?.avatarId || 1);

  const selectedAvatar = avatars.find(a => a.id === avatarId) || avatars[0];
  const rgb = AVATAR_RGB[avatarId];

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
            <Input value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} placeholder="Your name" />
          </div>

          <div>
            <label className="text-[10.5px] text-[var(--color-text-muted)]">Avatar</label>
            <div className="mt-2 flex gap-3">
              {avatars.map(avatar => {
                const isSelected = avatarId === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    className={`relative h-14 w-14 overflow-hidden rounded-xl border transition-all ${
                      isSelected
                        ? "border-[var(--color-border-strong)] opacity-100 ring-2 ring-[var(--color-accent)]/70 ring-offset-2 ring-offset-[var(--color-bg)]"
                        : "border-[var(--color-border)] opacity-50 hover:opacity-100"
                    }`}
                    onClick={() => setAvatarId(avatar.id)}
                    type="button"
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="scale-[2.3] transform">{avatar.svg}</div>
                    </div>
                    {isSelected && (
                      <div className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]">
                        <svg aria-hidden="true" className="h-3 w-3 text-[var(--btn-fg)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
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
