import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./contexts/AuthContext";
import { Chat } from "./pages/Chat";
import { CreateBusiness } from "./pages/CreateBusiness";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>
  );
}

export default function App() {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;

  if (!firebaseUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (profile?.needs_onboarding) {
    return (
      <Routes>
        <Route path="/onboarding" element={<CreateBusiness />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/chat" element={<Chat />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
