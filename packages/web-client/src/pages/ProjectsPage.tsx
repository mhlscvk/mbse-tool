import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api-client.js';
import Header from '../components/Layout/Header.js';
import type { Project, SysMLFile } from '@systemodel/shared-types';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<SysMLFile[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.projects.list().then(setProjects).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const selectProject = async (project: Project) => {
    setSelectedProject(project);
    const f = await api.files.list(project.id);
    setFiles(f);
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const project = await api.projects.create(newProjectName.trim());
    setProjects((prev) => [project, ...prev]);
    setNewProjectName('');
  };

  const createFile = async () => {
    if (!selectedProject) return;
    const name = prompt('File name (e.g. vehicle.sysml):');
    if (!name) return;
    const content = `package ${name.replace('.sysml', '')} {\n  // SysML v2 model\n}\n`;
    const file = await api.files.create(selectedProject.id, name, content);
    setFiles((prev) => [...prev, file]);
  };

  const openFile = (file: SysMLFile) => {
    navigate(`/projects/${selectedProject!.id}/files/${file.id}`);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Projects panel */}
        <div style={{ width: 280, borderRight: '1px solid #3c3c3c', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #3c3c3c' }}>
            <div style={{ color: '#d4d4d4', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Projects</div>
            <form onSubmit={createProject} style={{ display: 'flex', gap: 8 }}>
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name"
                style={{ flex: 1, background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 4, padding: '6px 8px', color: '#d4d4d4', fontSize: 12, outline: 'none' }}
              />
              <button type="submit" style={{ background: '#0e639c', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>+</button>
            </form>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 16, color: '#666', fontSize: 13 }}>Loading...</div>}
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => selectProject(p)}
                style={{
                  padding: '10px 16px', cursor: 'pointer', fontSize: 13,
                  background: selectedProject?.id === p.id ? '#2d2d30' : 'transparent',
                  color: selectedProject?.id === p.id ? '#d4d4d4' : '#888',
                  borderLeft: selectedProject?.id === p.id ? '2px solid #569cd6' : '2px solid transparent',
                }}
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* Files panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedProject ? (
            <>
              <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d4d4d4', fontSize: 13, fontWeight: 600 }}>{selectedProject.name}</span>
                <button onClick={createFile} style={{ background: '#0e639c', color: '#fff', border: 'none', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                  + New File
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start' }}>
                {files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => openFile(file)}
                    style={{
                      background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 6,
                      padding: '14px 18px', cursor: 'pointer', minWidth: 160,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#569cd6')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3c3c3c')}
                  >
                    <div style={{ color: '#4ec9b0', fontSize: 13, marginBottom: 4 }}>{file.name}</div>
                    <div style={{ color: '#666', fontSize: 11 }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                ))}
                {files.length === 0 && (
                  <div style={{ color: '#666', fontSize: 13 }}>No files yet. Create one to start modeling.</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14 }}>
              Select a project to view its files
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
