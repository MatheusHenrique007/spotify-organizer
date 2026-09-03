import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, ApiError } from './lib/api.js';
import AppShell from './components/AppShell.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import ErrorState from './components/ErrorState.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PlaylistDetailPage from './pages/PlaylistDetailPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import PlanBuilderPage from './pages/PlanBuilderPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import CustomizePage from './pages/CustomizePage.jsx';

function useAuth() {
  const [authenticated, setAuthenticated] = useState(null);
  const [authCheckFailed, setAuthCheckFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAuthCheckFailed(false);
    api
      .authStatus()
      .then((data) => setAuthenticated(data.authenticated))
      .catch((error) => {
        // The backend answered but said no (or said something is wrong with the request) — that's
        // a real "not authenticated". Anything else (connection refused, DNS failure, timeout) means
        // we couldn't determine the session state at all, which is not the same as being logged out.
        if (error instanceof ApiError) {
          setAuthenticated(false);
        } else {
          setAuthCheckFailed(true);
        }
      });
  }, [attempt]);

  return { authenticated, authCheckFailed, retry: () => setAttempt((n) => n + 1) };
}

function RequireAuth({ authenticated, authCheckFailed, onRetry, children }) {
  if (authCheckFailed) {
    return (
      <ErrorState
        title="Não foi possível verificar sua sessão"
        error={new Error('O servidor não respondeu. Verifique se o backend está em execução.')}
        onRetry={onRetry}
      />
    );
  }
  if (authenticated === null) return <LoadingSpinner label="Carregando..." />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { authenticated, authCheckFailed, retry } = useAuth();

  return (
    <AppShell authenticated={authenticated}>
      <Routes>
        <Route path="/login" element={<LoginPage authenticated={authenticated} />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth authenticated={authenticated} authCheckFailed={authCheckFailed} onRetry={retry}>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/playlists/:id"
          element={
            <RequireAuth authenticated={authenticated} authCheckFailed={authCheckFailed} onRetry={retry}>
              <PlaylistDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/analysis"
          element={
            <RequireAuth authenticated={authenticated} authCheckFailed={authCheckFailed} onRetry={retry}>
              <AnalysisPage />
            </RequireAuth>
          }
        />
        <Route
          path="/plan"
          element={
            <RequireAuth authenticated={authenticated} authCheckFailed={authCheckFailed} onRetry={retry}>
              <PlanBuilderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth authenticated={authenticated} authCheckFailed={authCheckFailed} onRetry={retry}>
              <HistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/customize"
          element={
            <RequireAuth authenticated={authenticated} authCheckFailed={authCheckFailed} onRetry={retry}>
              <CustomizePage />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            authCheckFailed ? (
              <ErrorState
                title="Não foi possível verificar sua sessão"
                error={new Error('O servidor não respondeu. Verifique se o backend está em execução.')}
                onRetry={retry}
              />
            ) : (
              <Navigate to={authenticated ? '/dashboard' : '/login'} replace />
            )
          }
        />
      </Routes>
    </AppShell>
  );
}
