import { describe, it, expect } from 'vitest';
import { sanitizeFilename, generateExportFilename } from './diagram-export.js';

describe('sanitizeFilename', () => {
  it('replaces Turkish characters', () => {
    expect(sanitizeFilename('Güneş Sistemi')).toBe('Gunes_Sistemi');
    expect(sanitizeFilename('İstanbul Çöp Öğütücü')).toBe('Istanbul_Cop_Ogutucu');
  });

  it('replaces special characters with underscore', () => {
    expect(sanitizeFilename('hello world!')).toBe('hello_world');
    expect(sanitizeFilename('a/b\\c:d')).toBe('a_b_c_d');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeFilename('a   b___c')).toBe('a_b_c');
  });

  it('trims leading/trailing underscores', () => {
    expect(sanitizeFilename('  hello  ')).toBe('hello');
    expect(sanitizeFilename('___test___')).toBe('test');
  });

  it('returns "diagram" for empty input', () => {
    expect(sanitizeFilename('')).toBe('diagram');
    expect(sanitizeFilename('   ')).toBe('diagram');
  });

  it('preserves dots, dashes, and underscores', () => {
    expect(sanitizeFilename('my-file_v2.0')).toBe('my-file_v2.0');
  });

  it('handles all Turkish characters', () => {
    expect(sanitizeFilename('ıİğĞüÜşŞöÖçÇ')).toBe('iIgGuUsSoOcC');
  });
});

describe('generateExportFilename', () => {
  it('produces correct format', () => {
    const name = generateExportFilename('My Project', 'auth-flow.sysml', 'BDD', 'png');
    // Should match: My_Project_auth-flow_BDD_YYYYMMDD-HHmmss.png
    expect(name).toMatch(/^My_Project_auth-flow_BDD_\d{8}-\d{6}\.png$/);
  });

  it('strips .sysml extension from filename', () => {
    const name = generateExportFilename('proj', 'test.sysml', 'AFV', 'svg');
    expect(name).toMatch(/^proj_test_AFV_\d{8}-\d{6}\.svg$/);
  });

  it('sanitizes Turkish project names', () => {
    const name = generateExportFilename('Güneş Enerjisi', 'model.sysml', 'general', 'png');
    expect(name).toMatch(/^Gunes_Enerjisi_model_general_\d{8}-\d{6}\.png$/);
  });

  it('handles empty parts gracefully', () => {
    const name = generateExportFilename('', '', 'BDD', 'svg');
    expect(name).toMatch(/^diagram_diagram_BDD_\d{8}-\d{6}\.svg$/);
  });
});
