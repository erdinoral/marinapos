/**
 * winCodeSign-2.6.0.7z icindeki symlink'ler Windows'ta (admin olmadan) acilamaz.
 * Zip kaynagindan onbellege kopyalayinca electron-builder tekrar indirmez.
 * @see https://github.com/electron-userland/electron-builder/issues/8149
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cacheRoot = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'electron-builder',
  'Cache',
  'winCodeSign',
);
const targetDir = path.join(cacheRoot, 'winCodeSign-2.6.0');
const marker = path.join(targetDir, 'rcedit-x64.exe');

if (fs.existsSync(marker)) {
  process.exit(0);
}

const zipUrl =
  'https://github.com/electron-userland/electron-builder-binaries/archive/refs/tags/winCodeSign-2.6.0.zip';
const zipPath = path.join(os.tmpdir(), 'winCodeSign-2.6.0-src.zip');
const extractRoot = path.join(os.tmpdir(), 'winCodeSign-2.6.0-src');

console.log('[winCodeSign] Onbellek hazirlaniyor (symlink sorunu onlemi)...');

fs.mkdirSync(cacheRoot, { recursive: true });
if (fs.existsSync(extractRoot)) {
  fs.rmSync(extractRoot, { recursive: true, force: true });
}

const curl = spawnSync(
  'curl.exe',
  ['-fsSL', zipUrl, '-o', zipPath],
  { stdio: 'inherit', shell: false },
);
if (curl.status !== 0) {
  console.error('[winCodeSign] Indirme basarisiz:', zipUrl);
  process.exit(curl.status ?? 1);
}

const expand = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractRoot.replace(/'/g, "''")}' -Force`,
  ],
  { stdio: 'inherit', shell: false },
);
if (expand.status !== 0) {
  console.error('[winCodeSign] Zip acilamadi');
  process.exit(expand.status ?? 1);
}

const entries = fs.readdirSync(extractRoot);
const repoDir = entries
  .map((name) => path.join(extractRoot, name))
  .find((p) => fs.statSync(p).isDirectory() && path.basename(p).includes('winCodeSign'));
const srcDir = repoDir ? path.join(repoDir, 'winCodeSign') : null;

if (!srcDir || !fs.existsSync(srcDir)) {
  console.error('[winCodeSign] Zip icinde winCodeSign klasoru bulunamadi');
  process.exit(1);
}

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.cpSync(srcDir, targetDir, { recursive: true });

fs.rmSync(extractRoot, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });

if (!fs.existsSync(marker)) {
  const files = fs.readdirSync(targetDir);
  console.error('[winCodeSign] Beklenen dosyalar yok. Icerik:', files.slice(0, 10).join(', '));
  process.exit(1);
}

console.log('[winCodeSign] Hazir:', targetDir);
