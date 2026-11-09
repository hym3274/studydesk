import { build, mergeConfig, loadConfigFromFile } from 'vite';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';

// Keep the ordinary Pages build unchanged. Bundle lazy routes into one script
// so file:// does not need module loading, fetch, or a local web server.
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Vite configuration not found');
await build(mergeConfig(loaded.config, {
  configFile: false,
  publicDir: false,
  build: {
    outDir: 'dist-standalone',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: {
      format: 'iife', inlineDynamicImports: true,
      entryFileNames: 'bundle.js', assetFileNames: '[name][extname]',
    } },
  },
}));
let html = await readFile('dist-standalone/index.html', 'utf8');
const js = await readFile('dist-standalone/bundle.js', 'utf8');
const files = await readdir('dist-standalone');
const css = (await Promise.all(files.filter(name => name.endsWith('.css'))
  .map(name => readFile(`dist-standalone/${name}`, 'utf8')))).join('\n');
const favicon = await readFile('public/favicon.svg');
const license = await readFile('public/fonts/OFL-NotoSansJP.txt', 'utf8');
html = html.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/g, '')
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, '')
  .replace(/href="\.\/favicon.svg"/, `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`)
  .replace('</head>', () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>\n</head>`)
  .replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);
html += `\n<!-- Bundled Noto Sans JP license\n${license.replace(/-->/g, '-- >')}\n-->\n`;
// Fail if the output could still depend on a companion asset.
if (/<(?:script|link)\b[^>]*(?:src|href)="(?!data:)[^"]+"/i.test(html)
  || /url\((?!["']?data:)/i.test(css)) throw new Error('Standalone output contains external assets');
await mkdir('downloads', { recursive: true });
await writeFile('downloads/desk.html', html);
console.log(`Standalone HTML: downloads/desk.html (${Buffer.byteLength(html)} bytes)`);
