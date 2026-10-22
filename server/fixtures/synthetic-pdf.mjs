// ASCII-only, in-memory documents for tests; never user resumes.
export function syntheticPdf(lines = [], { winAnsi = false, fontSize = 12 } = {}) {
  const literal = line => line.replace(/[\\()]/g, '\\$&').replace(/[—–]/g, mark => winAnsi ? (mark === '—' ? '\\227' : '\\226') : mark);
  const stream = `BT /F1 ${fontSize} Tf 50 750 Td ` + lines.map((line, index) =>
    `${index ? '0 -24 Td ' : ''}(${literal(line)}) Tj`).join('\n') + ' ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica${winAnsi ? ' /Encoding /WinAnsiEncoding' : ''} >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let document = '%PDF-1.4\n';
  const offsets = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(document);
  document += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(document);
}
