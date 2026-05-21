import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  signInWithEmailLink,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { auth } from "../lib/firebase";
import { fetchMe, type MeResponse } from "../lib/api";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: MeResponse | null;
  loading: boolean;
  refreshProfile: (forceTokenRefresh?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (forceTokenRefresh = false) => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }
    try {
      const me = await fetchMe(forceTokenRefresh);
      setProfile(me);
    } catch (err) {
      console.error("Failed to fetch profile", err);
      setProfile(null);
    }
  }, []);

  // If the user arrived via a magic link (sent by sendSignInLinkToEmail), the
  // URL contains the sign-in tokens. Complete the sign-in before the normal
  // auth listener fires — onAuthStateChanged will then pick up the new user.
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    let email = window.localStorage.getItem("emailForSignIn");
    if (!email) {
      email = window.prompt("Confirm the email this link was sent to") || "";
    }
    if (!email) return;
    signInWithEmailLink(auth, email, window.location.href)
      .then(() => {
        window.localStorage.removeItem("emailForSignIn");
        // Strip the sign-in tokens from the address bar so reload doesn't re-run this.
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch((err) => {
        console.error("Email link sign-in failed", err);
      });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
