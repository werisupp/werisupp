// 記事の本文が変わっていないことを確かめるスクリプト（設計書 §8-3）。
// 使い方: node tests/text-compare.mjs [--base <git ref>] [file ...]
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);
// 中身ごと消すタグ
const DROP_TAGS = new Set(['script', 'style', 'template']);
// 「一覧に戻る」を含む <a> を消す
const BACK_LINK_TEXT = '一覧に戻る';
// final-cta の中で消すリンクの href（一覧・STEPへの導線）
const CTA_STEP_HREF = /^(\.\/)?(index|step\d+)\.html$/;

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

// 簡単な字句解析で木にする。閉じタグが対応しない場合は、開いている中で最も近い同名タグまで閉じる。
function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[i] === '<' && /[!?]/.test(html[i + 1] || '')) {
      const end = html.indexOf('>', i);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    const close = /^<\/([a-zA-Z][^\s>\/]*)[^>]*>/.exec(html.slice(i, i + 200));
    if (close) {
      const name = close[1].toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === name) {
          stack.length = k;
          break;
        }
      }
      i += close[0].length;
      continue;
    }
    const open = /^<([a-zA-Z][^\s>\/]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/.exec(html.slice(i));
    if (open) {
      const name = open[1].toLowerCase();
      const raw = open[2];
      const selfClose = raw.trimEnd().endsWith('/');
      const node = { tag: name, attrs: parseAttrs(selfClose ? raw.trimEnd().slice(0, -1) : raw), children: [] };
      top().children.push(node);
      i += open[0].length;
      if (RAW_TEXT.has(name) && !selfClose) {
        const m = new RegExp(`</${name}\\s*>`, 'i').exec(html.slice(i));
        i = m ? i + m.index + m[0].length : html.length;
      } else if (!VOID.has(name) && !selfClose) {
        stack.push(node);
      }
      continue;
    }
    let next = html.indexOf('<', i + 1);
    if (next < 0) next = html.length;
    top().children.push({ text: html.slice(i, next) });
    i = next;
  }
  return root;
}

const hasClass = (node, cls) => (node.attrs.class || '').split(/\s+/).includes(cls);

function findAll(node, pred, out = []) {
  for (const c of node.children || []) {
    if (c.text !== undefined) continue;
    if (pred(c)) out.push(c);
    else findAll(c, pred, out);
  }
  return out;
}

function findFirst(node, tag) {
  for (const c of node.children || []) {
    if (c.text !== undefined) continue;
    if (c.tag === tag) return c;
    const r = findFirst(c, tag);
    if (r) return r;
  }
  return null;
}

function plainText(node) {
  if (node.text !== undefined) return node.text;
  return node.children.map(plainText).join('');
}

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// タグの境目は空白に置き換える（<br> と <span> の付け替えなど、見た目だけの差を拾わないため）。
function collect(node, ctx, out) {
  if (node.text !== undefined) {
    out.push(node.text);
    return;
  }
  if (DROP_TAGS.has(node.tag) || 'data-ui' in node.attrs) {
    out.push(' ');
    return;
  }
  if (node.attrs.id === 'toc-container') {
    out.push(' ');
    return;
  }
  if (node.tag === 'a') {
    if (plainText(node).includes(BACK_LINK_TEXT)) {
      out.push(' ');
      return;
    }
    if (ctx.finalCta && CTA_STEP_HREF.test(node.attrs.href || '')) {
      out.push(' ');
      return;
    }
  }
  const inner = node.tag === 'section' && hasClass(node, 'final-cta') ? { ...ctx, finalCta: true } : ctx;
  out.push(' ');
  for (const c of node.children) collect(c, inner, out);
  out.push(' ');
}

export function extractArticleText(html) {
  const root = parse(html);
  let scopes = findAll(root, (n) => (n.tag === 'header' && hasClass(n, 'step-header')) || n.tag === 'main');
  if (scopes.length === 0) scopes = [findFirst(root, 'body') || root];
  const out = [];
  for (const s of scopes) {
    for (const c of s.children) collect(c, { finalCta: false }, out);
    out.push(' ');
  }
  return decode(out.join('')).replace(/\s+/g, ' ').trim();
}

export function compareHtml(beforeHtml, afterHtml) {
  const before = extractArticleText(beforeHtml);
  const after = extractArticleText(afterHtml);
  if (before === after) return { ok: true };
  let index = 0;
  const len = Math.min(before.length, after.length);
  while (index < len && before[index] === after[index]) index++;
  const from = Math.max(0, index - 40);
  return {
    ok: false,
    index,
    before: before.slice(from, index + 40),
    after: after.slice(from, index + 40),
  };
}

function defaultFiles(root) {
  const list = readdirSync(root).filter((f) => f === 'index.html' || f === 'about.html' || /^step\d+\.html$/.test(f));
  list.sort((a, b) => {
    const n = (f) => (/^step(\d+)/.exec(f) ? Number(RegExp.$1) : -1);
    return n(a) - n(b) || a.localeCompare(b);
  });
  const tools = readdirSync(join(root, 'tool')).filter((f) => f.endsWith('.html')).sort();
  return [...list, ...tools.map((f) => `tool/${f}`)];
}

function main(argv) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let base = 'origin/main';
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') base = argv[++i];
    else files.push(argv[i]);
  }
  const targets = files.length ? files : defaultFiles(root);
  let failed = 0;
  for (const f of targets) {
    let beforeHtml;
    try {
      beforeHtml = execFileSync('git', ['show', `${base}:${f}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      console.error(`NG: ${f}  ${base} に存在しないか読めません`);
      failed++;
      continue;
    }
    const r = compareHtml(beforeHtml, readFileSync(join(root, f), 'utf8'));
    if (!r.ok) {
      console.error(`NG: ${f}  位置 ${r.index}\n  前: ${r.before}\n  後: ${r.after}`);
      failed++;
    }
  }
  if (failed) {
    console.error(`${failed} / ${targets.length} files differ`);
    process.exit(1);
  }
  console.log(`OK: ${targets.length} files`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
