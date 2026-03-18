import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api-client.js';
import { useAuthStore } from '../store/auth.js';
import Header from '../components/Layout/Header.js';
import type { Project, SysMLFile } from '@systemodel/shared-types';

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuItem { label: string; onClick: () => void; danger?: boolean }
interface ContextMenuState { x: number; y: number; items: ContextMenuItem[] }

function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999,
        background: '#2d2d30', border: '1px solid #555', borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: 140, padding: '4px 0',
      }}
    >
      {menu.items.map((item, i) => (
        <div
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          style={{
            padding: '6px 16px', fontSize: 12, cursor: 'pointer',
            color: item.danger ? '#f48771' : '#d4d4d4',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#094771'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<SysMLFile[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const refreshProjects = async () => {
    try {
      const list = await api.projects.list();
      setProjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    }
  };

  useEffect(() => {
    refreshProjects().finally(() => setLoading(false));
  }, []);

  const selectProject = async (project: Project) => {
    setSelectedProject(project);
    setFiles([]);
    try {
      const f = await api.files.list(project.id);
      setFiles(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files');
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      await api.projects.create(newProjectName.trim());
      await refreshProjects();
      setNewProjectName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const createFile = async () => {
    if (!selectedProject) return;
    const name = prompt('File name (e.g. vehicle.sysml):');
    if (!name) return;
    try {
      const content = `package ${name.replace('.sysml', '')} {\n  // SysML v2 model\n}\n`;
      const file = await api.files.create(selectedProject.id, name, content);
      setFiles((prev) => [...prev, file]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create file');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (fileList: FileList) => {
    if (!selectedProject) return;
    for (const file of Array.from(fileList)) {
      try {
        const content = await file.text();
        const name = file.name.endsWith('.sysml') ? file.name : `${file.name}.sysml`;
        const created = await api.files.create(selectedProject.id, name, content);
        setFiles((prev) => [...prev, created]);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to upload ${file.name}`);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!selectedProject) return;
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.sysml') || f.name.endsWith('.txt') || f.type === 'text/plain',
    );
    if (droppedFiles.length > 0) {
      const dt = new DataTransfer();
      droppedFiles.forEach((f) => dt.items.add(f));
      uploadFiles(dt.files);
    }
  };

  const [dragOver, setDragOver] = useState(false);

  const openFile = (file: SysMLFile) => {
    navigate(`/projects/${selectedProject!.id}/files/${file.id}`);
  };

  // ─── Project actions ─────────────────────────────────────────────────────

  const createSubproject = async (parent: Project) => {
    const name = prompt('Subproject name:');
    if (!name?.trim()) return;
    try {
      await api.projects.create(name.trim(), undefined, parent.id);
      await refreshProjects();
      // Auto-expand the parent
      setCollapsed((prev) => ({ ...prev, [parent.id]: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create subproject');
    }
  };

  const renameProject = async (project: Project) => {
    const newName = prompt('Rename project:', project.name);
    if (!newName || newName === project.name) return;
    try {
      const updated = await api.projects.rename(project.id, newName.trim());
      if (selectedProject?.id === project.id) setSelectedProject(updated);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename project');
    }
  };

  const deleteProject = async (project: Project) => {
    const hasChildren = project.children && project.children.length > 0;
    const msg = hasChildren
      ? `Delete project "${project.name}", its subproject(s), and all files?`
      : `Delete project "${project.name}" and all its files?`;
    if (!confirm(msg)) return;
    try {
      await api.projects.delete(project.id);
      await refreshProjects();
      if (selectedProject?.id === project.id) {
        setSelectedProject(null);
        setFiles([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete project');
    }
  };

  const downloadProject = (project: Project) => {
    const token = useAuthStore.getState().token;
    const url = api.projects.download(project.id);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${project.name}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to download project'));
  };

  const onProjectContextMenu = useCallback((e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    if (project.isSystem) {
      // System projects: download only
      setContextMenu({
        x: e.clientX, y: e.clientY,
        items: [{ label: 'Download', onClick: () => downloadProject(project) }],
      });
      return;
    }
    const items: ContextMenuItem[] = [
      { label: 'Rename', onClick: () => renameProject(project) },
    ];
    if (project.depth < 2) {
      items.push({ label: 'New Subproject', onClick: () => createSubproject(project) });
    }
    items.push(
      { label: 'Download', onClick: () => downloadProject(project) },
      { label: 'Delete', onClick: () => deleteProject(project), danger: true },
    );
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  // ─── File actions ────────────────────────────────────────────────────────

  const renameFile = async (file: SysMLFile) => {
    if (!selectedProject) return;
    const newName = prompt('Rename file:', file.name);
    if (!newName || newName === file.name) return;
    try {
      const updated = await api.files.rename(selectedProject.id, file.id, newName.trim());
      setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename file');
    }
  };

  const deleteFile = async (file: SysMLFile) => {
    if (!selectedProject) return;
    if (!confirm(`Delete file "${file.name}"?`)) return;
    try {
      await api.files.delete(selectedProject.id, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete file');
    }
  };

  const downloadFile = (file: SysMLFile) => {
    if (!selectedProject) return;
    const token = useAuthStore.getState().token;
    const url = api.files.download(selectedProject.id, file.id);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to download file'));
  };

  const onFileContextMenu = useCallback((e: React.MouseEvent, file: SysMLFile) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedProject?.isSystem) {
      // System project files: download only
      setContextMenu({
        x: e.clientX, y: e.clientY,
        items: [{ label: 'Download', onClick: () => downloadFile(file) }],
      });
      return;
    }
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Rename', onClick: () => renameFile(file) },
        { label: 'Download', onClick: () => downloadFile(file) },
        { label: 'Delete', onClick: () => deleteFile(file), danger: true },
      ],
    });
  }, [selectedProject]);

  // ─── Project Tree Item ───────────────────────────────────────────────────

  const ProjectTreeItem = ({ project, depth }: { project: Project; depth: number }) => {
    const hasChildren = project.children && project.children.length > 0;
    const isCollapsed = collapsed[project.id] ?? false;
    const isSelected = selectedProject?.id === project.id;

    return (
      <>
        <div
          onClick={() => selectProject(project)}
          onContextMenu={(e) => onProjectContextMenu(e, project)}
          style={{
            paddingLeft: 12 + depth * 16,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isSelected ? '#2d2d30' : 'transparent',
            color: isSelected ? '#d4d4d4' : '#888',
            borderLeft: isSelected ? '2px solid #569cd6' : '2px solid transparent',
          }}
          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#252526'; }}
          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
        >
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleCollapse(project.id); }}
              style={{ cursor: 'pointer', fontSize: 9, width: 14, textAlign: 'center', userSelect: 'none', color: '#888' }}
            >
              {isCollapsed ? '\u25B6' : '\u25BC'}
            </span>
          ) : (
            <span style={{ width: 14 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </span>
          {(project._count?.files ?? 0) > 0 && (
            <span style={{ color: '#555', fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
              {project._count!.files}
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && project.children!.map((child) => (
          <ProjectTreeItem key={child.id} project={child} depth={depth + 1} />
        ))}
      </>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <Header />
      {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}
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
                disabled={creating}
                style={{ flex: 1, background: '#2d2d30', border: '1px solid #3c3c3c', borderRadius: 4, padding: '6px 8px', color: '#d4d4d4', fontSize: 12, outline: 'none' }}
              />
              <button
                type="submit"
                disabled={creating || !newProjectName.trim()}
                style={{ background: creating ? '#3c3c3c' : '#0e639c', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: creating ? 'not-allowed' : 'pointer', fontSize: 12 }}
              >
                {creating ? '...' : '+'}
              </button>
            </form>
            {error && (
              <div style={{ marginTop: 8, color: '#f48771', fontSize: 11, wordBreak: 'break-word' }}>
                {error}
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 16, color: '#666', fontSize: 13 }}>Loading...</div>}
            {projects.map((p) => (
              <ProjectTreeItem key={p.id} project={p} depth={0} />
            ))}
          </div>
        </div>

        {/* Files panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedProject ? (
            <>
              <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d4d4d4', fontSize: 13, fontWeight: 600 }}>
                  {selectedProject.name}
                  {selectedProject.isSystem && <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>(Read Only)</span>}
                </span>
                {!selectedProject.isSystem && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".sysml,.txt"
                      multiple
                      onChange={handleFileInput}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: '#3c3c3c', color: '#ccc', border: '1px solid #555', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#4a4a4a'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#3c3c3c'; }}
                    >
                      Upload .sysml
                    </button>
                    <button onClick={createFile} style={{ background: '#0e639c', color: '#fff', border: 'none', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                      + New File
                    </button>
                  </div>
                )}
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  flex: 1, overflowY: 'auto', padding: 16,
                  display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start',
                  border: dragOver ? '2px dashed #569cd6' : '2px dashed transparent',
                  transition: 'border-color 0.15s',
                }}
              >
                {files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => openFile(file)}
                    onContextMenu={(e) => onFileContextMenu(e, file)}
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
                  <div style={{ color: '#666', fontSize: 13, textAlign: 'center', width: '100%', paddingTop: 40 }}>
                    No files yet. Create a new file or drag & drop .sysml files here.
                  </div>
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
