import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as monaco from 'monaco-editor';

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
    'loop', 'do', 'then', 'specializes', 'redefines', 'about', 'comment',
    'doc', 'language', 'metadata', 'item', 'connection', 'interface',
    'allocation', 'satisfy', 'verify', 'concern', 'stakeholder', 'view',
    'viewpoint', 'render', 'subject', 'expose',
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
    'editorLineNumber.foreground': '#555555',
    'editorCursor.foreground': '#aeafad',
    'editor.lineHighlightBackground': '#2a2a2a',
    'editorIndentGuide.background1': '#2a2a2a',
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
}

const SEVERITY_MAP = {
  error:   monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info:    monaco.MarkerSeverity.Info,
};

const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(function MonacoEditor(
  { value, onChange, markers = [], readOnly = false }: MonacoEditorProps,
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);
  // Stable ref so the code-action provider can always see the latest markers
  const markersRef = useRef<EditorMarker[]>([]);

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
      theme: 'systemodel-dark',
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

    editor.onDidChangeModelContent(() => {
      const newValue = editor.getValue();
      valueRef.current = newValue;
      onChange(newValue);
    });

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
