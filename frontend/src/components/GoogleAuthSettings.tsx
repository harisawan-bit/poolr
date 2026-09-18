/**
 * Google Auth Settings Tab — configuration for Google Sign-In.
 *
 * Allows users to configure their Google OAuth Client ID,
 * view step-by-step GCP setup instructions, launch sign-in in their
 * system browser, or enter an OAuth access token manually.
 */
import * as React from "react";
import {
  useAuth,
  setGoogleClientId,
  GOOGLE_CLIENT_ID_KEY,
  openExternalUrl,
  buildGoogleAuthUrl,
} from "../context/AuthContext";
import { GoogleSignInButton } from "./GoogleSignIn";
import { Card, Input, Button, Pill } from "./ui";
import {
  Shield,
  Key,
  ExternalLink,
  Cloud,
  Copy,
  Check,
  Globe,
  HelpCircle,
  Code2,
} from "lucide-react";

export function GoogleAuthSettings() {
  const { user, isAuthenticated, signOut, setManualToken, isSigningIn, error } = useAuth();
  const [clientId, setClientId] = React.useState(() => {
    try {
      return localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || "";
    } catch {
      return "";
    }
  });
  const [saved, setSaved] = React.useState(false);
  const [copiedCallback, setCopiedCallback] = React.useState(false);
  const [copiedAuthUrl, setCopiedAuthUrl] = React.useState(false);
  const [manualTokenInput, setManualTokenInput] = React.useState("");
  const [showManualToken, setShowManualToken] = React.useState(false);
  const [tokenApplied, setTokenApplied] = React.useState(false);

  const CALLBACK_URI = "http://127.0.0.1:5180/api/auth/google/callback";

  const handleSave = () => {
    setGoogleClientId(clientId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBrowser = async () => {
    if (!clientId.trim()) {
      alert("Please enter and save your Google OAuth Client ID first.");
      return;
    }
    const url = buildGoogleAuthUrl(clientId);
    await openExternalUrl(url);
  };

  const handleApplyManualToken = async () => {
    if (!manualTokenInput.trim()) return;
    await setManualToken(manualTokenInput.trim());
    setTokenApplied(true);
    setTimeout(() => setTokenApplied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* ── 1. Current Account Status ── */}
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
                  className="h-10 w-10 rounded-full border border-[var(--color-border)]"
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
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              Not signed in. Connect your Google account to sync projects to Google Drive and collaborate with teammates.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="max-w-xs">
                <GoogleSignInButton />
              </div>
              {clientId.trim() && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenBrowser}
                  disabled={isSigningIn}
                  className="flex items-center gap-1.5"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Sign in via Default Browser
                </Button>
              )}
            </div>
            {error && (
              <p className="text-[12px] text-[var(--color-exclude)]">{error}</p>
            )}
          </div>
        )}
      </Card>

      {/* ── 2. Google OAuth Client ID Configuration ── */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-[13px] font-semibold">Google Cloud OAuth Client ID</h3>
          </div>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[12px] text-[var(--color-accent)] hover:underline"
          >
            Google Cloud Console <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
          To enable Google Sign-In and Drive sync, create a free OAuth 2.0 Client ID in your Google Cloud Console.
        </p>

        <div className="mt-3 space-y-2">
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
            className="font-mono text-[12px]"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave}>
              {saved ? "Saved!" : "Save Client ID"}
            </Button>
            {clientId.trim() && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(buildGoogleAuthUrl(clientId), setCopiedAuthUrl)}
                className="flex items-center gap-1 text-[11.5px]"
              >
                {copiedAuthUrl ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copiedAuthUrl ? "Copied OAuth URL" : "Copy OAuth URL"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── 3. Step-by-Step GCP Setup Instructions ── */}
      <Card>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-[13px] font-semibold">How to Set Up Google Sign-In (3-Minute Setup)</h3>
        </div>

        <div className="mt-3 space-y-3 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
            <p className="font-semibold text-[var(--color-text)]">Step 1: Open Google Cloud Console</p>
            <p className="mt-0.5">
              Go to{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] underline"
              >
                console.cloud.google.com/apis/credentials
              </a>{" "}
              and select or create a project (e.g. &ldquo;Poolr Reviews&rdquo;).
            </p>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
            <p className="font-semibold text-[var(--color-text)]">Step 2: Enable Google Drive API</p>
            <p className="mt-0.5">
              In the API Library, search for <strong>Google Drive API</strong> and click <strong>Enable</strong>.
            </p>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
            <p className="font-semibold text-[var(--color-text)]">Step 3: Configure OAuth Consent Screen</p>
            <p className="mt-0.5">
              Choose <strong>External</strong> user type. Enter an App Name (e.g. <em>Poolr</em>) and your email. Under Scopes, add:
            </p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11.5px]">
              <li><code>.../auth/userinfo.profile</code> &amp; <code>.../auth/userinfo.email</code></li>
              <li><code>.../auth/drive.file</code> (Per-file access for your Poolr workspace)</li>
            </ul>
            <p className="mt-1 text-[11px]">
              Under <em>Test users</em>, add your own Google email address so you can log in while in testing mode.
            </p>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
            <p className="font-semibold text-[var(--color-text)]">Step 4: Create Credentials → OAuth Client ID</p>
            <p className="mt-0.5">
              Choose <strong>Web application</strong> as Application type. Then configure:
            </p>
            <div className="mt-2 space-y-2">
              <div>
                <span className="font-medium text-[var(--color-text)]">Authorized redirect URIs:</span>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-[var(--color-bg)] px-2 py-1 font-mono text-[11px] text-[var(--color-accent)]">
                    {CALLBACK_URI}
                  </code>
                  <button
                    onClick={() => copyToClipboard(CALLBACK_URI, setCopiedCallback)}
                    className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    {copiedCallback ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copiedCallback ? "Copied" : "Copy URI"}
                  </button>
                </div>
              </div>

              <div>
                <span className="font-medium text-[var(--color-text)]">Authorized JavaScript origins:</span>
                <div className="mt-1 flex flex-wrap gap-2 font-mono text-[11px]">
                  <code className="rounded bg-[var(--color-bg)] px-2 py-0.5">http://127.0.0.1:5180</code>
                  <code className="rounded bg-[var(--color-bg)] px-2 py-0.5">http://localhost:1420</code>
                  <code className="rounded bg-[var(--color-bg)] px-2 py-0.5">http://localhost:5173</code>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
            <p className="font-semibold text-[var(--color-text)]">Step 5: Paste &amp; Sign In</p>
            <p className="mt-0.5">
              Copy the resulting <strong>Client ID</strong>, paste it into the field above, click <strong>Save Client ID</strong>, and then click <strong>Sign In with Google</strong>!
            </p>
          </div>
        </div>
      </Card>

      {/* ── 4. Manual OAuth Token Entry (Fallback) ── */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-[13px] font-semibold">Direct Token Entry (Advanced / Offline Fallback)</h3>
          </div>
          <button
            onClick={() => setShowManualToken(!showManualToken)}
            className="text-[12px] text-[var(--color-accent)] hover:underline"
          >
            {showManualToken ? "Hide" : "Show"}
          </button>
        </div>

        {showManualToken && (
          <div className="mt-3 space-y-2 text-[12.5px]">
            <p className="text-[var(--color-text-muted)]">
              If your organization restricts redirects or you are using Google OAuth Playground, you can paste an active Google OAuth Access Token directly:
            </p>
            <Input
              value={manualTokenInput}
              onChange={(e) => setManualTokenInput(e.target.value)}
              placeholder="ya29.a0AfH6SM..."
              className="font-mono text-[11px]"
            />
            <Button size="sm" onClick={handleApplyManualToken}>
              {tokenApplied ? "Token Applied!" : "Authenticate with Token"}
            </Button>
          </div>
        )}
      </Card>

      {/* ── 5. Privacy & Permissions ── */}
      <Card>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-[13px] font-semibold">Permissions &amp; Privacy</h3>
        </div>
        <div className="mt-3 space-y-2 text-[12.5px]">
          <p className="font-medium">Requested OAuth scopes:</p>
          <ul className="space-y-1 text-[var(--color-text-muted)]">
            <li>• <code className="text-[11px]">openid</code> — Identity verification</li>
            <li>• <code className="text-[11px]">userinfo.profile</code> — Contributor display name &amp; avatar</li>
            <li>• <code className="text-[11px]">userinfo.email</code> — Team member invitations</li>
            <li>• <code className="text-[11px]">drive.file</code> — Access only Poolr workspace folders</li>
            <li>• <code className="text-[11px]">drive.appdata</code> — Store sync change logs</li>
          </ul>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Poolr uses Bring-Your-Own-Storage (BYOS). Your project files remain stored directly in your own Google Drive.
            No tokens or systematic review data are ever shared with any third party.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default GoogleAuthSettings;
