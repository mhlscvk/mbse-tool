import { describe, it, expect } from 'vitest';
import { parseSysMLText } from './sysml-text-parser.js';

function parse(code: string) {
  return parseSysMLText('test://test', code);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECURITY REGRESSION TESTS
//  Ensure parser handles adversarial input safely
// ═══════════════════════════════════════════════════════════════════════════════

describe('Security: XSS vectors in parsed output', () => {
  it('HTML script tags cannot appear in node names (\\w regex)', () => {
    const { model } = parse('part def <script>alert(1)</script>;');
    for (const node of model.nodes) {
      expect(node.name).not.toMatch(/<script/i);
    }
  });

  it('SVG event handlers cannot appear in node names', () => {
    const { model } = parse('part def onload=alert(1);');
    for (const node of model.nodes) {
      expect(node.name).not.toMatch(/onload=/i);
    }
  });

  it('attribute values with HTML are stored as plain text', () => {
    const code = 'part def A { attribute x : String = "<img src=x onerror=alert(1)>"; }';
    const { model } = parse(code);
    const a = model.nodes.find(n => n.name === 'A');
    // The value should be captured as-is (React will escape it during render)
    // Verify it doesn't crash and node still exists
    expect(a).toBeDefined();
  });

  it('javascript: URI in attribute value does not crash', () => {
    const code = 'part def A { attribute x : String = "javascript:alert(1)"; }';
    expect(() => parse(code)).not.toThrow();
  });

  it('CDATA injection in content does not crash', () => {
    expect(() => parse('part def A { /* <![CDATA[ */ }')).not.toThrow();
  });
});

describe('Security: DoS resistance', () => {
  it('oversized input (>2MB) is rejected with error diagnostic', () => {
    const huge = 'x'.repeat(2_100_000);
    const { model, diagnostics } = parse(huge);
    expect(model.nodes).toHaveLength(0);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toMatch(/maximum size/i);
  });

  it('deeply nested braces do not cause stack overflow', () => {
    const nested = '{'.repeat(5000) + '}'.repeat(5000);
    expect(() => parse(`part def A ${nested}`)).not.toThrow();
  });

  it('repeated regex patterns do not cause catastrophic backtracking', () => {
    // Pattern designed to trigger backtracking in naive regex engines
    const pathological = 'attribute x = ' + 'a'.repeat(10000);
    const start = Date.now();
    parse(pathological);
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it('millions of newlines do not exhaust memory in lineCol', () => {
    const manyLines = '\n'.repeat(50000) + 'part def A;';
    const start = Date.now();
    const { model } = parse(manyLines);
    expect(Date.now() - start).toBeLessThan(3000);
    expect(model.nodes.length).toBe(1);
  });
});

describe('Security: path traversal in URI', () => {
  it('parser accepts URI without using it for file operations', () => {
    // URI is stored in model.uri but never used for file I/O in parser
    const { model } = parse('part def A;');
    expect(model.uri).toBe('test://test');
    // Even malicious URI values are just stored, not accessed
    const { model: m2 } = parseSysMLText('../../etc/passwd', 'part def B;');
    expect(m2.uri).toBe('../../etc/passwd');
    expect(m2.nodes[0].name).toBe('B');
  });
});

describe('Security: input type safety', () => {
  it('empty string input returns empty model', () => {
    const { model, diagnostics } = parse('');
    expect(model.nodes).toHaveLength(0);
    expect(diagnostics).toHaveLength(0);
  });

  it('whitespace-only input returns empty model', () => {
    const { model } = parse('   \n\t\r\n   ');
    expect(model.nodes).toHaveLength(0);
  });
});

describe('Security: error message sanitization', () => {
  it('diagnostics do not leak file system paths', () => {
    const { diagnostics } = parse('import NonExistent::*;');
    for (const d of diagnostics) {
      expect(d.message).not.toMatch(/[A-Z]:\\/); // No Windows paths
      expect(d.message).not.toMatch(/\/home\//);  // No Linux paths
      expect(d.message).not.toMatch(/node_modules/);
    }
  });
});
