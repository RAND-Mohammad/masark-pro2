import { readFileSync, existsSync } from 'node:fs';

// Entirely fictional records, built into real, font-embedded PDFs at test time.
export const resumeLines = {
  en: [
    'Synthetic Student - fictional FR3 test data',
    'Technical Skills:', 'Python, JavaScript, HTML, CSS, SQL, Git, Excel, Figma, Linux',
    'Projects:',
    'Project: Campus Portal', 'Description: A web application for a fictional campus.',
    'Role: Designed the interface', 'Technologies: HTML, CSS, JavaScript',
    'Project: Survey Dashboard', 'Description: Data analysis of synthetic survey responses.',
    'Role: Prepared the reports', 'Technologies: Python, Excel, SQL',
    'Project: Interface Study', 'Description: Interface sketches for a fictional service.',
    'Role: Created sketches', 'Technologies: Figma',
    'Courses:',
    'Course: Python Basics', 'Provider: Demo Academy; Date: 2021',
    'Course: Web Foundations', 'Provider: Sample Platform; Date: 2022',
    'Course: Data Reporting', 'Provider: Demo Academy; Date: 2023',
    'Course: Interface Design', 'Provider: Example School; Date: 2023',
    'Course: Version Control', 'Provider: Sample Platform; Date: 2024',
    'Professional Certifications:',
    'Certificate: Example Professional Credential', 'Issuer: Fictional Board; Date: 2024',
    'Certificate: Sample Security Credential', 'Issuer: Demo Board; Date: 2025',
    'Education:',
    'Degree: Bachelor of Science', 'University: Demo University',
    'College: College of Computing', 'Major: Computer Science',
    'Dates: 2022 - 2027', 'Status: Expected graduation 2027',
    'Work Experience:',
    'Role: Software Intern; Company: Sample Labs', 'Location: Demo City',
    'Period: Jan 2021 - Mar 2022', 'Duties: Reviewed synthetic test cases.',
    'Role: Data Assistant; Company: Fictional Office', 'Location: Sample City',
    'Period: 2023 - 2024', 'Duties: Prepared fictional reports.',
  ],
  ar: [
    'طالبة تجريبية - بيانات وهمية لا تخص شخصا حقيقيا',
    'المهارات التقنية:', 'Python, JavaScript, HTML, CSS, SQL, Git, Excel, Figma, Linux',
    'المشاريع:',
    'اسم المشروع: بوابة الحرم', 'الوصف: تطبيق ويب لحرم جامعي وهمي.',
    'الدور: تصميم الواجهة', 'Technologies: HTML, CSS, JavaScript',
    'اسم المشروع: لوحة الاستبيان', 'الوصف: تحليل البيانات لاستبيان وهمي.',
    'الدور: إعداد التقارير', 'Technologies: Python, Excel, SQL',
    'اسم المشروع: دراسة الواجهة', 'الوصف: رسومات واجهات لخدمة وهمية.',
    'الدور: إعداد الرسومات', 'Technologies: Figma',
    'الدورات:',
    'اسم الدورة: أساسيات بايثون', 'المنصة: أكاديمية تجريبية', 'التاريخ: ٢٠٢١',
    'اسم الدورة: أساسيات الويب', 'المنصة: منصة وهمية', 'التاريخ: ٢٠٢٢',
    'اسم الدورة: تقارير البيانات', 'المنصة: أكاديمية تجريبية', 'التاريخ: ٢٠٢٣',
    'اسم الدورة: تصميم الواجهات', 'المنصة: معهد تجريبي', 'التاريخ: ٢٠٢٣',
    'اسم الدورة: إدارة النسخ', 'المنصة: منصة وهمية', 'التاريخ: ٢٠٢٤',
    'الشهادات المهنية:',
    'اسم الشهادة: اعتماد مهني تجريبي', 'الجهة المانحة: هيئة وهمية', 'التاريخ: ٢٠٢٤',
    'اسم الشهادة: اعتماد أمن تجريبي', 'الجهة المانحة: مجلس تجريبي', 'التاريخ: ٢٠٢٥',
    'التعليم:',
    'المؤهل: بكالوريوس العلوم', 'الجامعة: جامعة تجريبية',
    'الكلية: كلية الحوسبة', 'التخصص: علوم الحاسب',
    'الفترة: 2022 to 2027', 'حالة الدراسة: تخرج متوقع ٢٠٢٧',
    'الخبرات العملية:',
    'المسمى: متدربة برمجيات', 'الجهة: شركة تجريبية', 'المكان: مدينة وهمية',
    'الفترة: Jan 2021 to Mar 2022', 'المهام: مراجعة حالات اختبار وهمية.',
    'المسمى: مساعدة بيانات', 'الجهة: مؤسسة وهمية', 'المكان: مدينة تجريبية',
    'الفترة: 2023 to 2024', 'المهام: إعداد تقارير تجريبية.',
  ],
};

function fontGlyph(font, code) {
  const count = font.readUInt16BE(4);
  let cmap;
  for (let i = 0; i < count; i++) {
    const offset = 12 + i * 16;
    if (font.toString('ascii', offset, offset + 4) === 'cmap') cmap = font.readUInt32BE(offset + 8);
  }
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
    const start = cmap + font.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (font.readUInt16BE(start) !== 4) continue;
    const segments = font.readUInt16BE(start + 6) / 2;
    const ends = start + 14, starts = ends + 2 * segments + 2, deltas = starts + 2 * segments, ranges = deltas + 2 * segments;
    for (let j = 0; j < segments; j++) {
      if (code < font.readUInt16BE(starts + 2 * j) || code > font.readUInt16BE(ends + 2 * j)) continue;
      const delta = font.readInt16BE(deltas + 2 * j), range = font.readUInt16BE(ranges + 2 * j);
      if (!range) return (code + delta) & 0xffff;
      const glyph = font.readUInt16BE(ranges + 2 * j + range + 2 * (code - font.readUInt16BE(starts + 2 * j)));
      return glyph ? (glyph + delta) & 0xffff : 0;
    }
  }
  return 0;
}

function visualArabic(line) {
  if (!/\p{Script=Arabic}/u.test(line)) return line;
  return line.split(/([A-Za-z0-9٠-٩+#.,/-]+(?:\s+[A-Za-z0-9٠-٩+#.,/-]+)*)/u)
    .reverse().map(part => /^[A-Za-z0-9٠-٩+#.,/-]/u.test(part) ? part : [...part].reverse().join('')).join('');
}

// Uses an already installed system font, no package, download or generated asset
// is committed. A missing font fails the test explicitly instead of skipping it.
export function resumePdf(language, suppliedLines = resumeLines[language]) {
  const path = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf'].find(existsSync);
  if (!path) throw new Error('FR3 PDF tests require the existing DejaVuSans system font.');
  const font = readFileSync(path);
  const glyphs = new Map();
  const encoded = suppliedLines.map(visualArabic).map(line => [...line].map(character => {
    const code = character.codePointAt(0), glyph = fontGlyph(font, code);
    if (!glyph) throw new Error(`Missing synthetic PDF glyph ${code}`);
    glyphs.set(glyph, code);
    return glyph.toString(16).padStart(4, '0');
  }).join(''));
  const chars = [...glyphs].map(([glyph, code]) => `<${glyph.toString(16).padStart(4, '0')}> <${code.toString(16).padStart(4, '0')}>`);
  const mappings = [];
  for (let i = 0; i < chars.length; i += 100) {
    const block = chars.slice(i, i + 100);
    mappings.push(`${block.length} beginbfchar\n${block.join('\n')}\nendbfchar`);
  }
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /FR3Unicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <ffff>\nendcodespacerange\n${mappings.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend end`;
  const pages = [];
  for (let i = 0; i < encoded.length; i += 45) pages.push(encoded.slice(i, i + 45));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${9 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSans /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 6 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /DW 600 /CIDToGIDMap /Identity >>',
    '<< /Type /FontDescriptor /FontName /DejaVuSans /Flags 4 /FontBBox [-1021 -463 1794 1232] /ItalicAngle 0 /Ascent 928 /Descent -236 /CapHeight 729 /StemV 80 /FontFile2 7 0 R >>',
    `<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}\nendstream`,
    Buffer.concat([Buffer.from(`<< /Length ${font.length} /Length1 ${font.length} >>\nstream\n`), font, Buffer.from('\nendstream')]),
    '<< >>',
  ];
  for (const [index, page] of pages.entries()) {
    const stream = 'BT /F1 9 Tf 35 760 Td\n' + page.map((text, i) => `${i ? '0 -15 Td ' : ''}<${text}> Tj`).join('\n') + '\nET';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${10 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  const buffers = [Buffer.from('%PDF-1.7\n')], offsets = [];
  let length = buffers[0].length;
  objects.forEach((object, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(object) ? object : Buffer.from(object), Buffer.from('\nendobj\n')]);
    buffers.push(chunk); length += chunk.length;
  });
  buffers.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(buffers);
}
