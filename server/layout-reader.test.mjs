import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readPdfLayout, readDocxLayout, validateDateAssociation, groupTextItems, recoverLinkedDate, plainLayoutText } from './layout-reader.mjs';

function findLine(source, phrase) { return source.split('\n').find(line => line.includes(phrase))?.match(/^\[([PD]\d+L\d+)/)?.[1]; }
for (const style of ['date-rail', 'scrambled', 'two-columns', 'multipage']) {
  test(`preserves visual relationships for ${style} PDF`, async () => {
    const source = await readPdfLayout(await readFile(new URL(`fixtures/layout-${style}.pdf`, import.meta.url)));
    const degreeDate = findLine(source, 'Jan 2022 - Present');
    assert.ok(validateDateAssociation(source, 'Bachelor of Computer Science', 'Jan 2022 - Present', degreeDate));
    if (style !== 'two-columns') assert.equal(validateDateAssociation(source, 'Bachelor of Computer Science', 'Oct 2025 - Dec 2025', findLine(source, 'Oct 2025 - Dec 2025')), false);
    if (style === 'two-columns') assert.equal(validateDateAssociation(source, 'Bachelor of Computer Science', 'Oct 2025 - Nov 2025', findLine(source, 'Oct 2025 - Nov 2025')), false);
    assert.equal(validateDateAssociation(source, 'Bachelor of Computer Science', 'Jan 2019 - Present', degreeDate), false);
    assert.equal(validateDateAssociation(source, 'Bachelor of Computer Science', 'Jan 2022 - Present', 'P99L1'), false);
  });
}
test('scrambled PDF content streams produce the same visual text', async () => {
  const source = async name => readPdfLayout(await readFile(new URL(`fixtures/layout-${name}.pdf`, import.meta.url)));
  assert.equal(await source('date-rail'), await source('scrambled'));
});
test('DOCX tables keep date and degree near each other', async () => {
  const source = await readDocxLayout(await readFile(new URL('fixtures/layout-table.docx', import.meta.url)));
  assert.ok(validateDateAssociation(source, 'Bachelor of Computer Science', 'Jan 2022 - Present', findLine(source, 'Jan 2022 - Present')));
});
test('RTL cell groups and multiple columns do not collapse into one string', () => {
  const viewport = { convertToViewportPoint: (x,y) => [x,800-y] };
  const rows = groupTextItems([{ str:'جامعة', dir:'rtl', width:30, transform:[1,0,0,1,50,700] },{ str:'القصيم', dir:'rtl', width:40, transform:[1,0,0,1,81,700] },{ str:'2022', dir:'ltr', width:30, transform:[1,0,0,1,320,700] }],viewport);
  assert.equal(rows[0].cells.length,2);
  assert.match(rows[0].cells[0].text,/القصيم/);
});

test('recovers a unique date and accepts reference formatting variations', async () => {
  const source = await readPdfLayout(await readFile(new URL('fixtures/layout-scrambled.pdf', import.meta.url)));
  assert.equal(recoverLinkedDate(source, 'Bachelor of Computer Science'), 'Jan 2022 - Present');
  assert.ok(validateDateAssociation(source, 'Bachelor of Computer Science', 'Jan 2022 - Present', '[P1L2]'));
  assert.equal(recoverLinkedDate(source, 'Unmentioned qualification'), '');
  assert.equal(recoverLinkedDate('[P1L1 y=100] (x=20) Demo Project 2024', 'Demo Project'), '');
});
test('layout markers do not break genuine quotes across wrapped lines', () => {
  const source = '[P1L1 y=100] (x=20) Developed a secure application\n[P1L2 y=115] (x=20) using encryption.';
  assert.ok(plainLayoutText(source).replace(/\s+/g,' ').includes('Developed a secure application using encryption.'));
});
test('ambiguous dates stay blank', () => {
  const source = '[P1L1 y=100] (x=20) Demo Degree\n[P1L2 y=115] (x=20) Jan 2022 - Present\n[P2L1 y=100] (x=20) Demo Degree\n[P2L2 y=115] (x=20) Jan 2023 - Present';
  assert.equal(recoverLinkedDate(source, 'Demo Degree'), '');
});
