import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { useThemeStore, themes } from '../../store/theme.js';
import { parseSysmlElementRanges } from '../../utils/sysml-helpers.js';

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

monaco.editor.defineTheme('systemodel-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
    { token: 'keyword.stdlib', foreground: 'dcdcaa', fontStyle: 'bold' },
    { token: 'type.identifier', foreground: '4ec9b0' },
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'string', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'delimiter', foreground: 'd4d4d4' },
    { token: 'delimiter.bracket', foreground: 'ffd700' },
    { token: 'identifier', foreground: 'd4d4d4' },
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
    'editorLineNumber.foreground': '#858585',
    'editorLineNumber.activeForeground': '#c6c6c6',
    'editorCursor.foreground': '#d4d4d4',
    'editorCursor.background': '#1e1e1e',
    'editor.lineHighlightBackground': '#2a2a2a',
    'editor.lineHighlightBorder': '#303030',
    'editorIndentGuide.background1': '#404040',
    'editor.selectionBackground': '#264f78',
    'editor.selectionHighlightBackground': '#264f7860',
    'editor.wordHighlightBackground': '#575757b8',
    'editorBracketMatch.background': '#0064001a',
    'editorBracketMatch.border': '#888888',
    'editorGutter.background': '#1e1e1e',
    'scrollbarSlider.background': '#4e4e4e80',
    'scrollbarSlider.hoverBackground': '#6e6e6ea0',
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
    'editorCursor.background': '#ffffff',
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
}

const SEVERITY_MAP = {
  error:   monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info:    monaco.MarkerSeverity.Info,
};

const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(function MonacoEditor(
  { value, onChange, markers = [], readOnly = false, onReadOnlyEdit, onCheckOut, onCheckIn, myLockedElements, onShowOnly }: MonacoEditorProps,
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
  const themeMode = useThemeStore((s) => s.mode);
  const monacoTheme = themes[themeMode].monacoTheme;

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
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value,
      language: 'sysml',
      theme: monacoTheme,
      readOnly,
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      folding: true,
    });

    editorRef.current = editor;

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

  // Sync Monaco theme when it changes
  useEffect(() => {
    monaco.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // Register context menu actions — recreate when lock state changes to update labels
  const onCheckOutRef = useRef(onCheckOut);
  const onCheckInRef = useRef(onCheckIn);
  const onShowOnlyRef = useRef(onShowOnly);
  onCheckOutRef.current = onCheckOut;
  onCheckInRef.current = onCheckIn;
  onShowOnlyRef.current = onShowOnly;

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
