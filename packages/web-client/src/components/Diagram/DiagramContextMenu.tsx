import React from 'react';
import type { ElementLock } from '@systemodel/shared-types';
import { useTheme } from '../../store/theme.js';
import ContextMenuButton from './ContextMenuButton.js';

interface ContextMenuData {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'multi';
  id: string;
  label: string;
  nodeIds?: string[];
  edgeIds?: string[];
  range?: { start: { line: number; character: number }; end: { line: number; character: number } };
  edgeKind?: string;
  edgeSourceName?: string;
  edgeTargetName?: string;
}

interface DiagramContextMenuProps {
  menu: ContextMenuData;
  onClose: () => void;

  // Visibility actions
  onHideNode?: (id: string) => void;
  onHideEdge?: (id: string) => void;
  onHideNodes?: (ids: string[]) => void;
  onHideEdges?: (ids: string[]) => void;
  onShowOnly?: (id: string) => void;

  // Navigation
  onNodeSelect?: (range: NonNullable<ContextMenuData['range']>) => void;
  onEdgeSelect?: (range: NonNullable<ContextMenuData['range']>) => void;
  /** Called to navigate to a relation's code by kind + source/target names */
  onEdgeGoToCode?: (edgeKind: string, sourceName?: string, targetName?: string) => void;

  // Locks
  lockMap: Map<string, ElementLock>;
  currentUserId?: string;
  onCheckOut?: (elementName: string) => void;
  onCheckIn?: (elementName: string) => void;
  onRequestLock?: (elementName: string) => void;

  // Container descendants (for "Hide group")
  getDescendants: (id: string) => Set<string>;

  // Multi-selection cleanup
  clearMultiSelection?: () => void;
}

export default function DiagramContextMenu({
  menu, onClose,
  onHideNode, onHideEdge, onHideNodes, onHideEdges, onShowOnly,
  onNodeSelect, onEdgeSelect, onEdgeGoToCode,
  lockMap, currentUserId, onCheckOut, onCheckIn, onRequestLock,
  getDescendants, clearMultiSelection,
}: DiagramContextMenuProps) {
  const t = useTheme();

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        style={{
          position: 'fixed', left: menu.x, top: menu.y, zIndex: 100,
          background: t.bgTertiary, border: `1px solid ${t.btnBorder}`, borderRadius: 4,
          boxShadow: t.shadow, padding: '4px 0',
          minWidth: 160, fontSize: 12, color: t.text,
        }}
      >
        {menu.type === 'multi' ? (
          <>
            <div style={{ padding: '4px 12px', color: t.textSecondary, fontSize: 10, borderBottom: `1px solid ${t.border}`, marginBottom: 2 }}>
              {(menu.nodeIds?.length ?? 0) + (menu.edgeIds?.length ?? 0)} selected items
            </div>
            <ContextMenuButton
              icon="&#x2716;"
              label={`Hide ${(menu.nodeIds?.length ?? 0) + (menu.edgeIds?.length ?? 0)} selected items`}
              onClick={() => {
                const nIds = menu.nodeIds ?? [];
                const eIds = menu.edgeIds ?? [];
                onClose();
                if (nIds.length > 0 && onHideNodes) onHideNodes(nIds);
                if (eIds.length > 0 && onHideEdges) onHideEdges(eIds);
                clearMultiSelection?.();
              }}
            />
          </>
        ) : (
          <>
            <div style={{ padding: '4px 12px', color: t.textSecondary, fontSize: 10, borderBottom: `1px solid ${t.border}`, marginBottom: 2 }}>
              {menu.type === 'node' ? 'Element' : 'Relationship'}: {menu.label}
            </div>

            {/* Check In */}
            {menu.type === 'node' && onCheckIn && (() => {
              const lock = lockMap.get(menu.label);
              const isMine = lock?.lockedBy === currentUserId;
              return (
                <ContextMenuButton
                  icon="&#128274;"
                  label="Check In"
                  onClick={() => { onClose(); onCheckIn(menu.label); }}
                  disabled={!isMine}
                  color={isMine ? t.info : undefined}
                  title={isMine ? 'Check in this element' : 'Not checked out by you'}
                />
              );
            })()}

            {/* Check Out */}
            {menu.type === 'node' && onCheckOut && (() => {
              const lock = lockMap.get(menu.label);
              return (
                <ContextMenuButton
                  icon="&#128275;"
                  label="Check Out"
                  onClick={() => { onClose(); onCheckOut(menu.label); }}
                  disabled={!!lock}
                  title={lock ? (lock.lockedBy === currentUserId ? 'Already checked out by you' : `Locked by ${lock.user?.name ?? 'another user'}`) : 'Check out this element'}
                />
              );
            })()}

            {/* Go to code */}
            {menu.type === 'node' && menu.range && onNodeSelect && (
              <ContextMenuButton
                icon="&lt;/&gt;"
                label="Go to code"
                onClick={() => { onClose(); onNodeSelect(menu.range!); }}
              />
            )}
            {menu.type === 'edge' && (menu.range ? onEdgeSelect : onEdgeGoToCode) && (
              <ContextMenuButton
                icon="&lt;/&gt;"
                label="Go to code"
                onClick={() => {
                  onClose();
                  if (menu.range && onEdgeSelect) {
                    onEdgeSelect(menu.range);
                  } else if (onEdgeGoToCode && menu.edgeKind) {
                    onEdgeGoToCode(menu.edgeKind, menu.edgeSourceName, menu.edgeTargetName);
                  }
                }}
              />
            )}

            {/* Hide element */}
            <ContextMenuButton
              icon="&#x2716;"
              label={`Hide ${menu.type === 'node' ? 'element' : 'relationship'}`}
              onClick={() => {
                onClose();
                if (menu.type === 'node' && onHideNode) onHideNode(menu.id);
                if (menu.type === 'edge' && onHideEdge) onHideEdge(menu.id);
              }}
            />

            {/* Hide group */}
            {menu.type === 'node' && (() => {
              const descendants = getDescendants(menu.id);
              if (descendants.size === 0) return null;
              return (
                <ContextMenuButton
                  icon="&#x2716;"
                  label={`Hide group (${descendants.size + 1} elements)`}
                  onClick={() => {
                    onClose();
                    if (onHideNodes) onHideNodes([menu.id, ...descendants]);
                  }}
                />
              );
            })()}

            {/* Request Unlock */}
            {menu.type === 'node' && (() => {
              const lock = lockMap.get(menu.label);
              if (!lock || lock.lockedBy === currentUserId) return null;
              return (
                <>
                  <div style={{ padding: '4px 12px', color: t.warning, fontSize: 10 }}>
                    Locked by {lock.user?.name ?? 'another user'}
                  </div>
                  {onRequestLock && (
                    <ContextMenuButton
                      icon="&#128276;"
                      label="Request Unlock"
                      color={t.warning}
                      onClick={() => { onClose(); onRequestLock(menu.label); }}
                    />
                  )}
                </>
              );
            })()}

            {/* Show only this */}
            {menu.type === 'node' && onShowOnly && (
              <ContextMenuButton
                icon="&#x1F441;"
                label="Show only this"
                onClick={() => { onClose(); onShowOnly(menu.id); }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

export type { ContextMenuData };
