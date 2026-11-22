// Sets the theme before the first paint. Saved on this device only.
(function () {
  var m = matchMedia('(prefers-color-scheme: dark)');
  window.finTheme = function () {
    var t = 'system';
    try { t = localStorage.getItem('fin-theme') || 'system'; } catch (e) { /* private window */ }
    document.documentElement.dataset.theme = t === 'system' ? (m.matches ? 'dark' : 'light') : t;
    return t;
  };
  window.finTheme();
  m.addEventListener('change', window.finTheme);
})();
