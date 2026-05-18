import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Shell from './components/layout/Shell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NewDocument from './pages/NewDocument.jsx';
import Editor from './pages/Editor.jsx';
import Preview from './pages/Preview.jsx';
import Settings from './pages/Settings.jsx';
import { useDocumentsStore } from './store/useDocumentsStore.js';
import { useSettingsStore } from './store/useSettingsStore.js';
import { useAiStore } from './store/useAiStore.js';

export default function App() {
  const hydrateDocuments = useDocumentsStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const refreshAiStatus = useAiStore((s) => s.refreshStatus);

  useEffect(() => {
    hydrateDocuments();
    hydrateSettings();
    refreshAiStatus();
  }, [hydrateDocuments, hydrateSettings, refreshAiStatus]);

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new" element={<NewDocument />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/preview/:id" element={<Preview />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
