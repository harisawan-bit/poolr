/**
 * Google Auth Settings Tab — configuration for Google Sign-In.
 *
 * Allows users to configure their Google OAuth Client ID
 * (for custom GCP projects) and view current auth status.
 */
import * as React from "react";
import { useAuth } from "../context/AuthContext";
import { GoogleSignInButton } from "./GoogleSignIn";
import { Card, Input, Button, Pill } from "./ui";
import { Shield, Key, ExternalLink, Cloud } from "lucide-react";

const GOOGLE_CLIENT_ID_KEY = "poolr.googleClientId";

export function GoogleAuthSettings() {
  const { user, isAuthenticated, signOut } = useAuth();
  const [clientId, setClientId] = React.useState(() => {
    try { return localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || ""; } catch { return ""; };
  });
  const [saved, setSaved] = React.useState(false);

  const handleSave = () => {
    try {
      if (clientId.trim()) {
        localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim());
      } else {
        localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-[13px] font-semibold">Google Account</h3>
        </div>

        {isAuthenticated() && user ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-10 w-10 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-[16px] font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-[13px] font-medium">{user.name}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{user.email}</p>
              </div>
              <Pill tone="include">Signed in</Pill>
            </div>
            <Button size="sm" variant="ghost" onClick={signOut}>Sign out</Button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              Not signed in. Sign in to enable Drive sync and team collaboration.
            </p>
            <div className="mt-3 max-w-xs">
              <GoogleSignInButton />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-[13px] font-semibold">OAuth Client ID</h3>
        </div>
        <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
          Optional. Use a custom Google Cloud Platform OAuth 2.0 Client ID for
          sign-in. Leave empty to use the default Poolr client.
        </p>
        <div className="mt-3 space-y-2">
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="your-client-id.apps.googleusercontent.com"
            className="font-mono text-[12px]"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave}>
              {saved ? "Saved!" : "Save"}
            </Button>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[var(--color-accent)] hover:underline"
            >
              <span className="flex items-center gap-1">
                Google Cloud Console <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-[13px] font-semibold">Permissions</h3>
        </div>
        <div className="mt-3 space-y-2 text-[12.5px]">
          <p className="font-medium">Requested OAuth scopes:</p>
          <ul className="space-y-1 text-[var(--color-text-muted)]">
            <li>• <code className="text-[11px]">openid</code> — Sign in with Google</li>
            <li>• <code className="text-[11px]">userinfo.profile</code> — Display name &amp; avatar</li>
            <li>• <code className="text-[11px]">userinfo.email</code> — Email address</li>
            <li>• <code className="text-[11px]">drive.file</code> — Access Poolr project files</li>
            <li>• <code className="text-[11px]">drive.appdata</code> — Store sync metadata</li>
          </ul>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Poolr never accesses files outside its own folders. All tokens are
            stored locally in your browser and never transmitted to any Poolr server.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default GoogleAuthSettings;
