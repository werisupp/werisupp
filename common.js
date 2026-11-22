// ===== STEP の一覧（メニュー・位置表示・次のSTEP はすべてここから組み立てる） =====
// 題名と所要時間は index.html の一覧（.step-title・.step-duration）と同じにする（tests/common-nav.test.mjs で確かめる）。
// ready は本文が公開済みかどうか。STEP を公開するときに窓口が true にする。
var WERISUPP_STEPS = [
  { n: 1,  title: '転職するためのマインドセットをする', phase: 'mind', duration: '～10分', ready: true },
  { n: 2,  title: '仕事より転職活動の優先度を上げる', phase: 'mind', duration: '～10分', ready: true },
  { n: 3,  title: '転職サービスに登録する', phase: 'prep', duration: '～1時間', ready: true },
  { n: 4,  title: 'キャリア情報を完成させる', phase: 'prep', duration: '～6時間', ready: true },
  { n: 5,  title: '転職活動で必要なモノ・環境を揃える', phase: 'prep', duration: '～24時間', ready: true },
  { n: 6,  title: '転職の軸を明確にする', phase: 'prep', duration: '～2時間', ready: true },
  { n: 7,  title: 'キャリア情報をブラッシュアップする（繰り返し）', phase: 'prep', duration: '～24時間（繰り返し）', ready: true },
  { n: 8,  title: '求人を探す or オファーを待つ（繰り返し）', phase: 'action', duration: '～10時間（繰り返し）', ready: true },
  { n: 9,  title: '求人に応募する（繰り返し）', phase: 'action', duration: '～2時間（繰り返し）', ready: true },
  { n: 10, title: '提出書類を作成する（繰り返し）', phase: 'action', duration: '～40時間（繰り返し）', ready: true },
  { n: 11, title: '面接準備（共通）（繰り返し）', phase: 'action', duration: '～1時間（繰り返し）', ready: true },
  { n: 12, title: '面接準備（各応募企業）（繰り返し）', phase: 'action', duration: '～20時間（繰り返し）', ready: false },
  { n: 13, title: '面接をする（繰り返し）', phase: 'action', duration: '～40時間（繰り返し）', ready: false },
  { n: 14, title: '内定承諾判断（繰り返し）', phase: 'action', duration: '～7日間（繰り返し）', ready: false },
  { n: 15, title: '内定承諾', phase: 'action', duration: '-', ready: false },
  { n: 16, title: '退職手続き', phase: 'exit', duration: '退職規定による', ready: false }
];

var WERISUPP_PHASES = [
  { key: 'mind', label: 'マインドセット', from: 1, to: 2 },
  { key: 'prep', label: '準備', from: 3, to: 7 },
  { key: 'action', label: '活動', from: 8, to: 15 },
  { key: 'exit', label: '終了', from: 16, to: 16 }
];

// 続きから読むための記録（このブラウザの localStorage だけに保存し、どこにも送らない）
var WERISUPP_PROGRESS_KEY = 'werisupp.progress.v1';

function circled(n) {
  return String.fromCharCode(0x2460 + n - 1);
}

function findStep(n) {
  for (var i = 0; i < WERISUPP_STEPS.length; i++) {
    if (WERISUPP_STEPS[i].n === n) return WERISUPP_STEPS[i];
  }
  return null;
}

function findPhase(key) {
  for (var i = 0; i < WERISUPP_PHASES.length; i++) {
    if (WERISUPP_PHASES[i].key === key) return WERISUPP_PHASES[i];
  }
  return null;
}

// ページの種類と、サイトのルート（common.js の置き場所）への相対パス。
// Cloudflare Pages は「.html」を省いた URL（/step3、/tool/）で配信するので、どちらの形も受け付ける。
function pageInfo(pathname, scriptSrcPath) {
  var rootDir = scriptSrcPath.slice(0, scriptSrcPath.lastIndexOf('/') + 1);
  var rel = pathname.indexOf(rootDir) === 0 ? pathname.slice(rootDir.length) : pathname.replace(/^\//, '');
  var depth = rel.split('/').length - 1;
  var root = depth > 0 ? new Array(depth + 1).join('../') : './';
  var m = rel.match(/^step(\d+)(?:\.html)?$/);
  if (m && findStep(Number(m[1]))) return { kind: 'step', step: Number(m[1]), root: root };
  if (rel === '' || /^index(?:\.html)?$/.test(rel)) return { kind: 'map', step: null, root: root };
  if (/^about(?:\.html)?$/.test(rel)) return { kind: 'about', step: null, root: root };
  if (/^tool\//.test(rel)) return { kind: 'tool', step: null, root: root };
  return { kind: 'other', step: null, root: root };
}

function neighbors(n) {
  return { prev: findStep(n - 1), next: findStep(n + 1) };
}

function readProgress(storage) {
  var empty = { visited: [], last: null };
  try {
    var data = JSON.parse(storage.getItem(WERISUPP_PROGRESS_KEY));
    if (!data || typeof data !== 'object') return empty;
    var visited = [];
    (Array.isArray(data.visited) ? data.visited : []).forEach(function (n) {
      if (findStep(n) && visited.indexOf(n) === -1) visited.push(n);
    });
    return { visited: visited, last: findStep(data.last) ? data.last : null };
  } catch (e) {
    return empty;
  }
}

function recordVisit(storage, n) {
  var progress = readProgress(storage);
  if (progress.visited.indexOf(n) === -1) progress.visited.push(n);
  progress.last = n;
  try {
    storage.setItem(WERISUPP_PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) { /* 保存できない環境でも表示は続ける */ }
  return progress;
}

if (typeof document !== 'undefined') {

  // ===== 広告表記（全ページの上部） =====
  // 作り替えたページは HTML に固定で置いてある（JavaScript が動かなくても出るように）。無いページだけ作る
  document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('.site-pr-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'site-pr-banner';
    banner.textContent = '当サイトはアフィリエイト広告（PR）を利用しています';
    document.body.insertBefore(banner, document.body.firstChild);
  });

  // ===== 計測の口 =====
  (function () {
    // TODO: 独自ドメイン決定後に窓口が設定（本番ドメインのときだけ true を返す）
    function isProductionHost(hostname) {
      return false;
    }

    // 今は何も送らない。送信先の解析サービスが決まったら、この中で送る。
    window.werisuppTrack = function (name, data) {
      if (!isProductionHost(location.hostname)) return;
    };

    // data-track 属性を持つ要素のクリック（data-track-◯◯ は送る値。数字は数として送る）
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-track]');
      if (!el) return;
      var data = {};
      Object.keys(el.dataset).forEach(function (key) {
        var m = key.match(/^track(.+)$/);
        if (!m) return;
        var v = el.dataset[key];
        data[m[1].charAt(0).toLowerCase() + m[1].slice(1)] = /^\d+$/.test(v) ? Number(v) : v;
      });
      window.werisuppTrack(el.dataset.track, data);
    });

    // 記事内の外部リンクのクリック
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('main a[href]');
      if (!a || !/^https?:$/.test(a.protocol) || a.hostname === location.hostname) return;
      window.werisuppTrack('outbound_click', { href: a.href, page: location.pathname });
    });
  })();

  // ===== 導線（ヘッダー・メニュー・位置表示・次のSTEP・続きから読む） =====
  (function () {
    // defer で読み込まれている間だけ currentScript が取れるので、ここで控えておく
    var script = document.currentScript || document.querySelector('script[src*="common.js"]');
    var scriptPath = script ? new URL(script.src, location.href).pathname : '/common.js';

    function getStorage() {
      try { return window.localStorage; } catch (e) { return null; }
    }

    // el('a', { class: 'x', href: '…' }, [子要素や文字])
    function el(tag, attrs, children) {
      var node = document.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
      (children || []).forEach(function (c) {
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
      return node;
    }

    function stepLabel(n) {
      return 'STEP ' + circled(n);
    }

    function buildDrawer(info, progress) {
      var root = info.root;
      function navLink(href, text, current) {
        var a = el('a', { class: 'site-drawer-link', href: root + href }, [text]);
        if (current) a.setAttribute('aria-current', 'page');
        return el('li', {}, [a]);
      }

      var drawer = el('nav', { id: 'site-drawer', class: 'site-drawer', 'aria-label': 'メニュー' });
      drawer.appendChild(el('ul', { class: 'site-drawer-links' }, [
        navLink('index.html', '全体マップ', info.kind === 'map'),
        navLink('tool/index.html', '無料ツール', info.kind === 'tool')
      ]));

      WERISUPP_PHASES.forEach(function (phase) {
        var ol = el('ol', { class: 'site-drawer-steps' });
        WERISUPP_STEPS.forEach(function (s) {
          if (s.phase !== phase.key) return;
          var body = [el('span', { class: 'n' }, [circled(s.n)]), el('span', { class: 't' }, [s.title])];
          var item;
          if (s.ready) {
            item = el('a', { class: 'site-drawer-step', href: root + 'step' + s.n + '.html' }, body);
            if (info.step === s.n) item.setAttribute('aria-current', 'page');
            if (progress.visited.indexOf(s.n) !== -1) {
              item.classList.add('is-visited');
              item.appendChild(el('span', { class: 'visually-hidden' }, ['（開いたことがあります）']));
            }
          } else {
            body.push(el('small', { class: 'site-drawer-pending' }, ['準備中']));
            item = el('span', { class: 'site-drawer-step is-pending' }, body);
          }
          ol.appendChild(el('li', {}, [item]));
        });
        drawer.appendChild(el('div', { class: 'site-drawer-phase' }, [
          el('p', { class: 'site-drawer-phase-label' }, [phase.label]),
          ol
        ]));
      });

      drawer.appendChild(el('ul', { class: 'site-drawer-links' }, [
        navLink('about.html', '運営者情報', info.kind === 'about')
      ]));
      return drawer;
    }

    function setupChrome(info, progress) {
      var menuBtn = el('button', {
        type: 'button', class: 'site-menu-btn', 'aria-expanded': 'false', 'aria-controls': 'site-drawer'
      }, [el('span', { class: 'site-menu-icon', 'aria-hidden': 'true' }), 'メニュー']);
      var header = el('header', { class: 'site-header' }, [
        el('a', { class: 'site-logo', href: info.root + 'index.html' }, ['うぇりサポ']),
        menuBtn
      ]);
      var drawer = buildDrawer(info, progress);
      var overlay = el('div', { class: 'site-drawer-overlay' });

      // ヘッダー → 広告表記 の順に並べる
      document.body.insertBefore(header, document.body.firstChild);
      var banner = document.querySelector('.site-pr-banner');
      if (banner) document.body.insertBefore(banner, header.nextSibling);
      document.body.appendChild(drawer);
      document.body.appendChild(overlay);

      function isOpen() { return menuBtn.getAttribute('aria-expanded') === 'true'; }
      function open() {
        menuBtn.setAttribute('aria-expanded', 'true');
        drawer.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.classList.add('has-drawer-open');
        var first = drawer.querySelector('a');
        if (first) first.focus();
      }
      function close() {
        if (!isOpen()) return;
        menuBtn.setAttribute('aria-expanded', 'false');
        drawer.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.classList.remove('has-drawer-open');
        menuBtn.focus();
      }
      function toggle() { if (isOpen()) close(); else open(); }

      menuBtn.addEventListener('click', toggle);
      overlay.addEventListener('click', close);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });

      // 広い画面では左に常に表示する
      var wide = window.matchMedia('(min-width: 1080px)');
      function applyPinned() {
        if (wide.matches) close();
        document.body.classList.toggle('has-drawer-pinned', wide.matches);
      }
      applyPinned();
      if (wide.addEventListener) wide.addEventListener('change', applyPinned);
      else if (wide.addListener) wide.addListener(applyPinned);
    }

    // 記事の上部: 進み具合の棒・「STEP 3 / 16 ・ 準備」・所要時間の目安
    function setupStepHeader(step) {
      var content = document.querySelector('.step-header-content');
      if (!content) return;
      var bar = el('div', { class: 'step-progress', 'aria-hidden': 'true' });
      WERISUPP_STEPS.forEach(function (s) {
        bar.appendChild(el('i', { class: s.n < step.n ? 'is-done' : s.n === step.n ? 'is-current' : '' }));
      });
      var phase = findPhase(step.phase);
      var label = el('p', { class: 'step-label' }, [
        'STEP ' + step.n + ' / ' + WERISUPP_STEPS.length + (phase ? ' ・ ' + phase.label : '')
      ]);
      content.insertBefore(label, content.firstChild);
      content.insertBefore(bar, label);

      if (step.duration && step.duration !== '-') {
        var time = el('p', { class: 'step-time' }, ['目安 ' + step.duration]);
        var meta = content.querySelector('.step-meta');
        content.insertBefore(time, meta ? meta.nextSibling : null);
      }
    }

    // 記事の下部: 次のSTEP のカード1つと、小さく「前のSTEPに戻る・全体マップ」
    function setupStepNext(step, root) {
      var near = neighbors(step.n);
      var next = near.next;
      var card;
      if (!next) {
        card = el('a', { class: 'step-next-card', href: root + 'index.html', 'data-track': 'step_next', 'data-track-from': String(step.n) }, [
          el('small', {}, ['すべてのSTEP']),
          el('span', { class: 'step-next-title' }, ['全体マップに戻る'])
        ]);
      } else if (next.ready) {
        card = el('a', {
          class: 'step-next-card', href: root + 'step' + next.n + '.html',
          'data-track': 'step_next', 'data-track-from': String(step.n), 'data-track-to': String(next.n)
        }, [
          el('small', {}, ['次のSTEP ' + circled(next.n)]),
          el('span', { class: 'step-next-title' }, [next.title])
        ]);
      } else {
        card = el('div', { class: 'step-next-card is-pending' }, [
          el('small', {}, ['次のSTEP ' + circled(next.n)]),
          el('span', { class: 'step-next-title' }, [stepLabel(next.n) + ' は準備中です'])
        ]);
      }

      var sub = el('p', { class: 'step-next-sub' });
      if (near.prev && near.prev.ready) {
        sub.appendChild(el('a', { href: root + 'step' + near.prev.n + '.html' }, ['← ' + stepLabel(near.prev.n) + ' に戻る']));
      }
      if (next) sub.appendChild(el('a', { href: root + 'index.html' }, ['全体マップ']));

      var nav = el('nav', { class: 'step-next', 'aria-label': '次に読むSTEP' }, [card]);
      if (sub.childNodes.length) nav.appendChild(sub);

      var place = document.querySelector('section.final-cta') ||
        document.querySelector('.content-wrapper') || document.querySelector('main');
      if (place) place.appendChild(nav);
    }

    // 全体マップの上部: 「STEP ① から始める」か「前回の続き」
    function setupMapResume(progress, root) {
      var wrapper = document.querySelector('main .content-wrapper');
      if (!wrapper) return;
      var last = findStep(progress.last);
      var box;
      if (last && last.ready) {
        box = el('div', { class: 'map-resume' }, [
          el('a', { class: 'map-resume-link', href: root + 'step' + last.n + '.html', 'data-track': 'map_resume', 'data-track-to': String(last.n) }, [
            el('small', {}, ['前回の続き']),
            el('span', {}, [stepLabel(last.n) + ' ' + last.title])
          ])
        ]);
      } else {
        box = el('div', { class: 'map-resume' }, [
          el('a', { class: 'map-resume-link is-start', href: root + 'step1.html', 'data-track': 'map_start' }, [stepLabel(1) + ' から始める'])
        ]);
      }
      wrapper.insertBefore(box, wrapper.firstChild);
    }

    // 目次の折りたたみ（スマホでは最初は閉じておく）
    function setupTocToggle() {
      var toc = document.querySelector('.table-of-contents');
      if (!toc) return;
      var heading = toc.querySelector('h2, h3');
      var list = toc.querySelector('.toc-list');
      if (!heading || !list) return;
      var count = list.querySelectorAll(':scope > li').length;
      var body = list.closest('#toc-container') || list;
      if (!body.id) body.id = 'toc-body';

      var expanded = !window.matchMedia('(max-width: 767px)').matches;
      var btn = el('button', {
        type: 'button', class: 'toc-toggle', 'aria-expanded': String(expanded), 'aria-controls': body.id
      }, [heading.textContent + '（' + count + '項目）']);
      heading.textContent = '';
      heading.appendChild(btn);
      toc.classList.toggle('is-collapsed', !expanded);
      btn.addEventListener('click', function () {
        var nowOpen = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(nowOpen));
        toc.classList.toggle('is-collapsed', !nowOpen);
      });
    }

    function buildToc() {
      var tocContainer = document.getElementById('toc-container');
      if (!tocContainer) return;

      // .section 内の h2 / h3 / h4 を取得
      var headings = document.querySelectorAll('.section h2, .section h3, .section h4');
      if (headings.length === 0) return;

      // id がなければ自動付与
      headings.forEach(function (h, i) {
        if (!h.id) h.id = 'heading-' + i;
      });

      var ul = document.createElement('ul');
      ul.className = 'toc-list';

      var currentH2Li = null;
      var currentH3Ul = null;
      var currentH3Li = null;
      var currentH4Ul = null;

      headings.forEach(function (h) {
        var tag  = h.tagName.toUpperCase();
        var link = document.createElement('a');
        link.href = '#' + h.id;
        link.textContent = h.textContent.replace(/^[▶▸]\s*/, ''); // ⯀▸ 記号除去
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var target = document.getElementById(h.id);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        var li = document.createElement('li');

        if (tag === 'H2') {
          link.className = 'toc-link-h2';
          li.appendChild(link);
          ul.appendChild(li);
          currentH2Li   = li;
          currentH3Ul   = null;
          currentH3Li   = null;
          currentH4Ul   = null;

        } else if (tag === 'H3') {
          link.className = 'toc-link-h3';
          li.appendChild(link);
          if (!currentH3Ul) {
            currentH3Ul = document.createElement('ul');
            currentH3Ul.className = 'toc-sub-list';
            (currentH2Li || ul).appendChild(currentH3Ul);
          }
          currentH3Ul.appendChild(li);
          currentH3Li  = li;
          currentH4Ul  = null;

        } else if (tag === 'H4') {
          link.className = 'toc-link-h4';
          li.appendChild(link);
          if (!currentH4Ul) {
            currentH4Ul = document.createElement('ul');
            currentH4Ul.className = 'toc-sub-sub-list';
            (currentH3Li || currentH2Li || ul).appendChild(currentH4Ul);
          }
          currentH4Ul.appendChild(li);
        }
      });

      tocContainer.appendChild(ul);
    }

    // tool/tool-ui.js（module）は DOMContentLoaded より前に古いサイドバーへ処理を付けるので、
    // 古い要素を外すのは DOMContentLoaded の中で行う
    document.addEventListener('DOMContentLoaded', function () {

      // ===== 1. Google Drive 画像 URL 変換 =====
      document.querySelectorAll('img').forEach(function (img) {
        var src = img.getAttribute('src') || '';
        var m1 = src.match(/drive\.google\.com\/open\?id=([^&]+)/);
        var m2 = src.match(/drive\.google\.com\/file\/d\/([^/]+)/);
        var id = (m1 && m1[1]) || (m2 && m2[1]);
        if (id) {
          img.src = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000';
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.display = 'block';
        }
      });

      // ===== 2. 導線 =====
      var info = pageInfo(location.pathname, scriptPath);
      var storage = getStorage();
      var step = info.kind === 'step' ? findStep(info.step) : null;
      var progress = step && step.ready ? recordVisit(storage, step.n) : readProgress(storage);

      setupChrome(info, progress);
      if (step) {
        setupStepHeader(step);
        if (step.ready) setupStepNext(step, info.root);
      }
      if (info.kind === 'map') setupMapResume(progress, info.root);

      // ===== 3. 目次自動生成 =====
      buildToc();
      setupTocToggle();
    });
  })();
}

if (typeof module !== 'undefined') {
  module.exports = {
    WERISUPP_STEPS: WERISUPP_STEPS,
    WERISUPP_PHASES: WERISUPP_PHASES,
    WERISUPP_PROGRESS_KEY: WERISUPP_PROGRESS_KEY,
    circled: circled,
    pageInfo: pageInfo,
    neighbors: neighbors,
    readProgress: readProgress,
    recordVisit: recordVisit
  };
}
