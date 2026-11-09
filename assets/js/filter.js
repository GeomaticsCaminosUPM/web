// Client-side filtering: text search (#q) + research-line buttons (.filters button).
// Works on every element with class "item"; hides empty ".js-sec" sections.
(function () {
  [].forEach.call(document.querySelectorAll('.lang a'), function (a) {
    a.addEventListener('click', function () { try { localStorage.setItem('lang', a.dataset.lang); } catch (e) {} });
  });
  var items = [].slice.call(document.querySelectorAll('.item'));
  var q = document.getElementById('q');
  var btns = [].slice.call(document.querySelectorAll('.filters button'));
  var empty = document.querySelector('.empty[hidden]');
  if (!q && !btns.length) return;
  var line = '';
  function apply() {
    var term = q ? q.value.trim().toLowerCase() : '', shown = 0;
    items.forEach(function (el) {
      var ok = (!line || (el.dataset.lines || '').split(' ').indexOf(line) > -1) &&
               (!term || el.textContent.toLowerCase().indexOf(term) > -1);
      el.hidden = !ok; if (ok) shown++;
    });
    [].forEach.call(document.querySelectorAll('.js-sec'), function (s) {
      s.hidden = !s.querySelector('.item:not([hidden])');
    });
    btns.forEach(function (b) { b.classList.toggle('on', b.dataset.filter === line); });
    if (empty) empty.hidden = shown > 0;
  }
  if (q) q.addEventListener('input', apply);
  btns.forEach(function (b) { b.addEventListener('click', function () { line = b.dataset.filter; apply(); }); });
  line = new URLSearchParams(location.search).get('line') || '';
  apply();
})();
