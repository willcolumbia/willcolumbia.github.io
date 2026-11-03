(function () {
  var panel = document.getElementById('panel');
  var pathEl = document.getElementById('panel-path');
  var backBtn = document.getElementById('panel-back');
  var hint = document.getElementById('hint');
  var views = panel.querySelectorAll('.view');
  var opener = null;

  function show(name, fromEl) {
    var target = null;
    views.forEach(function (v) {
      var match = v.getAttribute('data-view') === name;
      v.hidden = !match;
      if (match) target = v;
    });
    if (!target) return close();
    if (fromEl && panel.hidden) opener = fromEl;
    panel.hidden = false;
    hint.hidden = true;
    document.body.classList.add('panel-open');
    pathEl.textContent = target.getAttribute('data-path');
    backBtn.hidden = name.indexOf('projects/') !== 0;
    panel.scrollTop = 0;
    panel.focus({ preventScroll: true });
  }

  function close() {
    panel.hidden = true;
    hint.hidden = false;
    document.body.classList.remove('panel-open');
    views.forEach(function (v) { v.hidden = true; });
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-open]');
    if (el) show(el.getAttribute('data-open'), el);
  });
  document.getElementById('panel-close').addEventListener('click', close);
  backBtn.addEventListener('click', function () { show('projects'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) close();
  });

  // Show the welcome only where the scene leaves real room under it;
  // on narrow screens it always sits below the scene.
  var stage = document.getElementById('stage');
  var scene = stage.querySelector('.scene');
  var welcome = document.getElementById('welcome');
  var narrow = window.matchMedia('(max-width: 760px)');
  function fitWelcome() {
    var room = narrow.matches || stage.clientHeight - scene.offsetHeight >= 170;
    welcome.hidden = !room;
    stage.classList.toggle('has-welcome', room);
  }
  fitWelcome();
  window.addEventListener('resize', fitWelcome);

  // Every load starts from the bare porch: no open panel, no restored scroll.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  var lightsBtn = document.getElementById('lights');
  var lightsLabel = document.getElementById('lights-label');
  function setLights(on) {
    document.body.classList.toggle('lights-off', !on);
    lightsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    lightsLabel.textContent = on ? 'String lights on' : 'String lights off';
  }
  setLights(true);
  try { localStorage.removeItem('porch.lights'); } catch (e) {}
  lightsBtn.addEventListener('click', function () {
    setLights(document.body.classList.contains('lights-off'));
  });
})();
