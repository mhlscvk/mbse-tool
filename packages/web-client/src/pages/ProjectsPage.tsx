import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api-client.js';
import { useAuthStore } from '../store/auth.js';
import { useTheme } from '../store/theme.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import Header from '../components/Layout/Header.js';
import type { Project, SysMLFile, Startup, ProjectType } from '@systemodel/shared-types';

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuItem { label: string; onClick: () => void; danger?: boolean }
interface ContextMenuState { x: number; y: number; items: ContextMenuItem[] }

function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTheme();
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
        background: t.bgSecondary, border: `1px solid ${t.btnBorder}`, borderRadius: 4,
        boxShadow: t.shadow, minWidth: 140, padding: '4px 0',
      }}
    >
      {menu.items.map((item, i) => (
        <div
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          style={{
            padding: '6px 16px', fontSize: 12, cursor: 'pointer',
            color: item.danger ? t.error : t.text,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.accentBg; }}
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
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const t = useTheme();
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<SysMLFile[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [projectFilter, setProjectFilter] = useState<'all' | 'SYSTEM' | 'STARTUP' | 'USER'>('all');
  const [userStartups, setUserStartups] = useState<Startup[]>([]);
  const [createTarget, setCreateTarget] = useState<'personal' | string>('personal'); // 'personal' or startupId

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
    api.startups.list().then(setUserStartups).catch(() => {});
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
      const projectType: ProjectType = createTarget === 'personal' ? 'USER' : 'STARTUP';
      const startupId = createTarget === 'personal' ? undefined : createTarget;
      await api.projects.create(newProjectName.trim(), undefined, undefined, projectType, startupId);
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
    if (project.isSystem && !isAdmin) {
      setContextMenu({
        x: e.clientX, y: e.clientY,
        items: [
          { label: 'Download', onClick: () => downloadProject(project) },
        ],
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
  }, [projects, selectedProject, isAdmin]);

  // ─── File actions ────────────────────────────────────────────────────────

  const collectProjects = useCallback((nodes: Project[], prefix = ''): { id: string; label: string }[] => {
    const result: { id: string; label: string }[] = [];
    for (const p of nodes) {
      const label = prefix ? `${prefix} / ${p.name}` : p.name;
      result.push({ id: p.id, label });
      if (p.children?.length) {
        result.push(...collectProjects(p.children, label));
      }
    }
    return result;
  }, []);

  const moveFile = async (file: SysMLFile) => {
    if (!selectedProject) return;
    const targets = collectProjects(projects).filter((tt) => tt.id !== selectedProject.id);
    if (targets.length === 0) { setError('No other projects to move to'); return; }
    const choice = prompt(
      'Move to project:\n' + targets.map((tt, i) => `  ${i + 1}. ${tt.label}`).join('\n') + '\n\nEnter number:',
    );
    if (!choice) return;
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= targets.length) { setError('Invalid selection'); return; }
    try {
      await api.files.move(selectedProject.id, file.id, targets[idx].id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move file');
    }
  };

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

  const copyFileToProject = async (file: SysMLFile) => {
    if (!selectedProject) return;
    // Only show user-owned (non-system) projects as targets
    const userProjects = collectProjects(projects.filter(p => !p.isSystem));
    if (userProjects.length === 0) { setError('Create a project first, then copy the file into it'); return; }
    const choice = prompt(
      'Copy to project:\n' + userProjects.map((tt, i) => `  ${i + 1}. ${tt.label}`).join('\n') + '\n\nEnter number:',
    );
    if (!choice) return;
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= userProjects.length) { setError('Invalid selection'); return; }
    try {
      // Read the file content, then create a copy in the target project
      const sourceFile = await api.files.get(selectedProject.id, file.id);
      await api.files.create(userProjects[idx].id, file.name, sourceFile.content);
      refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy file');
    }
  };

  const onFileContextMenu = useCallback((e: React.MouseEvent, file: SysMLFile) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedProject?.isSystem && !isAdmin) {
      setContextMenu({
        x: e.clientX, y: e.clientY,
        items: [
          { label: 'Copy to My Project', onClick: () => copyFileToProject(file) },
          { label: 'Download', onClick: () => downloadFile(file) },
        ],
      });
      return;
    }
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Rename', onClick: () => renameFile(file) },
        { label: 'Move to...', onClick: () => moveFile(file) },
        { label: 'Download', onClick: () => downloadFile(file) },
        { label: 'Delete', onClick: () => deleteFile(file), danger: true },
      ],
    });
  }, [selectedProject, isAdmin]);

  // ─── Project Tree Item ───────────────────────────────────────────────────

  const ProjectTreeItem = useCallback(({ project, depth }: { project: Project; depth: number }) => {
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
            background: isSelected ? t.bgSelected : 'transparent',
            color: isSelected ? t.text : t.textSecondary,
            borderLeft: isSelected ? `2px solid ${t.info}` : '2px solid transparent',
          }}
          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = t.bgTertiary; }}
          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
        >
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleCollapse(project.id); }}
              style={{ cursor: 'pointer', fontSize: 9, width: 14, textAlign: 'center', userSelect: 'none', color: t.textSecondary }}
            >
              {isCollapsed ? '\u25B6' : '\u25BC'}
            </span>
          ) : (
            <span style={{ width: 14 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </span>
          {project.projectType === 'STARTUP' && depth === 0 && (
            <span title="Enterprise — restricted access" style={{ fontSize: 9, background: t.warning, color: '#fff', borderRadius: 3, padding: '1px 4px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2 }}>&#128274; ENT</span>
          )}
          {(project._count?.files ?? 0) > 0 && (
            <span style={{ color: t.textDim, fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
              {project._count!.files}
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && project.children!.map((child) => (
          <ProjectTreeItem key={child.id} project={child} depth={depth + 1} />
        ))}
      </>
    );
  }, [collapsed, selectedProject, onProjectContextMenu, t]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <Header />
      {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
        {/* Projects panel */}
        <div style={{
          width: isMobile ? '100%' : 280,
          ...(isMobile && selectedProject ? { display: 'none' } : {}),
          borderRight: isMobile ? 'none' : `1px solid ${t.border}`,
          display: isMobile && selectedProject ? 'none' : 'flex',
          flexDirection: 'column',
          flex: isMobile ? 1 : undefined,
        }}>
          <div style={{ padding: '16px 16px 8px', borderBottom: `1px solid ${t.border}` }}>
            <div style={{ color: t.text, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Projects</div>
            <form onSubmit={createProject} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name"
                disabled={creating}
                style={{ flex: 1, minWidth: 100, background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 4, padding: '6px 8px', color: t.text, fontSize: 12, outline: 'none' }}
              />
              {userStartups.length > 0 && (
                <select
                  value={createTarget}
                  onChange={(e) => setCreateTarget(e.target.value)}
                  style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 4, padding: '4px 6px', color: t.text, fontSize: 11 }}
                >
                  <option value="personal">Personal</option>
                  {userStartups.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                disabled={creating || !newProjectName.trim()}
                style={{ background: creating ? t.btnDisabled : t.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: creating ? 'not-allowed' : 'pointer', fontSize: 12 }}
              >
                {creating ? '...' : '+'}
              </button>
            </form>
            {error && (
              <div style={{ marginTop: 8, color: t.error, fontSize: 11, wordBreak: 'break-word' }}>
                {error}
              </div>
            )}
          </div>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap' }}>
            {(['all', 'SYSTEM', 'STARTUP', 'USER'] as const).map(f => (
              <button
                key={f}
                onClick={() => setProjectFilter(f)}
                style={{
                  background: projectFilter === f ? t.accent : 'transparent',
                  color: projectFilter === f ? '#fff' : t.textSecondary,
                  border: `1px solid ${projectFilter === f ? t.accent : t.border}`,
                  borderRadius: 12, padding: '2px 10px', fontSize: 11, cursor: 'pointer',
                }}
              >
                {f === 'all' ? 'All' : f === 'SYSTEM' ? 'System' : f === 'STARTUP' ? 'Enterprise' : 'Personal'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 16, color: t.textMuted, fontSize: 13 }}>Loading...</div>}
            {(() => {
              const filtered = projectFilter === 'all'
                ? projects
                : projects.filter(p => p.projectType === projectFilter);
              if (projectFilter === 'all') {
                // Group by type
                const system = filtered.filter(p => p.projectType === 'SYSTEM');
                const enterprise = filtered.filter(p => p.projectType === 'STARTUP');
                const personal = filtered.filter(p => p.projectType === 'USER');
                return (
                  <>
                    {system.length > 0 && (
                      <>
                        <div style={{ padding: '6px 12px', fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, background: t.bgTertiary }}>System</div>
                        {system.map(p => <ProjectTreeItem key={p.id} project={p} depth={0} />)}
                      </>
                    )}
                    {enterprise.length > 0 && (
                      <>
                        <div style={{ padding: '6px 12px', fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, background: t.bgTertiary, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>&#128274;</span> Enterprise <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9 }}>(Restricted)</span>
                        </div>
                        {enterprise.map(p => <ProjectTreeItem key={p.id} project={p} depth={0} />)}
                      </>
                    )}
                    {personal.length > 0 && (
                      <>
                        <div style={{ padding: '6px 12px', fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, background: t.bgTertiary }}>Personal</div>
                        {personal.map(p => <ProjectTreeItem key={p.id} project={p} depth={0} />)}
                      </>
                    )}
                  </>
                );
              }
              return filtered.map(p => <ProjectTreeItem key={p.id} project={p} depth={0} />);
            })()}
          </div>
        </div>

        {/* Files panel */}
        <div style={{ flex: 1, display: isMobile && !selectedProject ? 'none' : 'flex', flexDirection: 'column' }}>
          {selectedProject ? (
            <>
              <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {isMobile && (
                    <button
                      onClick={() => { setSelectedProject(null); setFiles([]); }}
                      style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 4, color: t.textSecondary, cursor: 'pointer', fontSize: 12, padding: '3px 8px', flexShrink: 0 }}
                    >
                      &#8592; Back
                    </button>
                  )}
                  <span style={{ color: t.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedProject.name}
                  {selectedProject.projectType === 'SYSTEM' && !isAdmin && <span style={{ color: t.textSecondary, fontSize: 11, marginLeft: 8 }}>(Read Only)</span>}
                  {selectedProject.projectType === 'SYSTEM' && isAdmin && <span style={{ color: t.textSecondary, fontSize: 11, marginLeft: 8 }}>(System)</span>}
                  {selectedProject.projectType === 'STARTUP' && (
                    <span style={{ color: t.warning, fontSize: 11, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      &#128274; Enterprise &middot; Members only
                    </span>
                  )}
                </span>
                </div>
                {(!selectedProject.isSystem || isAdmin) && (
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
                      style={{ background: t.btnBg, color: t.text, border: `1px solid ${t.btnBorder}`, borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = t.btnBgHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = t.btnBg; }}
                    >
                      Upload .sysml
                    </button>
                    <button onClick={createFile} style={{ background: t.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
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
                  border: dragOver ? `2px dashed ${t.info}` : '2px dashed transparent',
                  transition: 'border-color 0.15s',
                }}
              >
                {[...files].sort((a, b) => a.name.localeCompare(b.name)).map((file) => (
                  <div
                    key={file.id}
                    onClick={() => openFile(file)}
                    onContextMenu={(e) => onFileContextMenu(e, file)}
                    style={{
                      background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: 6,
                      padding: '14px 18px', cursor: 'pointer', minWidth: 160,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.info)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
                  >
                    <div style={{ color: t.success, fontSize: 13, marginBottom: 4 }}>{file.name}</div>
                    <div style={{ color: t.textMuted, fontSize: 11 }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                ))}
                {files.length === 0 && (
                  <div style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', width: '100%', paddingTop: 40 }}>
                    No files yet. Create a new file or drag & drop .sysml files here.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textDim, fontSize: 14 }}>
              Select a project to view its files
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
