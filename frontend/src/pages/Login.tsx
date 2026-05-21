import { sendSignInLinkToEmail, signInWithEmailAndPassword } from "firebase/auth";
import { ArrowRight, KeyRound, Lock, Mail, MailCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { auth } from "../lib/firebase";

type Mode = "password" | "link";

export function Login() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(prettyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.origin + "/",
        handleCodeInApp: true,
      });
      window.localStorage.setItem("emailForSignIn", email);
      setLinkSent(true);
    } catch (err) {
      setError(prettyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (linkSent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One-time sign-in link sent">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-600">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-700">
            We sent a sign-in link to <strong className="text-slate-900">{email}</strong>.
            Open it on this device to continue.
          </p>
          <button
            type="button"
            onClick={() => {
              setLinkSent(false);
              setMode("password");
            }}
            className="mt-5 text-sm text-slate-500 hover:text-slate-700"
          >
            Use a different method
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your assistant"
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="font-medium text-slate-900 underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form
        onSubmit={mode === "password" ? onPasswordSubmit : onLinkSubmit}
        className="space-y-4"
      >
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          leftIcon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        {mode === "password" && (
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            leftIcon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          loading={busy}
          className="w-full"
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {mode === "password" ? "Sign in" : "Send sign-in link"}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-white px-2 text-slate-400">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          leftIcon={mode === "password" ? <KeyRound className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          onClick={() => {
            setMode(mode === "password" ? "link" : "password");
            setError(null);
          }}
        >
          {mode === "password" ? "Sign in with a magic link" : "Use email and password"}
        </Button>
      </form>
    </AuthLayout>
  );
}

function prettyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("auth/invalid-credential") || raw.includes("auth/wrong-password")) {
    return "Email or password is incorrect.";
  }
  if (raw.includes("auth/user-not-found")) {
    return "No account found for that email.";
  }
  if (raw.includes("auth/too-many-requests")) {
    return "Too many attempts. Try again in a moment.";
  }
  if (raw.includes("auth/invalid-email")) {
    return "That doesn't look like a valid email.";
  }
  return raw.replace(/^Firebase: /, "");
}
