import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import AgentConsole from "./pages/AgentConsole";
import Signals from "./pages/Signals";
import Token from "./pages/Token";
import { AppShell } from "./components/AppShell";

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const protectedPage = (page: ReactNode) =>
    isLoading ? <div className="p-8 text-sm text-ink-mid">Checking your session…</div> : isAuthenticated ? page : <Navigate to="/" replace />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          element={<AppShell />}
        >
          <Route
            path="/dashboard"
            element={protectedPage(<Dashboard />)}
          />
          <Route
            path="/agent"
            element={protectedPage(<AgentConsole />)}
          />
          <Route
            path="/signals"
            element={protectedPage(<Signals />)}
          />
          <Route
            path="/token/:mint?"
            element={protectedPage(<Token />)}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
