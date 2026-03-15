import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api-client.js';
import { diagramClient } from '../services/diagram-client.js';
import MonacoEditor from '../components/Editor/MonacoEditor.js';
import DiagramViewer from '../components/Diagram/DiagramViewer.js';
import Header from '../components/Layout/Header.js';
import type { SysMLFile, SModelRoot } from '@systemodel/shared-types';

const AUTOSAVE_DEBOUNCE_MS = 1500;

export default function EditorPage() {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const [file, setFile] = useState<SysMLFile | null>(null);
  const [content, setContent] = useState('');
  const [diagram, setDiagram] = useState<SModelRoot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    diagramClient.connect();
    const unsub = diagramClient.onModel(setDiagram);
    const unsubErr = diagramClient.onError((msg) => console.error('[Diagram]', msg));
    return () => { unsub(); unsubErr(); diagramClient.disconnect(); };
  }, []);

  useEffect(() => {
    if (!projectId || !fileId) return;
    api.files.get(projectId, fileId)
      .then((f) => { setFile(f); setContent(f.content); })
      .catch((e) => setError(e.message));
  }, [projectId, fileId]);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    // Naive AST: send raw content as placeholder model for diagram service
    // In a real implementation, this would use the LSP-parsed AST
    diagramClient.sendModel({
      uri: `file://${fileId}`,
      nodes: [],
      connections: [],
    });

    // Debounced autosave
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!projectId || !fileId) return;
      setSaving(true);
      try {
        await api.files.update(projectId, fileId, value);
      } catch (e) {
        console.error('Autosave failed:', e);
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [projectId, fileId]);

  const handleSave = async () => {
    if (!projectId || !fileId) return;
    clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      await api.files.update(projectId, fileId, content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div style={{ padding: 32, color: '#f48771' }}>{error}</div>;
  if (!file) return <div style={{ padding: 32, color: '#666' }}>Loading...</div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <Header title={file.name} showSave onSave={handleSave} saving={saving} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, borderRight: '1px solid #3c3c3c' }}>
          <MonacoEditor value={content} onChange={handleChange} />
        </div>
        <div style={{ flex: 1 }}>
          <DiagramViewer model={diagram} />
        </div>
      </div>
      <div style={{
        height: 24, background: '#007acc', display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 16, fontSize: 12, color: '#fff', flexShrink: 0,
      }}>
        <span>SysML v2</span>
        <span>|</span>
        <span>{saving ? 'Saving...' : 'Saved'}</span>
        <span style={{ flex: 1 }} />
        <span>{content.split('\n').length} lines</span>
      </div>
    </div>
  );
}
