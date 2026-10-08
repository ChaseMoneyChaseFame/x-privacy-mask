import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'extension/manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) throw new Error('manifest_version 必须为 3');
if (!manifest.permissions?.includes('storage')) throw new Error('缺少 storage 权限');
if (manifest.permissions.some((permission) => !['storage'].includes(permission))) {
  throw new Error(`存在超出最小范围的权限：${manifest.permissions.join(', ')}`);
}
if (manifest.host_permissions.some((pattern) => !/^https:\/\/(x\.com|twitter\.com)\/\*$/.test(pattern))) {
  throw new Error(`存在超出范围的 host permission：${manifest.host_permissions.join(', ')}`);
}

const sourceFiles = ['background.js', 'content.js', 'shared.js', 'popup.js'];
for (const file of sourceFiles) {
  const source = await readFile(resolve(root, 'extension', file), 'utf8');
  if (/https?:\/\/(?!x\.com|twitter\.com)/.test(source)) {
    throw new Error(`${file} 包含非 X 域名网络地址`);
  }
}

console.log('扩展静态校验通过：Manifest V3、最小权限、无第三方网络地址。');
