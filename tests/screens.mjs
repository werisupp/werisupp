// 画面の確認: 各ページをスマホ幅（375×812）とPC幅（1280×900）で開き、ページ全体のスクリーンショットを撮る。
// 375px で横にはみ出す（document.documentElement.scrollWidth > 375）ページがあれば、名前を出して exit 1。
//
// 使い方:
//   npm i --no-save playwright@1.58   （リポジトリには入れない。node_modules/ は .gitignore 済み）
//   node tests/screens.mjs [file ...] [--out <dir>] [--nojs]
//     file   既定は index.html step*.html about.html tool/*.html
//     --out  画像の保存先（既定は一時フォルダの werisupp-shots）
//     --nojs JavaScript を止めて撮る（ファイル名の末尾に -nojs が付く）
//
// ページはこのスクリプトの中の小さな Web サーバーから開く。外部への通信（YouTube など）は止める。
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SIZES = [
  { name: '375', width: 375, height: 812 },
  { name: '1280', width: 1280, height: 900 },
];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function parseArgs(argv) {
  const files = [];
  let out = join(tmpdir(), 'werisupp-shots');
  let nojs = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--nojs') nojs = true;
    else files.push(argv[i]);
  }
  return { files, out: resolve(out), nojs };
}

async function defaultFiles() {
  const top = (await readdir(ROOT)).filter((f) => f === 'index.html' || f === 'about.html' || /^step\d+\.html$/.test(f));
  top.sort((a, b) => (parseInt(a.slice(4), 10) || 0) - (parseInt(b.slice(4), 10) || 0));
  const tool = existsSync(join(ROOT, 'tool'))
    ? (await readdir(join(ROOT, 'tool'))).filter((f) => f.endsWith('.html')).map((f) => `tool/${f}`)
    : [];
  return [...top, ...tool];
}

function startServer() {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(ROOT, path));
    if (!file.startsWith(ROOT.replace(/[\\/]$/, '') + sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = args.files.length ? args.files : await defaultFiles();
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Playwright がありません。先に `npm i --no-save playwright@1.58` を実行してください。');
    process.exit(2);
  }

  await mkdir(args.out, { recursive: true });
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const overflow = [];
  const errors = [];

  try {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        javaScriptEnabled: !args.nojs,
      });
      await context.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
      for (const file of files) {
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${file} (${size.name}px): ${e.message}`));
        await page.goto(`${origin}/${file}`, { waitUntil: 'load' });
        const shot = join(args.out, `${file.replace(/[\\/]/g, '_').replace(/\.html$/, '')}-${size.name}${args.nojs ? '-nojs' : ''}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        if (size.width === 375) {
          const result = await page.evaluate(() => {
            const width = document.documentElement.scrollWidth;
            // はみ出している要素を探す（直す場所の手がかり）
            const wide = [...document.querySelectorAll('body *')]
              .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
              .filter((el) => !el.closest('[class*="drawer"]'))
              .slice(0, 5)
              .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
            return { width, wide };
          });
          if (result.width > 375) overflow.push(`${file}: scrollWidth=${result.width} (${result.wide.join(', ')})`);
        }
        console.log(shot);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (errors.length) {
    console.error('\nページの JavaScript でエラーが出ました:');
    errors.forEach((e) => console.error('  ' + e));
  }
  if (overflow.length) {
    console.error('\n375px で横にはみ出しているページ:');
    overflow.forEach((o) => console.error('  ' + o));
  }
  if (errors.length || overflow.length) process.exit(1);
  console.log(`\nOK: ${files.length} files × ${SIZES.length} sizes`);
}

main();
