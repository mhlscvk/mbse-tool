import { describe, it, expect, vi } from 'vitest';

// Mock Prisma to avoid initialization error
vi.mock('../db.js', () => ({ prisma: {} }));
vi.mock('../mcp/events.js', () => ({ mcpEvents: { emitFileChange: vi.fn() } }));

import { AI_TOOLS } from './tools.js';

describe('AI tool schema definitions', () => {
  const EXPECTED_TOOLS = [
    'list_projects', 'list_files', 'read_file', 'create_file',
    'update_file', 'apply_edit', 'delete_file', 'search_files',
  ];

  it('exports all expected tools', () => {
    const names = AI_TOOLS.map(t => t.name);
    for (const expected of EXPECTED_TOOLS) {
      expect(names).toContain(expected);
    }
  });

  it('no tool has duplicate parameter names', () => {
    for (const tool of AI_TOOLS) {
      const propKeys = Object.keys(tool.parameters.properties);
      expect(new Set(propKeys).size).toBe(propKeys.length);
    }
  });

  it('all parameter properties have type and description', () => {
    for (const tool of AI_TOOLS) {
      for (const [key, prop] of Object.entries(tool.parameters.properties)) {
        const p = prop as { type?: string; description?: string };
        expect(p.type, `${tool.name}.${key} missing type`).toBeTruthy();
        expect(p.description, `${tool.name}.${key} missing description`).toBeTruthy();
      }
    }
  });

  it('apply_edit requires all necessary position parameters', () => {
    const applyEdit = AI_TOOLS.find(t => t.name === 'apply_edit')!;
    expect(applyEdit.parameters.required).toContain('fileId');
    expect(applyEdit.parameters.required).toContain('startLine');
    expect(applyEdit.parameters.required).toContain('startColumn');
    expect(applyEdit.parameters.required).toContain('endLine');
    expect(applyEdit.parameters.required).toContain('endColumn');
    expect(applyEdit.parameters.required).toContain('newText');
  });

  it('create_file requires projectId, name, and content', () => {
    const createFile = AI_TOOLS.find(t => t.name === 'create_file')!;
    expect(createFile.parameters.required).toEqual(
      expect.arrayContaining(['projectId', 'name', 'content']),
    );
  });
});
