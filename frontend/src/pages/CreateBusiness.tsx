import { Building2, ArrowRight, LogOut, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import { createBusiness } from "../lib/api";

export function CreateBusiness() {
  const { refreshProfile, signOut, firebaseUser } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createBusiness(name.trim());
      await refreshProfile(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-full bg-slate-50">
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 sm:p-6">
        <Logo />
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </header>

      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-navy-800 shadow-card ring-2 ring-gold-400/40">
              <Building2 className="h-7 w-7 text-gold-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
              Set up your business
            </h1>
            <p className="mt-2 text-sm text-navy-500">
              You'll become the owner. Aria will refer to your business by this name when greeting your team and customers.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl bg-white shadow-card border border-navy-100 p-6 space-y-5"
          >
            <Input
              label="Business name"
              name="business_name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Apparel"
              hint="Aria will say this when introducing herself."
            />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              loading={busy}
              disabled={!name.trim()}
              className="w-full"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Create business
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-navy-500 justify-center">
            <Sparkles className="h-3.5 w-3.5 text-gold-500" />
            Signed in as <span className="text-navy-700 font-medium">{firebaseUser?.email}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
