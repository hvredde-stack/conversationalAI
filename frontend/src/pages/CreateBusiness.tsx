import { useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { createBusiness } from "../lib/api";

export function CreateBusiness() {
  const { refreshProfile, signOut } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createBusiness(name.trim());
      // Backend set custom claims; force a token refresh so the next /me sees them.
      await refreshProfile(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm"
      >
        <h1 className="text-2xl font-semibold">Create your business</h1>
        <p className="text-sm text-slate-600">
          You'll become the owner. You can invite employees from settings later.
        </p>

        <label className="block text-sm">
          <span className="text-slate-700">Business name</span>
          <input
            type="text"
            required
            minLength={1}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Apparel"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create business"}
        </button>

        <button
          type="button"
          onClick={signOut}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
