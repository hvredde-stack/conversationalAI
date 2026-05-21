import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./contexts/AuthContext";
import { Chat } from "./pages/Chat";
import { CreateBusiness } from "./pages/CreateBusiness";
import { Knowledge } from "./pages/Knowledge";
import { Login } from "./pages/Login";
import { Platform } from "./pages/Platform";
import { Settings } from "./pages/Settings";
import { Signup } from "./pages/Signup";
import { Team } from "./pages/Team";

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center text-navy-400">Loading…</div>
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
      <Route path="/admin" element={<Navigate to="/admin/knowledge" replace />} />
      <Route path="/admin/knowledge" element={<Knowledge />} />
      <Route path="/admin/team" element={<Team />} />
      <Route path="/admin/settings" element={<Settings />} />
      <Route path="/knowledge" element={<Navigate to="/admin/knowledge" replace />} />
      <Route path="/platform" element={<Platform />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
