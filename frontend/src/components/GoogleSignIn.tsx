/**
 * Google Sign-In Button Component
 *
 * Renders the official Google Sign-In button or a custom styled button
 * that triggers the GIS token flow. Follows Google's brand guidelines.
 */
import * as React from "react";
import { useAuth } from "../context/AuthContext";

export function GoogleSignInButton({
  onComplete,
  onError,
}: {
  onComplete?: () => void;
  onError?: (msg: string) => void;
}) {
  const { signIn, isSigningIn, error } = useAuth();
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (error) {
      setLocalError(error);
      onError?.(error);
    }
  }, [error, onError]);

  const handleClick = async () => {
    setLocalError(null);
    try {
      await signIn();
      onComplete?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setLocalError(msg);
      onError?.(msg);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={isSigningIn}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-[14px] font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {isSigningIn ? "Signing in…" : "Sign in with Google"}
      </button>
      {localError && (
        <p className="text-[12.5px] text-[var(--color-exclude)]">{localError}</p>
      )}
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Poolr uses Google Drive to sync your projects across devices and enable team collaboration. Your data remains encrypted and private.
      </p>
    </div>
  );
}

export function UserProfileChip() {
  const { user, signOut, isAuthenticated } = useAuth();

  if (!isAuthenticated() || !user) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] px-2 py-1 text-[12px]">
      {user.picture ? (
        <img
          src={user.picture}
          alt={user.name}
          className="h-6 w-6 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="max-w-[120px] truncate font-medium">{user.name}</span>
      <button
        onClick={signOut}
        className="ml-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-exclude)]"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  );
}
