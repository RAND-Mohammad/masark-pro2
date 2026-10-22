// Deterministic image processing only: no generation, redrawing, recoloring or network.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Jimp = require('jimp-compact'); // Already installed with Expo's image tools.

const root = path.resolve(__dirname, '..');
const sourcePath = 'attached_assets/MASARAKlogo_1792027630479.jpg';
const background = 0xf1f5f5ff;
// Empty margins only; the complete colored artwork is inside this rectangle.
const crop = { x: 270, y: 356, width: 750, height: 532 };
const paths = {
  icon: 'assets/images/icon.png',
  adaptive: 'assets/images/android-icon-foreground.png',
  favicon: 'assets/images/favicon.png',
};
function isArtwork(r, g, b) {
  return Math.min(r, g, b) < 150 && Math.max(r, g, b) - Math.min(r, g, b) > 35;
}
function frame(source, width) {
  const content = source.clone().crop(crop.x, crop.y, crop.width, crop.height)
    .resize(width, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  return new Jimp(1024, 1024, background).composite(
    content, Math.round((1024 - content.bitmap.width) / 2), Math.round((1024 - content.bitmap.height) / 2),
  );
}
async function png(image, relativePath) {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await image.clone().colorType(2).deflateLevel(9).writeAsync(target);
}
async function preview(source, icon, adaptive) {
  const board = new Jimp(1140, 650, 0xe7ebeaff);
  const labels = [];
  const label = (x, y, text) => labels.push('-annotate', `+${x}+${y + 16}`, text);
  label(30, 16, 'ORIGINAL JPG (unchanged)');
  label(410, 16, 'APP ICON / iOS / Android fallback');
  label(790, 16, 'ADAPTIVE: circular launcher preview');
  board.composite(source.clone().resize(320, 320), 30, 48);
  board.composite(icon.clone().resize(320, 320), 410, 48);
  // A launcher can reveal a disk of radius 36/108 of its foreground layer.
  // Simulate that mask without changing any app asset.
  const masked = adaptive.clone();
  const radius = 1024 * 36 / 108;
  masked.scan(0, 0, 1024, 1024, (x, y, i) => {
    if (Math.hypot(x - 511.5, y - 511.5) > radius) masked.bitmap.data[i + 3] = 0;
  });
  const visible = Math.floor(radius * 2);
  masked.crop(Math.round((1024 - visible) / 2), Math.round((1024 - visible) / 2), visible, visible);
  board.composite(masked.resize(320, 320), 790, 48);
  label(30, 402, 'Actual pixel sizes (not enlarged):');
  for (const [index, size] of [32, 48, 64].entries()) {
    const x = 40 + index * 180;
    label(x, 440, `${size} x ${size}`);
    board.composite(icon.clone().resize(size, size, Jimp.RESIZE_BICUBIC), x, 474);
  }
  label(640, 440, 'Original artwork and colors preserved.');
  label(640, 474, 'Opaque light background. No rounded app assets.');
  label(30, 590, 'Small lettering naturally loses detail at 32 px; no alternate symbol or redrawing was used.');
  await png(board, 'generated-artifacts/masarak-icons-preview.png');
  // Labels are on the comparison board only, never on any application icon.
  const output = path.join(root, 'generated-artifacts/masarak-icons-preview.png');
  execFileSync('magick', [
    output, '-font', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '-fill', '#193C3B', '-pointsize', '16', ...labels, output,
  ]);
}
async function main() {
  const checkOnly = process.argv.includes('--check');
  const bytes = await fs.readFile(path.join(root, sourcePath));
  const source = await Jimp.read(bytes);
  assert.equal(source.bitmap.width, 1280);
  assert.equal(source.bitmap.height, 1280);
  source.scan(0, 0, 1280, 1280, (x, y, i) => {
    if (isArtwork(...source.bitmap.data.subarray(i, i + 3))) {
      assert.ok(x >= crop.x && x < crop.x + crop.width && y >= crop.y && y < crop.y + crop.height,
        'Cropping must not remove any colored artwork');
    }
  });
  const icon = frame(source, 820);
  const adaptive = frame(source, 540);
  const expected = { icon, adaptive, favicon: icon.clone().resize(64, 64, Jimp.RESIZE_BICUBIC) };
  if (!checkOnly) {
    for (const [name, image] of Object.entries(expected)) await png(image, paths[name]);
    await preview(source, icon, adaptive);
  }
  const config = JSON.parse(await fs.readFile(path.join(root, 'app.json'), 'utf8')).expo;
  assert.equal(config.icon, `./${paths.icon}`);
  assert.equal(config.ios.icon, config.icon);
  assert.equal(config.android.icon, config.icon);
  assert.equal(config.android.adaptiveIcon.foregroundImage, `./${paths.adaptive}`);
  assert.equal(config.android.adaptiveIcon.backgroundColor, '#F1F5F5');
  assert.equal(config.android.adaptiveIcon.backgroundImage, undefined);
  assert.equal(config.android.adaptiveIcon.monochromeImage, undefined);
  assert.equal(config.web.favicon, `./${paths.favicon}`);
  for (const [name, relativePath] of Object.entries(paths)) {
    const data = await fs.readFile(path.join(root, relativePath));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const image = await Jimp.read(data);
    assert.equal(image.bitmap.width, name === 'favicon' ? 64 : 1024);
    assert.equal(image.bitmap.height, image.bitmap.width);
    assert.deepEqual(image.bitmap.data, expected[name].bitmap.data, 'PNG pixels must match the source-derived image');
    let artworkPixels = 0;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, i) => {
      assert.equal(image.bitmap.data[i + 3], 255, 'All installed icon assets must be opaque');
      if (isArtwork(...image.bitmap.data.subarray(i, i + 3))) {
        artworkPixels++;
        if (name === 'adaptive') {
          // The central 66dp disk within the 108dp layer is the safe area.
          assert.ok(Math.hypot(x - 511.5, y - 511.5) < 1024 * 33 / 108, 'Artwork must fit the adaptive safe disk');
        }
      }
    });
    assert.ok(artworkPixels > 0, 'Asset must contain the original artwork');
    console.log(`${relativePath}: PNG ${image.bitmap.width}x${image.bitmap.height}, opaque, source pixels verified`);
  }
  console.log(`Original JPG SHA-256: ${crypto.createHash('sha256').update(bytes).digest('hex')}`);
  console.log('Adaptive artwork is inside the safe disk. Icon config and paths verified.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
