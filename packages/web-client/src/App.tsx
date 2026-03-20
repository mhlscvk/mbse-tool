import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.js';
import { useThemeStore } from './store/theme.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import BugReportButton from './components/BugReportButton.js';
import LoginPage from './pages/LoginPage.js';
import ProjectsPage from './pages/ProjectsPage.js';
import EditorPage from './pages/EditorPage.js';
import TrainingPage from './pages/TrainingPage.js';
import SettingsPage from './pages/SettingsPage.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function AuthenticatedBugButton() {
  const token = useAuthStore((s) => s.token);
  return token ? <BugReportButton /> : null;
}

export default function App() {
  const themeMode = useThemeStore((s) => s.mode);
  useEffect(() => {
    document.body.classList.toggle('theme-light', themeMode === 'light');
  }, [themeMode]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/files/:fileId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
        <AuthenticatedBugButton />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
