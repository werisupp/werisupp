// ===== 広告表記（全ページの上部） =====
document.addEventListener('DOMContentLoaded', function () {
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

  // 記事内の外部リンクのクリック
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('main a[href]');
    if (!a || !/^https?:$/.test(a.protocol) || a.hostname === location.hostname) return;
    window.werisuppTrack('outbound_click', { href: a.href, page: location.pathname });
  });
})();

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

  // ===== 2. 目次自動生成 =====
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
    link.textContent = h.textContent.replace(/^[\u25b6\u25b8]\s*/, ''); // ⯀▸ 記号除去
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

});
