import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.js';
import { useI18nStore } from './store/i18n.js';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './i18n/index.js';
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

function useSyncUserLanguage() {
  const user = useAuthStore((s) => s.user);
  const setLanguage = useI18nStore((s) => s.setLanguage);
  const currentLanguage = useI18nStore((s) => s.language);
  useEffect(() => {
    const pref = user?.preferredLanguage;
    if (!pref) return;
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(pref)) return;
    if (pref !== currentLanguage) setLanguage(pref as SupportedLanguage);
  }, [user, currentLanguage, setLanguage]);
}

export default function App() {
  useSyncUserLanguage();
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
