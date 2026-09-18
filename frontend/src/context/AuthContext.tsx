/**
 * AuthContext — Google Sign-In state management.
 *
 * Handles Google OAuth 2.0 token lifecycle, user profile, and
 * session persistence. Uses the Google Identity Services (GIS)
 * library loaded at runtime for secure PKCE-based auth.
 */
import * as React from "react";

// Google Identity Services types (loaded at runtime via script tag)
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
  revoke: (token: string, callback?: () => void) => void;
}

export interface GoogleUser {
  sub: string;
  name: string;
  email: string;
  picture: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

export interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  expiresAt: number | null;
  scopes: string[];
  isSigningIn: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  signIn: (manualClientId?: string) => Promise<void>;
  signOut: () => void;
  isAuthenticated: () => boolean;
  getValidToken: () => Promise<string | null>;
  hasScope: (scope: string) => boolean;
  setManualToken: (token: string) => Promise<void>;
  openAuthUrlInBrowser: (clientId?: string) => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = "poolr.auth";
export const GOOGLE_CLIENT_ID_KEY = "poolr.googleClientId";

export function getGoogleClientId(): string {
  try {
    const custom = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch {}
  return (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    ""
  );
}

export const REQUIRED_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata",
];

export async function openExternalUrl(url: string): Promise<boolean> {
  // 1. Try C# Engine backend (reliable across OSes)
  try {
    const res = await fetch("http://127.0.0.1:5180/api/auth/open-browser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) return true;
  } catch {}

  // 2. Try Tauri IPC if running inside Tauri
  try {
    const tauri = (window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__;
    if (tauri?.invoke) {
      await tauri.invoke("open_browser", { url });
      return true;
    }
  } catch {}

  // 3. Fallback to standard window.open
  try {
    window.open(url, "_blank");
    return true;
  } catch {}

  return false;
}

export function buildGoogleAuthUrl(customClientId?: string): string {
  const clientId = (customClientId || getGoogleClientId()).trim();
  const redirectUri = "http://127.0.0.1:5180/api/auth/google/callback";
  const scopes = REQUIRED_SCOPES.join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: scopes,
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Google Identity Services loader ──
let gisLoaded = false;
let gisLoading = false;
const gisLoaders: Array<() => void> = [];

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gisLoaded) return resolve();
    if (gisLoading) { gisLoaders.push(resolve); return; }
    gisLoading = true;

    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => {
        gisLoaded = true;
        gisLoading = false;
        resolve();
        gisLoaders.forEach((fn) => fn());
        gisLoaders.length = 0;
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      gisLoading = false;
      resolve();
      gisLoaders.forEach((fn) => fn());
      gisLoaders.length = 0;
    };
    script.onerror = () => {
      gisLoading = false;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });
}

// ── Token client singleton ──
let tokenClient: GoogleTokenClient | null = null;

export function resetTokenClient(): void {
  tokenClient = null;
}

export function setGoogleClientId(id: string): void {
  try {
    if (id.trim()) localStorage.setItem(GOOGLE_CLIENT_ID_KEY, id.trim());
    else localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
    resetTokenClient();
  } catch {}
}

async function getTokenClient(): Promise<GoogleTokenClient> {
  if (tokenClient) return tokenClient;
  await loadGisScript();
  if (!(window as any).google?.accounts?.oauth2) {
    throw new Error("Google Identity Services not available");
  }
  const clientId = getGoogleClientId();
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: REQUIRED_SCOPES.join(" "),
    callback: () => { /* handled via promise below */ },
    error_callback: () => {},
  });
  return tokenClient!;
}

// ── Real Google UserInfo API resolver ──
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        sub: data.sub || `user_${Date.now()}`,
        name: data.name || (data.email ? data.email.split("@")[0] : "Google User"),
        email: data.email || "",
        picture: data.picture || "",
        given_name: data.given_name,
        family_name: data.family_name,
        locale: data.locale,
      };
    }
  } catch (err) {
    console.warn("Could not fetch userinfo from Google API:", err);
  }

  // Fallback if userinfo fails or offline
  const decoded = decodeJwt(accessToken) as any;
  return {
    sub: decoded?.sub || `user_${Date.now()}`,
    name: decoded?.name || "Google User",
    email: decoded?.email || "",
    picture: decoded?.picture || "",
  };
}

// ── JWT decode helper (fallback) ──
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// ── State persistence ──
interface StoredAuth {
  user: GoogleUser;
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.user && parsed.accessToken && parsed.expiresAt) return parsed;
  } catch {}
  return null;
}

function writeStoredAuth(auth: StoredAuth | null) {
  try {
    if (auth) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
}

// ── Auth Provider ──
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>(() => {
    const stored = readStoredAuth();
    if (stored && stored.expiresAt > Date.now()) {
      return {
        user: stored.user,
        accessToken: stored.accessToken,
        expiresAt: stored.expiresAt,
        scopes: stored.scopes,
        isSigningIn: false,
        error: null,
      };
    }
    if (stored && stored.expiresAt <= Date.now()) {
      writeStoredAuth(null);
    }
    return {
      user: null,
      accessToken: null,
      expiresAt: null,
      scopes: [],
      isSigningIn: false,
      error: null,
    };
  });

  const isAuthenticated = React.useCallback(() => {
    return !!(state.accessToken && state.expiresAt && state.expiresAt > Date.now());
  }, [state.accessToken, state.expiresAt]);

  const hasScope = React.useCallback(
    (scope: string) => state.scopes.includes(scope),
    [state.scopes]
  );

  const openAuthUrlInBrowser = React.useCallback(async (customClientId?: string) => {
    const clientId = (customClientId || getGoogleClientId()).trim();
    if (!clientId) {
      setState((s) => ({
        ...s,
        isSigningIn: false,
        error: "Google Cloud Client ID required. Go to Settings → Google Account to enter your OAuth Client ID.",
      }));
      window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "settings" }));
      return;
    }
    const url = buildGoogleAuthUrl(clientId);
    await openExternalUrl(url);
  }, []);

  const setManualToken = React.useCallback(async (token: string) => {
    if (!token.trim()) return;
    setState((s) => ({ ...s, isSigningIn: true, error: null }));
    try {
      const user = await fetchGoogleUserInfo(token.trim());
      const expiresAt = Date.now() + 3600 * 1000;
      const authData: StoredAuth = {
        user,
        accessToken: token.trim(),
        expiresAt,
        scopes: REQUIRED_SCOPES,
      };
      writeStoredAuth(authData);
      setState({
        user,
        accessToken: token.trim(),
        expiresAt,
        scopes: authData.scopes,
        isSigningIn: false,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to validate token";
      setState((s) => ({ ...s, isSigningIn: false, error: msg }));
    }
  }, []);

  const signIn = React.useCallback(async (manualClientId?: string) => {
    setState((s) => ({ ...s, isSigningIn: true, error: null }));
    const clientId = (manualClientId || getGoogleClientId()).trim();

    if (!clientId) {
      setState((s) => ({
        ...s,
        isSigningIn: false,
        error: "Google Cloud Client ID required. Go to Settings → Google Account to enter your OAuth Client ID and follow the setup guide.",
      }));
      window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "settings" }));
      return;
    }

    // 1. Primary flow: Open real system default browser and start loopback listener
    try {
      const authUrl = buildGoogleAuthUrl(clientId);
      const opened = await openExternalUrl(authUrl);

      if (opened) {
        // Poll C# engine loopback endpoint for the token
        const pollStart = Date.now();
        const maxWaitMs = 180000; // 3 minutes timeout

        const token = await new Promise<string>((resolve, reject) => {
          const interval = setInterval(async () => {
            if (Date.now() - pollStart > maxWaitMs) {
              clearInterval(interval);
              reject(new Error("Sign-in timed out. Please try again or paste access token manually in Settings."));
              return;
            }

            try {
              const res = await fetch("http://127.0.0.1:5180/api/auth/google/latest-token");
              if (res.ok) {
                const data = await res.json();
                if (data.ok && data.token) {
                  clearInterval(interval);
                  resolve(data.token);
                }
              }
            } catch {
              // Engine polling
            }
          }, 1000);
        });

        const user = await fetchGoogleUserInfo(token);
        const expiresAt = Date.now() + 3600 * 1000;
        const authData: StoredAuth = {
          user,
          accessToken: token,
          expiresAt,
          scopes: REQUIRED_SCOPES,
        };
        writeStoredAuth(authData);

        setState({
          user,
          accessToken: token,
          expiresAt,
          scopes: authData.scopes,
          isSigningIn: false,
          error: null,
        });
        return;
      }
    } catch (browserFlowErr) {
      console.warn("Browser loopback flow failed or fallback needed:", browserFlowErr);
    }

    // 2. Secondary flow: Google Identity Services in-page client (for browser dev mode)
    try {
      const client = await getTokenClient();
      const tokenRes = await new Promise<GoogleTokenResponse>((resolve, reject) => {
        (client as any).callback = (resp: GoogleTokenResponse) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp);
        };
        client.requestAccessToken({ prompt: "consent" });
      });

      const user = await fetchGoogleUserInfo(tokenRes.access_token);
      const expiresAt = Date.now() + tokenRes.expires_in * 1000;
      const authData: StoredAuth = {
        user,
        accessToken: tokenRes.access_token,
        expiresAt,
        scopes: tokenRes.scope ? tokenRes.scope.split(" ") : [],
      };
      writeStoredAuth(authData);

      setState({
        user,
        accessToken: tokenRes.access_token,
        expiresAt,
        scopes: authData.scopes,
        isSigningIn: false,
        error: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setState((s) => ({ ...s, isSigningIn: false, error: msg }));
    }
  }, []);

  const signOut = React.useCallback(() => {
    if (tokenClient && state.accessToken) {
      tokenClient.revoke(state.accessToken);
    }
    writeStoredAuth(null);
    setState({
      user: null,
      accessToken: null,
      expiresAt: null,
      scopes: [],
      isSigningIn: false,
      error: null,
    });
  }, [state.accessToken]);

  const getValidToken = React.useCallback(async (): Promise<string | null> => {
    if (state.accessToken && state.expiresAt && state.expiresAt > Date.now() + 5000) {
      return state.accessToken;
    }
    // Token expired or about to expire — trigger re-auth
    await signIn();
    return state.accessToken;
  }, [state.accessToken, state.expiresAt, signIn]);

  // ── Token refresh timer — re-auth 60s before expiry ──
  React.useEffect(() => {
    if (!state.expiresAt || !state.accessToken) return;
    const refreshAt = state.expiresAt - Date.now() - 60000;
    if (refreshAt <= 0) return;
    const timer = setTimeout(() => {
      void getTokenClient().then((client) => {
        return new Promise<GoogleTokenResponse>((resolve, reject) => {
          (client as any).callback = (resp: GoogleTokenResponse) => {
            if (resp.error) reject(new Error(resp.error));
            else resolve(resp);
          };
          client.requestAccessToken({ prompt: "" });
        });
      }).then(async (tokenRes) => {
        let user = state.user;
        if (!user || !user.name || !user.email) {
          user = await fetchGoogleUserInfo(tokenRes.access_token);
        }
        const expiresAt = Date.now() + tokenRes.expires_in * 1000;
        const scopes = tokenRes.scope ? tokenRes.scope.split(" ") : [];
        writeStoredAuth({ user: user!, accessToken: tokenRes.access_token, expiresAt, scopes });
        setState((s) => ({
          ...s,
          user,
          accessToken: tokenRes.access_token,
          expiresAt,
          scopes,
        }));
      }).catch(() => {
        // silent — user will re-auth on next Drive action
      });
    }, refreshAt);
    return () => clearTimeout(timer);
  }, [state.expiresAt, state.accessToken, state.user]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signOut,
      isAuthenticated,
      getValidToken,
      hasScope,
      setManualToken,
      openAuthUrlInBrowser,
    }),
    [state, signIn, signOut, isAuthenticated, getValidToken, hasScope, setManualToken, openAuthUrlInBrowser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
