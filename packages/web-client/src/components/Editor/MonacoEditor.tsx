import React, { useEffect, useRef } from 'react';
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
  typeKeywords: ['Boolean', 'Integer', 'Real', 'String', 'Anything'],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/"[^"]*"/, 'string'],
      [/'[^']*'/, 'string'],
      [/\b\d+(\.\d+)?\b/, 'number'],
      [/[A-Z][a-zA-Z0-9_]*/, {
        cases: { '@typeKeywords': 'type.identifier', '@default': 'type.identifier' },
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

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function MonacoEditor({ value, onChange, readOnly = false }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);

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
}
