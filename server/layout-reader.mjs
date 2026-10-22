import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';

export function groupTextItems(items, viewport) {
  const cells = items.filter(item => typeof item.str === 'string' && item.str.trim()).map(item => {
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    return { x, y, width: item.width, text: item.str, dir: item.dir };
  }).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const cell of cells) {
    const last = rows.at(-1);
    if (!last || Math.abs(last.y - cell.y) > 3) rows.push({ y: cell.y, cells: [cell] });
    else last.cells.push(cell);
  }
  return rows.map(row => {
    const sorted = row.cells.sort((a, b) => a.x - b.x);
    const groups = [];
    for (const cell of sorted) {
      const last = groups.at(-1);
      if (!last || cell.x - last.end > 14) groups.push({ x: cell.x, end: cell.x + cell.width, text: cell.text, rtl: cell.dir === 'rtl' });
      else {
        const gap = cell.x - last.end;
        const separator = gap > 1 && !last.text.endsWith(' ') && !cell.text.startsWith(' ') ? ' ' : '';
        last.text = last.rtl && cell.dir === 'rtl' ? cell.text + separator + last.text : last.text + separator + cell.text;
        last.end = Math.max(last.end, cell.x + cell.width);
      }
    }
    return { y: Math.round(row.y), cells: groups.map(cell => ({ x: Math.round(cell.x), text: cell.text.trim() })) };
  });
}

export async function readPdfLayout(buffer) {
  const loading = getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false });
  try {
    const document = await loading.promise;
    if (document.numPages > 15) throw new Error('PAGE_LIMIT');
    const output = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const rows = groupTextItems(content.items, viewport);
      output.push(...rows.map((row, index) => `[P${pageNumber}L${index + 1} y=${row.y}] ` + row.cells.map(cell => `(x=${cell.x}) ${cell.text}`).join(' | ')));
      page.cleanup();
    }
    return output.join('\n');
  } finally { await loading.destroy(); }
}

function decodeEntities(text) {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, token => {
    const names = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
    if (names[token]) return names[token];
    const value = token.startsWith('&#x') ? parseInt(token.slice(3, -1), 16) : parseInt(token.slice(2, -1), 10);
    return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : token;
  });
}
export async function readDocxLayout(buffer) {
  const result = await mammoth.convertToHtml({ buffer });
  // Keep table cells together on their row, and paragraph/heading boundaries separate.
  const text = result.value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:td|th)>/gi, ' | ').replace(/<\/(?:p|h[1-6]|tr|li)>/gi, '\n').replace(/<[^>]*>/g, '');
  return decodeEntities(text).split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => `[D1L${index + 1}] ${line}`).join('\n');
}

const normalize = text => text.replace(/\s+/g, ' ').replace(/[–—−]/g, '-').trim().toLowerCase();
export function validateDateAssociation(source, evidence, date, lineId) {
  if (!date.trim()) return true;
  if (!lineId) return false;
  const lines = source.split('\n').flatMap((text, index) => {
    const match = text.match(/^\[([PD]\d+L\d+)(?: y=(\d+))?\] (.*)$/);
    if (!match) return [];
    const cells = match[3].split(/ \| (?=\(x=)/).map(cell => {
      const position = cell.match(/^\(x=(\d+)\) (.*)$/);
      return { x: position ? Number(position[1]) : null, text: position ? position[2] : cell };
    });
    return [{ id: match[1], page: match[1].split('L')[0], y: match[2] === undefined ? null : Number(match[2]), text: match[3], cells, index }];
  });
  const normalizedId = String(lineId).match(/\b[PD]\d+L\d+\b/i)?.[0].toUpperCase();
  const dateLine = lines.find(line => line.id === normalizedId);
  if (!dateLine || !normalize(dateLine.text).includes(normalize(date))) return false;
  const quote = normalize(evidence);
  const anchors = lines.filter(line => normalize(line.text).includes(quote));
  return anchors.some(anchor => {
    if (anchor.page !== dateLine.page) return false;
    if (anchor.y === null || dateLine.y === null) return Math.abs(anchor.index - dateLine.index) <= 2;
    if (Math.abs(anchor.y - dateLine.y) > 32) return false;
    const anchorCells = anchor.cells.filter(cell => normalize(cell.text).includes(quote));
    const dateCells = dateLine.cells.filter(cell => normalize(cell.text).includes(normalize(date)));
    return dateCells.some(dateCell => anchorCells.some(anchorCell => {
      if (anchor.id === dateLine.id && anchorCell === dateCell) return true;
      const candidates = lines.filter(line => line.page === dateLine.page && line.y !== null && Math.abs(line.y - dateLine.y) <= 32)
        .flatMap(line => line.cells.map(cell => ({ ...cell, verticalDistance: Math.abs(line.y - dateLine.y) })))
        .filter(cell => cell.x !== null && !normalize(cell.text).includes(normalize(date)) && !/(?:19|20)\d{2}|[١٢][٠٩][٠-٩]{2}/.test(cell.text));
      if (!candidates.length) return false;
      const closestRow = Math.min(...candidates.map(cell => cell.verticalDistance));
      const nearest = Math.min(...candidates.filter(cell => cell.verticalDistance <= closestRow + 4).map(cell => Math.abs(cell.x - dateCell.x)));
      return Math.abs(anchorCell.x - dateCell.x) <= nearest + 24;
    }));
  });
}

export function plainLayoutText(source) {
  return source.replace(/^\[[PD]\d+L\d+(?: y=\d+)?\]\s*/gm, '').replace(/\(x=\d+\)\s*/g, '').replace(/ \| /g, ' ');
}

export function recoverLinkedDate(source, anchor) {
  if (!anchor.trim()) return '';
  const months = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)';
  const component = `(?:${months}\\s+)?(?:19|20)\\d{2}`;
  const pattern = new RegExp(`${component}(?:\\s*(?:-|–|—|to|حتى|إلى)\\s*(?:${component}|Present|Current|Now|حتى الآن|الآن|حاليًا))?`, 'gi');
  const candidates = new Map();
  for (const line of source.split('\n')) {
    const id = line.match(/^\[([PD]\d+L\d+)/)?.[1];
    if (!id) continue;
    const cells = line.replace(/^\[[^\]]+\]\s*/, '').split(/ \| (?=\(x=)/).map(cell => cell.replace(/^\(x=\d+\)\s*/, ''));
    for (const cell of cells) {
      for (const match of cell.matchAll(pattern)) {
        const date = match[0].trim();
        // A year buried in a title is not enough to infer a date field.
        if (/^\d{4}$/.test(date) && cell.trim() !== date) continue;
        if (validateDateAssociation(source, anchor, date, id)) candidates.set(normalize(date), date);
      }
    }
  }
  return candidates.size === 1 ? [...candidates.values()][0] : '';
}
