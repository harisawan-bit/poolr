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

interface AuthContextValue extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => void;
  isAuthenticated: () => boolean;
  getValidToken: () => Promise<string | null>;
  hasScope: (scope: string) => boolean;
}

export const AuthContext = React.createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = "poolr.auth";
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "poolr-app.apps.googleusercontent.com";

const REQUIRED_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata",
];

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

async function getTokenClient(): Promise<GoogleTokenClient> {
  if (tokenClient) return tokenClient;
  await loadGisScript();
  if (!(window as any).google?.accounts?.oauth2) {
    throw new Error("Google Identity Services not available");
  }
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: REQUIRED_SCOPES.join(" "),
    callback: () => { /* handled via promise below */ },
    error_callback: () => {},
  });
  return tokenClient!;
}

// ── JWT decode helper ──
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
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

  const signIn = React.useCallback(async () => {
    setState((s) => ({ ...s, isSigningIn: true, error: null }));
    try {
      const client = await getTokenClient();
      const tokenRes = await new Promise<GoogleTokenResponse>((resolve, reject) => {
                // Override callback temporarily
        (client as any).callback = (resp: GoogleTokenResponse) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp);
        };
        client.requestAccessToken({ prompt: "consent" });
      });

      const decoded = decodeJwt(tokenRes.access_token) as any;
      const user: GoogleUser = {
        sub: decoded?.sub || "",
        name: decoded?.name || "",
        email: decoded?.email || "",
        picture: decoded?.picture || "",
        given_name: decoded?.given_name,
        family_name: decoded?.family_name,
        locale: decoded?.locale,
      };

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
      }).then((tokenRes) => {
        const decoded = decodeJwt(tokenRes.access_token) as any;
        const user: GoogleUser = {
          sub: decoded?.sub || state.user?.sub || "",
          name: decoded?.name || state.user?.name || "",
          email: decoded?.email || state.user?.email || "",
          picture: decoded?.picture || state.user?.picture || "",
        };
        const expiresAt = Date.now() + tokenRes.expires_in * 1000;
        const scopes = tokenRes.scope ? tokenRes.scope.split(" ") : [];
        writeStoredAuth({ user, accessToken: tokenRes.access_token, expiresAt, scopes });
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
    }),
    [state, signIn, signOut, isAuthenticated, getValidToken, hasScope]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
