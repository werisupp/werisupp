/**
 * article.js
 * 転職準備サポート「うぇりサポ」— 記事ページ共通スクリプト
 *
 * 機能一覧:
 *  1. 目次（TOC）の自動生成         — h2/h3 を走査して #toc-container に挿入
 *  2. スクロールスパイ               — 現在表示中の見出しをTOCでハイライト
 *  3. 読書進捗バー                   — ページ上部に細い進捗バーを表示
 *  4. スムーズスクロール             — TOCリンクのクリックで滑らかにスクロール
 *  5. ヘッダー高さ補正               — sticky-headerの高さを scroll-padding-top に反映
 *  6. コードブロック コピーボタン    — .content-wrapper 内の <pre><code> に自動追加
 *  7. 外部リンク処理                 — .content-wrapper 内の外部リンクを安全に開く
 *  8. 画像ライトボックス             — クリックで拡大表示（記事内 img 対応）
 */

(function () {
  'use strict';

  /* ================================================================
   * 定数 / 設定
   * ================================================================ */
  const HEADER_SELECTOR      = '.site-header';
  const TOC_CONTAINER_ID     = 'toc-container';
  const CONTENT_SELECTOR     = '.content-wrapper';
  const HEADING_SELECTORS    = 'h2, h3';          // TOC対象の見出しレベル
  const SCROLL_OFFSET_EXTRA  = 16;                // px — スクロール先の追加余白
  const SCROLL_SPY_THRESHOLD = 0.25;              // 見出し上端がvpの25%に入ったらアクティブ
  const PROGRESS_BAR_ID      = 'reading-progress-bar';
  const DEBOUNCE_MS          = 50;

  /* ================================================================
   * ユーティリティ
   * ================================================================ */

  /**
   * デバウンス — 高頻度イベント（scroll/resize）の制御
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx  = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /**
   * テキストから URL-safe なスラグを生成
   * 日本語はそのまま残し、半角スペースをハイフンに変換
   * @param {string} text
   * @returns {string}
   */
  function toSlug(text) {
    return text
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[<>[\]{}|\\^`"']/g, '')
      .toLowerCase();
  }

  /**
   * 要素の id が空の場合は自動付与する
   * 衝突回避のためカウンタをサフィックスとして追加
   * @param {Element} el
   * @param {Object} usedIds — 使用済みIDのカウンタ辞書 { id: count }
   * @returns {string} 確定したID
   */
  function ensureId(el, usedIds) {
    if (el.id) return el.id;

    var base  = toSlug(el.textContent || 'section');
    var slug  = base;
    var count = 0;

    while (usedIds[slug]) {
      count++;
      slug = base + '-' + count;
    }
    usedIds[slug] = true;
    el.id = slug;
    return slug;
  }

  /* ================================================================
   * 1. 目次（TOC）自動生成
   * ================================================================ */
  function buildTOC() {
    var container = document.getElementById(TOC_CONTAINER_ID);
    if (!container) return;

    var content = document.querySelector(CONTENT_SELECTOR);
    if (!content) {
      container.closest('.table-of-contents').style.display = 'none';
      return;
    }

    var headings = content.querySelectorAll(HEADING_SELECTORS);
    if (!headings || headings.length === 0) {
      container.closest('.table-of-contents').style.display = 'none';
      return;
    }

    // h2/h3 が1つ以下なら目次を非表示
    if (headings.length <= 1) {
      container.closest('.table-of-contents').style.display = 'none';
      return;
    }

    var usedIds = {};
    var nav     = document.createElement('nav');
    nav.setAttribute('aria-label', '目次');

    var rootList = document.createElement('ol');
    rootList.className = 'toc-list toc-list-root';

    var currentH2Item = null;
    var subList       = null;

    headings.forEach(function (heading) {
      // バックボタン・CTAバナー見出しなどは除外
      if (heading.closest('.back-button')    ||
          heading.closest('.cta-banner')     ||
          heading.closest('.article-navigation')) {
        return;
      }

      var id   = ensureId(heading, usedIds);
      var text = heading.textContent.trim();
      var tag  = heading.tagName.toUpperCase();

      var li   = document.createElement('li');
      li.className = 'toc-item toc-item-' + tag.toLowerCase();

      var a    = document.createElement('a');
      a.href        = '#' + id;
      a.textContent = text;
      a.className   = 'toc-link';
      a.setAttribute('data-toc-id', id);

      // クリックでスムーズスクロール
      a.addEventListener('click', function (e) {
        e.preventDefault();
        scrollToHeading(id);
        // URLのハッシュを更新（historyを汚さない）
        if (history.replaceState) {
          history.replaceState(null, '', '#' + id);
        }
      });

      li.appendChild(a);

      if (tag === 'H2') {
        currentH2Item = li;
        subList       = null;
        rootList.appendChild(li);
      } else if (tag === 'H3') {
        if (!currentH2Item) {
          // h2 がない場合はルートに追加
          rootList.appendChild(li);
        } else {
          if (!subList) {
            subList = document.createElement('ol');
            subList.className = 'toc-list toc-list-sub';
            currentH2Item.appendChild(subList);
          }
          subList.appendChild(li);
        }
      }
    });

    nav.appendChild(rootList);
    container.appendChild(nav);
  }

  /* ================================================================
   * 2. スクロールスパイ（アクティブ見出しハイライト）
   * ================================================================ */
  var tocLinks    = [];
  var headingEls  = [];

  function initScrollSpy() {
    var content = document.querySelector(CONTENT_SELECTOR);
    if (!content) return;

    headingEls = Array.from(content.querySelectorAll(HEADING_SELECTORS)).filter(function (h) {
      return h.id &&
        !h.closest('.back-button') &&
        !h.closest('.cta-banner') &&
        !h.closest('.article-navigation');
    });

    tocLinks = Array.from(document.querySelectorAll('.toc-link'));
    if (!tocLinks.length || !headingEls.length) return;

    window.addEventListener('scroll', debounce(updateScrollSpy, DEBOUNCE_MS), { passive: true });
    updateScrollSpy();
  }

  function updateScrollSpy() {
    if (!headingEls.length) return;

    var scrollTop    = window.scrollY || window.pageYOffset;
    var vpHeight     = window.innerHeight || document.documentElement.clientHeight;
    var headerHeight = getHeaderHeight();
    var threshold    = headerHeight + vpHeight * SCROLL_SPY_THRESHOLD;

    var activeId = null;

    // 現在ビューポートに入っている、または通過済みの最後の見出しを探す
    for (var i = headingEls.length - 1; i >= 0; i--) {
      var top = headingEls[i].getBoundingClientRect().top + scrollTop;
      if (scrollTop + threshold >= top) {
        activeId = headingEls[i].id;
        break;
      }
    }

    // フォールバック：ページ最上部ならば最初の見出し
    if (!activeId && headingEls.length) {
      activeId = headingEls[0].id;
    }

    tocLinks.forEach(function (link) {
      var isActive = link.getAttribute('data-toc-id') === activeId;
      link.classList.toggle('toc-link--active', isActive);
      link.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  /* ================================================================
   * 3. 読書進捗バー
   * ================================================================ */
  function initProgressBar() {
    var bar = document.createElement('div');
    bar.id            = PROGRESS_BAR_ID;
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    bar.setAttribute('aria-label', '読書の進捗');

    // スタイルをインラインで適用（CSSに依存しない最低限の保証）
    Object.assign(bar.style, {
      position:        'fixed',
      top:             '0',
      left:            '0',
      width:           '0%',
      height:          '3px',
      background:      'var(--color-primary, #005BAC)',
      zIndex:          '9999',
      pointerEvents:   'none',
      transition:      'width 100ms linear',
    });

    document.body.appendChild(bar);

    window.addEventListener('scroll', debounce(updateProgressBar, DEBOUNCE_MS), { passive: true });
    updateProgressBar();
  }

  function updateProgressBar() {
    var bar = document.getElementById(PROGRESS_BAR_ID);
    if (!bar) return;

    var scrollTop  = window.scrollY || window.pageYOffset;
    var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    var progress   = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;

    bar.style.width = progress + '%';
    bar.setAttribute('aria-valuenow', progress);
  }

  /* ================================================================
   * 4. スムーズスクロール
   * ================================================================ */

  /**
   * 指定IDの見出しまでスムーズスクロールする
   * スティッキーヘッダーの高さを考慮してオフセットを計算
   * @param {string} id
   */
  function scrollToHeading(id) {
    var target = document.getElementById(id);
    if (!target) return;

    var headerHeight = getHeaderHeight();
    var targetTop    = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
    var scrollTo     = targetTop - headerHeight - SCROLL_OFFSET_EXTRA;

    // prefers-reduced-motion を尊重
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top:      Math.max(0, scrollTo),
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  }

  /**
   * サイトヘッダーの現在の高さを取得（動的に変化する場合に対応）
   * @returns {number} px
   */
  function getHeaderHeight() {
    var header = document.querySelector(HEADER_SELECTOR);
    return header ? header.offsetHeight : 0;
  }

  /* ================================================================
   * 5. ヘッダー高さの scroll-padding-top 反映
   * ================================================================ */
  function syncScrollPadding() {
    var height = getHeaderHeight();
    document.documentElement.style.setProperty(
      'scroll-padding-top',
      (height + SCROLL_OFFSET_EXTRA) + 'px'
    );
  }

  function initScrollPadding() {
    syncScrollPadding();
    window.addEventListener('resize', debounce(syncScrollPadding, 100));
  }

  /* ================================================================
   * 6. コードブロック コピーボタン
   * ================================================================ */
  function initCodeCopy() {
    var content = document.querySelector(CONTENT_SELECTOR);
    if (!content) return;

    var codeBlocks = content.querySelectorAll('pre');
    if (!codeBlocks.length) return;

    codeBlocks.forEach(function (pre) {
      // すでにラップされていたらスキップ
      if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var btn = document.createElement('button');
      btn.className   = 'code-copy-btn';
      btn.textContent = 'コピー';
      btn.setAttribute('aria-label', 'コードをクリップボードにコピー');
      btn.type = 'button';

      btn.addEventListener('click', function () {
        var code = pre.querySelector('code');
        var text = code ? code.textContent : pre.textContent;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showCopyFeedback(btn, '✓ コピー完了');
          }).catch(function () {
            fallbackCopy(text, btn);
          });
        } else {
          fallbackCopy(text, btn);
        }
      });

      wrapper.appendChild(btn);
    });
  }

  function showCopyFeedback(btn, message) {
    var original = btn.textContent;
    btn.textContent = message;
    btn.classList.add('code-copy-btn--copied');
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('code-copy-btn--copied');
    }, 2000);
  }

  function fallbackCopy(text, btn) {
    var ta    = document.createElement('textarea');
    ta.value  = text;
    ta.style.position = 'absolute';
    ta.style.opacity  = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showCopyFeedback(btn, '✓ コピー完了');
    } catch (e) {
      showCopyFeedback(btn, '手動でコピーしてください');
    }
    document.body.removeChild(ta);
  }

  /* ================================================================
   * 7. 外部リンク処理
   *    .content-wrapper 内の外部リンクに target="_blank" rel="noopener noreferrer" を追加
   *    外部リンクには視覚的なアイコンを付与
   * ================================================================ */
  function processExternalLinks() {
    var content = document.querySelector(CONTENT_SELECTOR);
    if (!content) return;

    var links = content.querySelectorAll('a[href]');
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;

      // 外部リンクの判定：http/https で始まり、自サイトのドメインでないもの
      var isExternal = /^https?:\/\//i.test(href) &&
        !href.includes(window.location.hostname);

      if (isExternal) {
        if (!link.target) {
          link.setAttribute('target', '_blank');
        }
        if (!link.rel || !link.rel.includes('noopener')) {
          link.setAttribute('rel', 'noopener noreferrer');
        }

        // 外部リンクアイコン（SVG inline、スクリーンリーダーには非表示）
        if (!link.querySelector('.external-link-icon')) {
          var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          icon.setAttribute('viewBox', '0 0 24 24');
          icon.setAttribute('width', '12');
          icon.setAttribute('height', '12');
          icon.setAttribute('fill', 'none');
          icon.setAttribute('stroke', 'currentColor');
          icon.setAttribute('stroke-width', '2');
          icon.setAttribute('aria-hidden', 'true');
          icon.classList.add('external-link-icon');
          icon.style.cssText = 'display:inline-block;margin-left:2px;vertical-align:middle;opacity:0.6;flex-shrink:0;';
          icon.innerHTML = '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
                           '<polyline points="15,3 21,3 21,9"/>' +
                           '<line x1="10" y1="14" x2="21" y2="3"/>';
          link.appendChild(icon);
          link.setAttribute('aria-label',
            (link.textContent.replace(/\s+/g, ' ').trim() || '外部リンク') + '（新しいタブで開く）'
          );
        }
      }
    });
  }

  /* ================================================================
   * 8. 画像ライトボックス
   *    .content-wrapper 内の img をクリックで拡大表示
   * ================================================================ */
  var lightbox     = null;
  var lightboxImg  = null;
  var lightboxOpen = false;

  function initLightbox() {
    var content = document.querySelector(CONTENT_SELECTOR);
    if (!content) return;

    var images = content.querySelectorAll('img:not(.no-lightbox)');
    if (!images.length) return;

    // ライトボックス DOM を生成（1度だけ）
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id          = 'article-lightbox';
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-label', '画像を拡大表示しています');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.tabIndex    = -1;
      lightbox.style.cssText = [
        'display:none',
        'position:fixed',
        'inset:0',
        'z-index:10000',
        'background:rgba(0,0,0,0.88)',
        'cursor:zoom-out',
        'align-items:center',
        'justify-content:center',
        'padding:16px',
      ].join(';');

      lightboxImg = document.createElement('img');
      lightboxImg.alt   = '';
      lightboxImg.style.cssText = [
        'max-width:100%',
        'max-height:90vh',
        'object-fit:contain',
        'border-radius:4px',
        'box-shadow:0 8px 40px rgba(0,0,0,0.6)',
        'cursor:default',
      ].join(';');

      var closeBtn = document.createElement('button');
      closeBtn.textContent  = '✕';
      closeBtn.setAttribute('aria-label', 'ライトボックスを閉じる');
      closeBtn.type  = 'button';
      closeBtn.style.cssText = [
        'position:absolute',
        'top:16px',
        'right:16px',
        'background:rgba(255,255,255,0.15)',
        'color:#fff',
        'border:none',
        'border-radius:50%',
        'width:40px',
        'height:40px',
        'font-size:18px',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'transition:background 180ms ease',
      ].join(';');

      closeBtn.addEventListener('mouseenter', function () {
        closeBtn.style.background = 'rgba(255,255,255,0.3)';
      });
      closeBtn.addEventListener('mouseleave', function () {
        closeBtn.style.background = 'rgba(255,255,255,0.15)';
      });
      closeBtn.addEventListener('click', closeLightbox);

      lightboxImg.addEventListener('click', function (e) {
        e.stopPropagation();
      });

      lightbox.appendChild(lightboxImg);
      lightbox.appendChild(closeBtn);
      document.body.appendChild(lightbox);

      lightbox.addEventListener('click', closeLightbox);

      document.addEventListener('keydown', function (e) {
        if (lightboxOpen && (e.key === 'Escape' || e.key === 'Esc')) {
          closeLightbox();
        }
      });
    }

    images.forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        openLightbox(img.src, img.alt);
      });
      // キーボード操作
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', (img.alt || '画像') + '（クリックで拡大）');
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(img.src, img.alt);
        }
      });
    });
  }

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;

    // prefers-reduced-motion の場合はライトボックスを開かずに別タブで開く
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.open(src, '_blank', 'noopener,noreferrer');
      return;
    }

    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.style.display = 'flex';
    lightboxOpen = true;
    document.body.style.overflow = 'hidden';

    // フォーカスをライトボックスへ移動
    setTimeout(function () {
      lightbox.focus();
    }, 50);
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.style.display = 'none';
    lightboxOpen           = false;
    document.body.style.overflow = '';
  }

  /* ================================================================
   * ページ内ハッシュリンクの初期スクロール補正
   * DOMContentLoaded 時点でURLにハッシュがある場合に補正する
   * ================================================================ */
  function handleInitialHash() {
    var hash = window.location.hash;
    if (!hash) return;

    var id = decodeURIComponent(hash.slice(1));
    var target = document.getElementById(id);
    if (!target) return;

    // ページ読み込み後の一番最初のスクロールを遅延させて補正
    setTimeout(function () {
      scrollToHeading(id);
    }, 200);
  }

  /* ================================================================
   * TOC 用CSS（article.cssが読み込まれていない環境への保険）
   * ================================================================ */
  function injectTOCStyles() {
    // すでに article.css が読み込まれていれば、CSS変数が存在するはず
    // その場合は何もしない
    var root = getComputedStyle(document.documentElement);
    if (root.getPropertyValue('--color-primary').trim()) return;

    // フォールバック用最低限スタイル
    var style = document.createElement('style');
    style.textContent = [
      '.toc-list { list-style: none; margin: 0; padding: 0; }',
      '.toc-list-sub { padding-left: 1rem; margin-top: 0.25rem; }',
      '.toc-link { display: block; padding: 0.25rem 0; color: #005BAC; text-decoration: none; font-size: 0.9rem; }',
      '.toc-link:hover { text-decoration: underline; }',
      '.toc-link--active { color: #003d78; font-weight: 700; }',
      '.toc-item { margin: 0.15rem 0; }',
      '.toc-item-h3 { font-size: 0.85rem; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ================================================================
   * メイン初期化
   * ================================================================ */
  function init() {
    // CSS変数のフォールバック確認
    injectTOCStyles();

    // 1. scroll-padding-top を動的に設定（最初に実行）
    initScrollPadding();

    // 2. TOC 生成
    buildTOC();

    // 3. スクロールスパイ（TOC生成後に初期化）
    initScrollSpy();

    // 4. 読書進捗バー
    initProgressBar();

    // 5. コードブロック コピーボタン
    initCodeCopy();

    // 6. 外部リンク処理
    processExternalLinks();

    // 7. 画像ライトボックス
    initLightbox();

    // 8. 初期ハッシュ補正
    handleInitialHash();
  }

  /* ================================================================
   * DOMContentLoaded で初期化
   * ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // すでに DOM が準備完了している場合（defer以外での読み込み時）
    init();
  }

})();