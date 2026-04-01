// Google Drive画像URLを直接表示用URLに自動変換する共通スクリプト
// 対応形式:
//   https://drive.google.com/open?id=XXXX&usp=drive_fs
//   https://drive.google.com/file/d/XXXX/view
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('img').forEach(function (img) {
    var src = img.getAttribute('src') || '';
    var m1 = src.match(/drive\.google\.com\/open\?id=([^&]+)/);
    var m2 = src.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    var id = (m1 && m1[1]) || (m2 && m2[1]);
    if (id) {
      img.src = 'https://drive.google.com/uc?export=view&id=' + id;
    }
  });
});
