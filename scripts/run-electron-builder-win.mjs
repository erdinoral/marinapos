/**
 * Windows electron-builder wrapper.
 * Proje kokundeki npm.bat / npx.bat, bosluklu yolda electron-builder'in
 * `npm list` cagrisini kirar (which yerel .bat'i bulur, shell spawn kirilir).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hideNames = ['npm.bat', 'npx.bat'];
const hidden = [];

function hideLocalNpmShims() {
  for (const name of hideNames) {
    const src = path.join(root, name);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(root, `.${name}.pack-hide`);
    if (fs.existsSync(dst)) fs.unlinkSync(dst);
    fs.renameSync(src, dst);
    hidden.push({ src, dst });
  }
}

function restoreLocalNpmShims() {
  for (const { src, dst } of hidden.splice(0)) {
    if (fs.existsSync(dst)) fs.renameSync(dst, src);
  }
  for (const name of hideNames) {
    const src = path.join(root, name);
    const dst = path.join(root, `.${name}.pack-hide`);
    if (!fs.existsSync(src) && fs.existsSync(dst)) {
      fs.renameSync(dst, src);
    }
  }
}

const nodeDir =
  process.env.MARINA_NODE_DIR ||
  (process.platform === 'win32' ? 'C:\\Program Files\\nodejs' : '');
const ebCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
const args = process.argv.slice(2);
if (args.length === 0) {
  args.push('--win', '--config.npmRebuild=false');
}

const env = { ...process.env };
delete env.npm_config_devdir;
delete env.NPM_CONFIG_DEVDIR;
if (nodeDir) {
  const system32 = path.join(env.SystemRoot || 'C:\\Windows', 'System32');
  env.PATH = `${nodeDir}${path.delimiter}${system32}${path.delimiter}${env.PATH || ''}`;
}

hideLocalNpmShims();
let exitCode = 1;
try {
  const cachePrep = spawnSync(process.execPath, [path.join(root, 'scripts', 'ensure-win-codesign-cache.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: false,
  });
  if (cachePrep.status !== 0) {
    exitCode = cachePrep.status ?? 1;
  } else {
    const result = spawnSync(process.execPath, [ebCli, ...args], {
      cwd: root,
      stdio: 'inherit',
      env,
      shell: false,
    });
    exitCode = result.status ?? 1;
  }
} finally {
  restoreLocalNpmShims();
}
process.exit(exitCode);
