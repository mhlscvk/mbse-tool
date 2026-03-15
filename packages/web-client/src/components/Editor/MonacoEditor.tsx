import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { createLspClient } from '../../services/lsp-client.js';

// Register SysML v2 language with Monaco
monaco.languages.register({ id: 'sysml', extensions: ['.sysml'], aliases: ['SysML', 'sysml'] });
monaco.languages.setMonarchTokensProvider('sysml', {
  keywords: ['package', 'part', 'attribute', 'connect', 'flow', 'action', 'state', 'port',
    'def', 'use', 'import', 'public', 'private', 'protected', 'abstract', 'ref',
    'in', 'out', 'inout', 'return', 'if', 'else', 'loop', 'do', 'then'],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/"[^"]*"/, 'string'],
      [/'[^']*'/, 'string'],
      [/\b\d+(\.\d+)?\b/, 'number'],
      [/[A-Z][a-zA-Z0-9_]*/, 'type.identifier'],
      [/[a-zA-Z_][a-zA-Z0-9_]*/, {
        cases: { '@keywords': 'keyword', '@default': 'identifier' },
      }],
      [/[{}()\[\]]/, 'delimiter.bracket'],
      [/[;,.]/, 'delimiter'],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
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
  ],
  colors: {},
});

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function MonacoEditor({ value, onChange, readOnly = false }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const lspStarted = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = monaco.editor.create(containerRef.current, {
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
    });

    editorRef.current.onDidChangeModelContent(() => {
      onChange(editorRef.current?.getValue() ?? '');
    });

    // Start LSP client once
    if (!lspStarted.current) {
      lspStarted.current = true;
      const lspClient = createLspClient();
      lspClient.start();
    }

    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  // Sync external value changes without losing cursor position
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      const pos = editor.getPosition();
      editor.setValue(value);
      if (pos) editor.setPosition(pos);
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
