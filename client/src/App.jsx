import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import AppShell from './components/AppShell.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PlaylistDetailPage from './pages/PlaylistDetailPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import PlanBuilderPage from './pages/PlanBuilderPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import CustomizePage from './pages/CustomizePage.jsx';

function useAuth() {
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    api
      .authStatus()
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  return authenticated;
}

function RequireAuth({ authenticated, children }) {
  if (authenticated === null) return <LoadingSpinner label="Carregando..." />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const authenticated = useAuth();

  return (
    <AppShell authenticated={authenticated}>
      <Routes>
        <Route path="/login" element={<LoginPage authenticated={authenticated} />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth authenticated={authenticated}>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/playlists/:id"
          element={
            <RequireAuth authenticated={authenticated}>
              <PlaylistDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/analysis"
          element={
            <RequireAuth authenticated={authenticated}>
              <AnalysisPage />
            </RequireAuth>
          }
        />
        <Route
          path="/plan"
          element={
            <RequireAuth authenticated={authenticated}>
              <PlanBuilderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth authenticated={authenticated}>
              <HistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/customize"
          element={
            <RequireAuth authenticated={authenticated}>
              <CustomizePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to={authenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </AppShell>
  );
}
