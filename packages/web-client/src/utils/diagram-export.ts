/**
 * Diagram export utilities — SVG and PNG export from the diagram viewer.
 * Runs entirely client-side; no server requests.
 */

// ── Filename sanitization ──

const TURKISH_MAP: Record<string, string> = {
  ı: 'i', İ: 'I', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U',
  ş: 's', Ş: 'S', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C',
};

/** Replace Turkish-specific characters and make filename-safe */
export function sanitizeFilename(name: string): string {
  let s = name;
  for (const [from, to] of Object.entries(TURKISH_MAP)) {
    s = s.replaceAll(from, to);
  }
  // Replace non-alphanumeric (except dash/underscore/dot) with underscore
  s = s.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Collapse multiple underscores
  s = s.replace(/_+/g, '_');
  // Trim leading/trailing underscores
  s = s.replace(/^_+|_+$/g, '');
  return s || 'diagram';
}

/** Generate export filename: project_file_viewtype_timestamp.ext */
export function generateExportFilename(
  projectName: string,
  fileName: string,
  viewType: string,
  ext: 'png' | 'svg',
): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const parts = [
    sanitizeFilename(projectName),
    sanitizeFilename(fileName.replace(/\.sysml$/i, '')),
    sanitizeFilename(viewType),
  ].filter(Boolean);

  return `${parts.join('_')}_${ts}.${ext}`;
}

// ── SVG Export ──

/** Collect all CSS rules that apply to elements inside the SVG */
function collectAppliedStyles(svgEl: SVGSVGElement): string {
  const rules: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule) {
          try {
            if (svgEl.querySelector(rule.selectorText)) {
              rules.push(rule.cssText);
            }
          } catch { /* selector parse error — skip */ }
        }
      }
    } catch { /* cross-origin stylesheet — skip */ }
  }
  return rules.join('\n');
}

/** Clone the SVG, embed styles, and return a self-contained SVG string */
export function exportSvgString(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Set proper SVG namespace attributes
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Compute viewBox from actual content bounds
  const bbox = svgEl.getBBox();
  const pad = 20;
  const vbX = bbox.x - pad;
  const vbY = bbox.y - pad;
  const vbW = bbox.width + pad * 2;
  const vbH = bbox.height + pad * 2;
  clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  clone.setAttribute('width', String(Math.ceil(vbW)));
  clone.setAttribute('height', String(Math.ceil(vbH)));

  // Remove interactive attributes and transform
  clone.removeAttribute('style');
  clone.style.background = 'white';

  // Embed applied CSS as inline <style>
  const css = collectAppliedStyles(svgEl);
  if (css) {
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = css;
    clone.insertBefore(styleEl, clone.firstChild);
  }

  // Remove any transform group that wraps the diagram (pan/zoom)
  // The content is already positioned by viewBox
  const transformG = clone.querySelector('g[transform]');
  if (transformG && transformG === clone.children[clone.querySelector('style') ? 1 : 0] as Element) {
    // Keep the transform — it's part of the diagram positioning
  }

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svgStr}`;
}

// ── PNG Export ──

/** Render the SVG to a PNG blob at the given scale factor */
export function exportPngBlob(
  svgEl: SVGSVGElement,
  scale = 2,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgStr = exportSvgString(svgEl);
    const bbox = svgEl.getBBox();
    const pad = 20;
    const width = Math.ceil((bbox.width + pad * 2) * scale);
    const height = Math.ceil((bbox.height + pad * 2) * scale);

    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        'image/png',
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into image element'));
    };

    img.src = url;
  });
}

// ── Download helper ──

/** Trigger a browser download of a Blob or string */
export function downloadFile(data: Blob | string, filename: string, mimeType?: string): void {
  const blob = typeof data === 'string'
    ? new Blob([data], { type: mimeType || 'image/svg+xml' })
    : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
