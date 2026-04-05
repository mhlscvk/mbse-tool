import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { parseSysmlElementRanges } from '../../utils/sysml-helpers.js';
import type { DiffHunk } from '../../utils/line-diff.js';

// ─── Register SysML v2 language ────────────────────────────────────────────

monaco.languages.register({
  id: 'sysml',
  extensions: ['.sysml'],
  aliases: ['SysML v2', 'sysml'],
  mimetypes: ['text/x-sysml'],
});

monaco.languages.setMonarchTokensProvider('sysml', {
  keywords: [
    'package', 'part', 'attribute', 'connect', 'flow', 'action', 'state',
    'port', 'def', 'use', 'import', 'public', 'private', 'protected',
    'abstract', 'ref', 'in', 'out', 'inout', 'return', 'if', 'else',
    'loop', 'do', 'then', 'first', 'transition', 'specializes', 'redefines', 'about', 'comment',
    'doc', 'language', 'metadata', 'item', 'connection', 'interface',
    'allocation', 'satisfy', 'verify', 'concern', 'stakeholder', 'view',
    'viewpoint', 'render', 'subject', 'expose', 'accept', 'entry', 'exit',
    'parallel', 'concurrent', 'exhibit', 'perform', 'require', 'subsets',
  ],
  typeKeywords: ['Boolean', 'Integer', 'Real', 'String', 'Anything', 'Natural', 'Float', 'Rational', 'Complex'],
  stdlib: ['ScalarValues', 'ISQ', 'ISQBase', 'SI', 'Quantities'],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/"[^"]*"/, 'string'],
      [/'[^']*'/, 'string'],
      [/\b\d+(\.\d+)?\b/, 'number'],
      [/[A-Z][a-zA-Z0-9_]*/, {
        cases: { '@stdlib': 'keyword.stdlib', '@typeKeywords': 'type.identifier', '@default': 'type.identifier' },
      }],
      [/[a-zA-Z_][a-zA-Z0-9_]*/, {
        cases: { '@keywords': 'keyword', '@default': 'identifier' },
      }],
      [/[{}()[\]]/, 'delimiter.bracket'],
      [/[;,.]/, 'delimiter'],
      [/:/, 'delimiter'],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
  },
});

monaco.languages.setLanguageConfiguration('sysml', {
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  indentationRules: {
    increaseIndentPattern: /^\s*.*\{[^}]*$/,
    decreaseIndentPattern: /^\s*\}/,
  },
});

monaco.editor.defineTheme('systemodel-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
    { token: 'keyword.stdlib', foreground: '795e26', fontStyle: 'bold' },
    { token: 'type.identifier', foreground: '267f99' },
    { token: 'comment', foreground: '008000', fontStyle: 'italic' },
    { token: 'string', foreground: 'a31515' },
    { token: 'number', foreground: '098658' },
    { token: 'delimiter', foreground: '000000' },
    { token: 'delimiter.bracket', foreground: '0431fa' },
    { token: 'identifier', foreground: '001080' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#000000',
    'editorLineNumber.foreground': '#237893',
    'editorLineNumber.activeForeground': '#0b216f',
    'editorCursor.foreground': '#000000',
    'editor.lineHighlightBackground': '#f5f5f5',
    'editor.lineHighlightBorder': '#e0e0e0',
    'editorIndentGuide.background1': '#d3d3d3',
    'editor.selectionBackground': '#add6ff',
    'editor.selectionHighlightBackground': '#add6ff80',
    'editor.wordHighlightBackground': '#57a7d430',
    'editor.wordHighlightStrongBackground': '#0060c040',
    'editorBracketMatch.background': '#bad0f850',
    'editorBracketMatch.border': '#b9b9b9',
    'editorGutter.background': '#f8f8f8',
    'scrollbarSlider.background': '#c0c0c080',
    'scrollbarSlider.hoverBackground': '#a0a0a0a0',
    'minimap.background': '#f8f8f8',
  },
});


// ─── Cursor fix styles (injected at module load, before any editor exists) ──
// This ensures the CSS rule is in the document BEFORE monaco.editor.create()
// renders the first cursor element, eliminating the white-cursor flash.

(() => {
  if (document.getElementById('cursor-fix-styles')) return;
  const style = document.createElement('style');
  style.id = 'cursor-fix-styles';
  style.textContent = `
    .monaco-editor .cursors-layer .cursor,
    .monaco-editor .cursors-layer .cursor.cursor-primary,
    .monaco-editor .cursors-layer .cursor.cursor-secondary {
      background: #000 !important;
      border-color: #000 !important;
    }
  `;
  document.head.appendChild(style);
})();

// ─── AI change decoration styles (injected once) ──────────────────────────

(() => {
  if (document.getElementById('ai-change-styles')) return;
  const style = document.createElement('style');
  style.id = 'ai-change-styles';
  style.textContent = `
    .ai-change-added-line {
      background: rgba(40, 167, 69, 0.18) !important;
      border-left: 3px solid #28a745 !important;
    }
    .ai-change-modified-line {
      background: rgba(255, 152, 0, 0.18) !important;
      border-left: 3px solid #ff9800 !important;
    }
    .ai-change-gutter-added {
      background: #28a745 !important;
      width: 4px !important;
      margin-left: 2px;
      border-radius: 1px;
    }
    .ai-change-gutter-modified {
      background: #ff9800 !important;
      width: 4px !important;
      margin-left: 2px;
      border-radius: 1px;
    }
  `;
  document.head.appendChild(style);
})();

// ─── Component ─────────────────────────────────────────────────────────────

export interface EditorMarkerFix {
  title: string;
  newText: string;
}

export interface EditorMarker {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fixes?: EditorMarkerFix[];
}

export interface MonacoEditorHandle {
  revealRange(startLine: number, startCol: number, endLine: number, endCol: number): void;
  applyFix(startLine: number, startCol: number, endLine: number, endCol: number, newText: string): void;
  /** Replace full content using executeEdits (preserves undo stack) */
  setContentWithUndo(newContent: string): void;
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  markers?: EditorMarker[];
  readOnly?: boolean;
  /** Called when user attempts to type in a read-only editor */
  onReadOnlyEdit?: () => void;
  /** Called to check out the element name under the cursor */
  onCheckOut?: (elementName: string) => void;
  /** Called to check in the element name under the cursor */
  onCheckIn?: (elementName: string) => void;
  /** Set of element names currently checked out by the current user */
  myLockedElements?: Set<string>;
  /** Called to show only this element in the diagram */
  onShowOnly?: (elementName: string) => void;
  /** AI change hunks to highlight */
  aiChangeHunks?: DiffHunk[];
  /** Called when user accepts a single hunk or all hunks */
  onAcceptAiChange?: (hunkId: string | 'all') => void;
  /** Called when user reverts a single hunk or all hunks */
  onRevertAiChange?: (hunkId: string | 'all') => void;
}

const SEVERITY_MAP = {
  error:   monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info:    monaco.MarkerSeverity.Info,
};

const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(function MonacoEditor(
  { value, onChange, markers = [], readOnly = false, onReadOnlyEdit, onCheckOut, onCheckIn, myLockedElements, onShowOnly, aiChangeHunks, onAcceptAiChange, onRevertAiChange }: MonacoEditorProps,
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);
  // Stable ref so the code-action provider can always see the latest markers
  const markersRef = useRef<EditorMarker[]>([]);
  // Refs for lock-related callbacks (used inside editor creation effect)
  const myLockedRef = useRef(myLockedElements);
  myLockedRef.current = myLockedElements;
  const onReadOnlyEditRef = useRef(onReadOnlyEdit);
  onReadOnlyEditRef.current = onReadOnlyEdit;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    revealRange(startLine: number, startCol: number, endLine: number, endCol: number) {
      const editor = editorRef.current;
      if (!editor) return;
      const range = new monaco.Range(startLine, startCol, endLine, endCol);
      editor.setSelection(range);
      editor.revealRangeInCenter(range);
      editor.focus();
    },
    applyFix(startLine: number, startCol: number, endLine: number, endCol: number, newText: string) {
      const editor = editorRef.current;
      if (!editor) return;
      const range = new monaco.Range(startLine, startCol, endLine, endCol);
      editor.executeEdits('quick-fix', [{ range, text: newText }]);
      editor.focus();
    },
    setContentWithUndo(newContent: string) {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;
      const fullRange = model.getFullModelRange();
      editor.executeEdits('ai-edit', [{ range: fullRange, text: newContent }]);
      valueRef.current = newContent;
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value,
      language: 'sysml',
      theme: 'systemodel-light',
      readOnly,
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      cursorStyle: 'line',
      cursorWidth: 2,
      cursorBlinking: 'blink',
      smoothScrolling: true,
      folding: true,
    });

    editorRef.current = editor;

    // ── Force cursor black (immediately, before setTheme) ───────────────
    // Apply inline styles to cursor elements RIGHT AFTER create() — before
    // the browser paints the next frame.  This eliminates the brief white
    // cursor flash that occurs when Monaco's theme CSS hasn't loaded yet.
    const editorDom = editor.getDomNode();
    const forceCursorBlack = (el: HTMLElement) => {
      el.style.setProperty('background', '#000', 'important');
      el.style.setProperty('border-color', '#000', 'important');
    };
    // Immediate pass — fix any cursors that already exist
    editorDom?.querySelectorAll<HTMLElement>('.cursors-layer .cursor').forEach(forceCursorBlack);

    monaco.editor.setTheme('systemodel-light');

    // MutationObserver keeps cursors black on every subsequent re-render
    const cursorObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement && n.classList.contains('cursor')) {
              forceCursorBlack(n);
            }
          });
        }
        if (m.type === 'attributes' && m.target instanceof HTMLElement && m.target.classList.contains('cursor')) {
          forceCursorBlack(m.target);
        }
      }
    });
    const layer = editorDom?.querySelector('.cursors-layer');
    if (layer) {
      layer.querySelectorAll<HTMLElement>('.cursor').forEach(forceCursorBlack);
      cursorObserver.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    }

    // Track whether we're reverting an unauthorized edit (to avoid infinite loop)
    let isReverting = false;

    editor.onDidChangeModelContent((e) => {
      if (isReverting) return;

      // If we have locked elements, check if the edit is within an allowed range
      const locked = myLockedRef.current;
      if (locked && locked.size > 0) {
        const model = editor.getModel();
        if (model) {
          const elementRanges = parseSysmlElementRanges(model.getValue());
          // Build allowed line ranges from checked-out elements
          const allowedRanges: Array<{ startLine: number; endLine: number }> = [];
          for (const name of locked) {
            const range = elementRanges.get(name);
            if (range) allowedRanges.push(range);
          }

          if (allowedRanges.length > 0) {
            // Check if ALL changes fall within allowed ranges
            const unauthorized = e.changes.some(change => {
              const changeLine = change.range.startLineNumber;
              return !allowedRanges.some(r => changeLine >= r.startLine && changeLine <= r.endLine);
            });

            if (unauthorized) {
              // Undo the unauthorized edit
              isReverting = true;
              editor.trigger('sysml', 'undo', null);
              isReverting = false;
              if (onReadOnlyEditRef.current) onReadOnlyEditRef.current();
              return;
            }
          }
        }
      }

      const newValue = editor.getValue();
      valueRef.current = newValue;
      onChangeRef.current(newValue);
    });

    // Helper: find the SysML element name at the cursor position
    // Looks for patterns like "part def Vehicle", "part engine", "action def Drive", etc.
    function getElementNameAtCursor(): string | null {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (!position || !model) return null;

      // Search from the cursor line upward for the nearest element definition/usage
      const defPattern = /\b(?:part|attribute|port|action|state|item|connection|interface|use\s*case|analysis\s*case|verification\s*case|allocation|requirement|concern|stakeholder|view|viewpoint|package)\s+(?:def\s+)?(\w+)/;
      for (let line = position.lineNumber; line >= 1; line--) {
        const text = model.getLineContent(line);
        const match = text.match(defPattern);
        if (match) return match[1];
      }
      return null;
    }

    (editor as unknown as { _getElementNameAtCursor: () => string | null })._getElementNameAtCursor = getElementNameAtCursor;

    return () => {
      cursorObserver.disconnect();
      editor.dispose();
      editorRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers + keep ref current for the code action provider
  useEffect(() => {
    markersRef.current = markers;
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, 'sysml-diagnostics', markers.map((m) => ({
      severity: SEVERITY_MAP[m.severity],
      message: m.message,
      startLineNumber: m.line,
      startColumn: m.column,
      endLineNumber: m.endLine ?? m.line,
      endColumn: m.endColumn ?? m.column + 1,
    })));
  }, [markers]);

  // Register CodeActionProvider once (lightbulb / Ctrl+. quick fixes)
  useEffect(() => {
    const disposable = monaco.languages.registerCodeActionProvider('sysml', {
      provideCodeActions(model, range) {
        const actions: monaco.languages.CodeAction[] = [];
        for (const marker of markersRef.current) {
          if (!(marker.fixes?.length)) continue;
          const mRange = new monaco.Range(
            marker.line, marker.column,
            marker.endLine ?? marker.line, marker.endColumn ?? marker.column + 1,
          );
          if (!mRange.intersectRanges(range)) continue;
          for (const fix of marker.fixes) {
            actions.push({
              title: fix.title,
              kind: 'quickfix',
              isPreferred: actions.length === 0, // first suggestion is preferred
              edit: {
                edits: [{
                  resource: model.uri,
                  textEdit: { range: mRange, text: fix.newText },
                  versionId: model.getVersionId(),
                }],
              },
            });
          }
        }
        return { actions, dispose: () => {} };
      },
    });
    return () => disposable.dispose();
  }, []);


  // Register context menu actions — recreate when lock state changes to update labels
  const onCheckOutRef = useRef(onCheckOut);
  const onCheckInRef = useRef(onCheckIn);
  const onShowOnlyRef = useRef(onShowOnly);
  onCheckOutRef.current = onCheckOut;
  onCheckInRef.current = onCheckIn;
  onShowOnlyRef.current = onShowOnly;

  const onAcceptAiChangeRef = useRef(onAcceptAiChange);
  const onRevertAiChangeRef = useRef(onRevertAiChange);
  const aiChangeHunksRef = useRef(aiChangeHunks);
  onAcceptAiChangeRef.current = onAcceptAiChange;
  onRevertAiChangeRef.current = onRevertAiChange;
  aiChangeHunksRef.current = aiChangeHunks;

  // Track which element is under cursor for dynamic labels
  const [cursorElementName, setCursorElementName] = useState<string | null>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const disposable = editor.onDidChangeCursorPosition(() => {
      const getElementName = (editor as unknown as { _getElementNameAtCursor: () => string | null })._getElementNameAtCursor;
      setCursorElementName(getElementName());
    });
    return () => disposable.dispose();
  }, []);

  // Determine lock status of current cursor element
  const cursorElementLocked = cursorElementName && myLockedElements ? myLockedElements.has(cursorElementName) : false;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const getElementName = (editor as unknown as { _getElementNameAtCursor: () => string | null })._getElementNameAtCursor;

    const checkInAction = editor.addAction({
      id: 'sysml.checkIn',
      label: cursorElementLocked
        ? `Check In: ${cursorElementName}`
        : `Check In (not checked out)`,
      contextMenuGroupId: '9_locks',
      contextMenuOrder: 1,
      precondition: undefined,
      run: () => {
        const name = getElementName();
        if (!name) return;
        const locked = myLockedRef.current;
        if (locked && locked.has(name)) {
          if (onCheckInRef.current) onCheckInRef.current(name);
        } else {
          if (onReadOnlyEditRef.current) onReadOnlyEditRef.current();
        }
      },
    });

    const checkOutAction = editor.addAction({
      id: 'sysml.checkOut',
      label: cursorElementLocked
        ? `Check Out (already checked out)`
        : cursorElementName
          ? `Check Out: ${cursorElementName}`
          : 'Check Out Element',
      contextMenuGroupId: '9_locks',
      contextMenuOrder: 2,
      precondition: undefined,
      run: () => {
        const name = getElementName();
        if (!name) return;
        const locked = myLockedRef.current;
        if (locked && locked.has(name)) {
          if (onReadOnlyEditRef.current) onReadOnlyEditRef.current();
        } else {
          if (onCheckOutRef.current) onCheckOutRef.current(name);
        }
      },
    });

    const findReplaceAction = editor.addAction({
      id: 'sysml.findReplaceElement',
      label: 'Find & Replace Element Name',
      contextMenuGroupId: '9_locks',
      contextMenuOrder: 3,
      precondition: undefined,
      run: (ed) => {
        const position = ed.getPosition();
        const model = ed.getModel();
        if (!position || !model) return;
        const word = model.getWordAtPosition(position);
        if (!word) return;
        ed.setSelection(new monaco.Selection(
          position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn,
        ));
        ed.trigger('sysml', 'editor.action.startFindReplaceAction', null);
      },
    });

    const selectAllAction = editor.addAction({
      id: 'sysml.selectAllOccurrences',
      label: 'Select All Occurrences',
      contextMenuGroupId: '9_locks',
      contextMenuOrder: 4,
      precondition: undefined,
      run: (ed) => {
        const position = ed.getPosition();
        const model = ed.getModel();
        if (!position || !model) return;
        const word = model.getWordAtPosition(position);
        if (!word) return;
        const wordText = word.word;
        const matches = model.findMatches(wordText, true, false, true, null, false);
        if (matches.length === 0) return;
        const selections = matches.map(m => new monaco.Selection(
          m.range.startLineNumber, m.range.startColumn,
          m.range.endLineNumber, m.range.endColumn,
        ));
        ed.setSelections(selections);
        ed.focus();
      },
    });

    const showOnlyAction = editor.addAction({
      id: 'sysml.showOnly',
      label: cursorElementName
        ? `Show Only: ${cursorElementName}`
        : 'Show Only This Element',
      contextMenuGroupId: '9_locks',
      contextMenuOrder: 5,
      precondition: undefined,
      run: () => {
        const name = getElementName();
        if (name && onShowOnlyRef.current) onShowOnlyRef.current(name);
      },
    });

    return () => {
      checkInAction.dispose();
      checkOutAction.dispose();
      findReplaceAction.dispose();
      selectAllAction.dispose();
      showOnlyAction.dispose();
    };
  }, [cursorElementName, cursorElementLocked]);

  // ─── AI change highlighting & context menu ──────────────────────────────
  const aiDecorationsRef = useRef<string[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const hunks = aiChangeHunks ?? [];

    // Apply decorations for each hunk
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
    for (const hunk of hunks) {
      if (hunk.newEndLine === 0) continue; // pure deletion — nothing to highlight in new content
      const isAdded = hunk.type === 'added';
      for (let line = hunk.newStartLine; line <= hunk.newEndLine; line++) {
        newDecorations.push({
          range: new monaco.Range(line, 1, line, Number.MAX_SAFE_INTEGER),
          options: {
            isWholeLine: true,
            className: isAdded ? 'ai-change-added-line' : 'ai-change-modified-line',
            linesDecorationsClassName: isAdded ? 'ai-change-gutter-added' : 'ai-change-gutter-modified',
            overviewRuler: {
              color: isAdded ? '#28a745' : '#ff9800',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
      }
    }

    aiDecorationsRef.current = editor.deltaDecorations(aiDecorationsRef.current, newDecorations);
  }, [aiChangeHunks]);

  // AI change context menu actions
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const hunks = aiChangeHunks ?? [];
    const hasHunks = hunks.length > 0;
    if (!hasHunks) return;

    const getHunkAtCursor = (): DiffHunk | null => {
      const pos = editor.getPosition();
      if (!pos) return null;
      const line = pos.lineNumber;
      const currentHunks = aiChangeHunksRef.current ?? [];
      return currentHunks.find(h => h.newEndLine > 0 && line >= h.newStartLine && line <= h.newEndLine) ?? null;
    };

    const acceptAllAction = editor.addAction({
      id: 'ai.acceptAll',
      label: 'Accept All AI Changes',
      contextMenuGroupId: '8_ai_changes',
      contextMenuOrder: 1,
      run: () => { onAcceptAiChangeRef.current?.('all'); },
    });

    const revertAllAction = editor.addAction({
      id: 'ai.revertAll',
      label: 'Revert All AI Changes',
      contextMenuGroupId: '8_ai_changes',
      contextMenuOrder: 2,
      run: () => { onRevertAiChangeRef.current?.('all'); },
    });

    const acceptThisAction = editor.addAction({
      id: 'ai.acceptThis',
      label: 'Accept This Change',
      contextMenuGroupId: '8_ai_changes',
      contextMenuOrder: 3,
      precondition: undefined,
      run: () => {
        const hunk = getHunkAtCursor();
        if (hunk) onAcceptAiChangeRef.current?.(hunk.id);
      },
    });

    const revertThisAction = editor.addAction({
      id: 'ai.revertThis',
      label: 'Revert This Change',
      contextMenuGroupId: '8_ai_changes',
      contextMenuOrder: 4,
      precondition: undefined,
      run: () => {
        const hunk = getHunkAtCursor();
        if (hunk) onRevertAiChangeRef.current?.(hunk.id);
      },
    });

    return () => {
      acceptAllAction.dispose();
      revertAllAction.dispose();
      acceptThisAction.dispose();
      revertThisAction.dispose();
    };
  }, [aiChangeHunks]);

  // Sync readOnly state and detect edit attempts
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ readOnly });
  }, [readOnly]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const disposable = editor.onKeyDown((e) => {
      if (!readOnlyRef.current || !onReadOnlyEditRef.current) return;
      // Ignore modifier-only keys and navigation keys
      const nav = [
        monaco.KeyCode.Shift, monaco.KeyCode.Ctrl, monaco.KeyCode.Alt, monaco.KeyCode.Meta,
        monaco.KeyCode.UpArrow, monaco.KeyCode.DownArrow, monaco.KeyCode.LeftArrow, monaco.KeyCode.RightArrow,
        monaco.KeyCode.Home, monaco.KeyCode.End, monaco.KeyCode.PageUp, monaco.KeyCode.PageDown,
        monaco.KeyCode.Escape, monaco.KeyCode.Tab, monaco.KeyCode.F1, monaco.KeyCode.F2,
      ];
      if (nav.includes(e.keyCode)) return;
      // Allow Ctrl+C, Ctrl+A etc. but trigger on typing keys
      if (e.ctrlKey || e.metaKey) return;
      onReadOnlyEditRef.current();
    });
    return () => disposable.dispose();
  }, []);

  // Sync external value changes without resetting cursor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value && valueRef.current !== value) {
      const pos = editor.getPosition();
      const scrollTop = editor.getScrollTop();
      editor.setValue(value);
      if (pos) editor.setPosition(pos);
      editor.setScrollTop(scrollTop);
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
});

export default MonacoEditor;
