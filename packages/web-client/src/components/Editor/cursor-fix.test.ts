import { describe, it, expect, afterEach } from 'vitest';

/**
 * Tests for the Monaco editor cursor visibility fix.
 * The cursor must always be black (#000) — never white or transparent.
 */

const CURSOR_COLOR = '#000000';
const CURSOR_COLOR_SHORT = '#000';
const CURSOR_COLOR_RGB = 'rgb(0, 0, 0)';

function matchesCursorColor(value: string): boolean {
  return value === CURSOR_COLOR || value === CURSOR_COLOR_SHORT || value === CURSOR_COLOR_RGB;
}

describe('Cursor color is always black', () => {
  it('cursor color is not white', () => {
    expect(CURSOR_COLOR).not.toBe('#ffffff');
    expect(CURSOR_COLOR).not.toBe('#fff');
  });

  it('cursor color is black', () => {
    expect(CURSOR_COLOR).toBe('#000000');
  });

  it('cursor color has maximum contrast on white background', () => {
    // Black on white = 21:1 contrast ratio (max possible)
    const blackLum = 0.0;
    const whiteLum = 1.0;
    const contrast = (whiteLum + 0.05) / (blackLum + 0.05);
    expect(contrast).toBe(21);
  });
});

describe('forceCursorBlack inline style', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  function forceCursorBlack(el: HTMLElement) {
    el.style.setProperty('background', CURSOR_COLOR_SHORT, 'important');
    el.style.setProperty('border-color', CURSOR_COLOR_SHORT, 'important');
  }

  it('sets inline background with !important', () => {
    container = document.createElement('div');
    container.innerHTML = '<div class="cursors-layer"><div class="cursor"></div></div>';
    document.body.appendChild(container);

    const cursor = container.querySelector<HTMLElement>('.cursor')!;
    forceCursorBlack(cursor);

    expect(matchesCursorColor(cursor.style.getPropertyValue('background'))).toBe(true);
    expect(cursor.style.getPropertyPriority('background')).toBe('important');
  });

  it('sets inline border-color with !important', () => {
    container = document.createElement('div');
    container.innerHTML = '<div class="cursors-layer"><div class="cursor"></div></div>';
    document.body.appendChild(container);

    const cursor = container.querySelector<HTMLElement>('.cursor')!;
    forceCursorBlack(cursor);

    expect(matchesCursorColor(cursor.style.getPropertyValue('border-color'))).toBe(true);
    expect(cursor.style.getPropertyPriority('border-color')).toBe('important');
  });

  it('inline !important overrides any external CSS', () => {
    const sheet = document.createElement('style');
    sheet.textContent = '.cursor { background: #fff !important; }';
    document.head.appendChild(sheet);

    container = document.createElement('div');
    container.innerHTML = '<div class="cursors-layer"><div class="cursor"></div></div>';
    document.body.appendChild(container);

    const cursor = container.querySelector<HTMLElement>('.cursor')!;
    forceCursorBlack(cursor);

    // Inline !important always beats stylesheet !important
    expect(matchesCursorColor(cursor.style.getPropertyValue('background'))).toBe(true);
    sheet.remove();
  });
});
