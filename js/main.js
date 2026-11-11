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

  // Clicking anywhere outside the open panel closes it, except on things
  // that open another panel or the lights toggle. The press is tracked so a
  // text selection dragged out of the panel doesn't count as outside.
  var pressedInPanel = false;
  document.addEventListener('pointerdown', function (e) {
    pressedInPanel = panel.contains(e.target);
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-open]');
    var startedInside = pressedInPanel;
    pressedInPanel = false;
    if (el) return show(el.getAttribute('data-open'), el);
    if (panel.hidden || startedInside || panel.contains(e.target)) return;
    if (e.target.closest('.lightctl, #weather')) return;
    close();
  });
  document.getElementById('panel-close').addEventListener('click', close);
  backBtn.addEventListener('click', function () { show('projects'); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!lightsMenu.hidden) return toggleLightsMenu(false, true);
    if (!panel.hidden) close();
  });

  var stage = document.getElementById('stage');
  var scene = stage.querySelector('.scene');

  // The artwork is inlined (not an <img>) so the page CSS can animate it
  // and dim it with the lights toggle.
  fetch('scene/porch.svg?v=18')
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (svg) {
      scene.insertAdjacentHTML('afterbegin', svg);
      var art = scene.querySelector('svg');
      // The rain patterns fall via SMIL, which CSS can't stop; pause it here.
      if (art && art.pauseAnimations && window.matchMedia('(prefers-reduced-motion: reduce)').matches) art.pauseAnimations();
      applyPreset();
      loadScore();
    })
    .catch(function () {});

  // Show the welcome only where the scene leaves real room under it;
  // on narrow screens it always sits below the scene.
  var welcome = document.getElementById('welcome');
  var narrow = window.matchMedia('(max-width: 760px)');
  function fitWelcome() {
    var room = narrow.matches || stage.clientHeight - scene.offsetHeight >= 170;
    welcome.hidden = !room;
    stage.classList.toggle('has-welcome', room);
  }
  fitWelcome();
  window.addEventListener('resize', fitWelcome);

  // Christmas decorations go up for December; ?xmas previews them any time.
  if (new Date().getMonth() === 11 || /[?&]xmas\b/.test(location.search)) document.body.classList.add('xmas-on');

  // Every load starts from the bare porch: no open panel, no restored scroll.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // Light control: a footer button that drops up a menu with the on/off
  // switch and the string light colors.
  var lightsMenuBtn = document.getElementById('lights-btn');
  var lightsMenu = document.getElementById('lights-menu');
  function toggleLightsMenu(open, refocus) {
    lightsMenu.hidden = !open;
    lightsMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var picked = lightsMenu.querySelector('.swatch[aria-checked="true"]');
      (picked || lightsMenu.querySelector('button')).focus();
    } else if (refocus) {
      lightsMenuBtn.focus();
    }
  }
  lightsMenuBtn.addEventListener('click', function () { toggleLightsMenu(lightsMenu.hidden); });
  document.addEventListener('click', function (e) {
    if (!lightsMenu.hidden && !e.target.closest('.lightctl')) toggleLightsMenu(false);
  });

  var lightsBtn = document.getElementById('lights');
  var lightsLabel = document.getElementById('lights-label');
  function setLights(on) {
    document.body.classList.toggle('lights-off', !on);
    lightsBtn.setAttribute('aria-checked', on ? 'true' : 'false');
    lightsLabel.textContent = on ? 'String lights on' : 'String lights off';
  }
  setLights(true);
  try { localStorage.removeItem('porch.lights'); } catch (e) {}
  lightsBtn.addEventListener('click', function () {
    setLights(document.body.classList.contains('lights-off'));
  });

  // Rain mode: the moon toggles it, and it comes on by itself when it's
  // actually raining in Charleston (unless the visitor already chose).
  var weatherBtn = document.getElementById('weather');
  var weatherLabel = weatherBtn.querySelector('.hs-label');
  var pickedWeather = false;
  function setRain(on) {
    document.body.classList.toggle('raining', on);
    weatherBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    weatherBtn.setAttribute('aria-label', on ? 'Clouds over the moon: clear the sky' : 'Look at the moon: make it rain');
    weatherLabel.textContent = on ? 'Clear the sky' : 'Make it rain';
  }
  weatherBtn.addEventListener('click', function () {
    pickedWeather = true;
    setRain(!document.body.classList.contains('raining'));
  });
  fetch('https://api.open-meteo.com/v1/forecast?latitude=32.78&longitude=-79.93&current=weather_code')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var code = d && d.current ? d.current.weather_code : -1;
      var wet = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
      if (wet && !pickedWeather) setRain(true);
    })
    .catch(function () {});

  // String light colors. Preset 0 is the original warm Edison look; the rest
  // give each bulb its own halo and tint the porch wash to match.
  var PRESETS = [
    { bulbs: ['#ffd9a3'] },
    { bulbs: ['#f6f2e8'], wash: '#efe6d2' },
    { bulbs: ['#ff6b5a', '#5fd38a', '#5aa8ff', '#ffc85a', '#ff8fd0'], wash: '#ffcf9a' },
    { bulbs: ['#9ff0e4', '#7fd6cf'], wash: '#6fd8cc' },
    { bulbs: ['#ff5a6a', '#f6f1e7'], wash: '#e8737f' },
    { bulbs: ['#ff9a6b', '#ff7fa8', '#ffc46b'], wash: '#ff9d7e' }
  ];
  var WARM = ['#ffbf73', '#e0a45e', '#e0a45e'];
  var SVGNS = 'http://www.w3.org/2000/svg';
  var preset = 0;

  function applyPreset() {
    var svg = scene.querySelector('svg');
    if (!svg) return;
    var p = PRESETS[preset];
    var defs = svg.querySelector('defs');
    svg.querySelectorAll('#pz-warm stop').forEach(function (st, k) {
      st.setAttribute('stop-color', p.wash || WARM[k]);
    });
    p.bulbs.forEach(function (color, i) {
      var g = svg.querySelector('#pz-bulb' + i);
      if (!g) {
        g = document.createElementNS(SVGNS, 'radialGradient');
        g.setAttribute('id', 'pz-bulb' + i);
        [[0, .45], [.45, .15], [1, 0]].forEach(function (o) {
          var st = document.createElementNS(SVGNS, 'stop');
          st.setAttribute('offset', o[0]);
          st.setAttribute('stop-opacity', o[1]);
          g.appendChild(st);
        });
        defs.appendChild(g);
      }
      g.querySelectorAll('stop').forEach(function (st) { st.setAttribute('stop-color', color); });
    });
    svg.querySelectorAll('.lantern').forEach(function (l, n) {
      var i = n % p.bulbs.length;
      l.querySelector('circle').setAttribute('fill', preset === 0 ? 'url(#pz-warm)' : 'url(#pz-bulb' + i + ')');
      l.querySelector('ellipse').setAttribute('fill', p.bulbs[i]);
    });
  }

  var swatches = Array.prototype.slice.call(document.querySelectorAll('.swatch'));
  function pickPreset(i, focus) {
    preset = i;
    swatches.forEach(function (b, k) {
      b.setAttribute('aria-checked', k === i ? 'true' : 'false');
      b.tabIndex = k === i ? 0 : -1;
    });
    if (focus) swatches[i].focus();
    applyPreset();
  }
  swatches.forEach(function (b, k) {
    b.addEventListener('click', function () { pickPreset(k); });
    b.addEventListener('keydown', function (e) {
      var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      pickPreset((k + d + swatches.length) % swatches.length, true);
    });
  });
  pickPreset(0);

  // Gamecocks scoreboard on the ledge: the live game if one is on,
  // otherwise the most recent final (or the next game before the opener).
  var ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/';
  var TEAM_PAGE = 'https://www.espn.com/college-football/team/_/id/2579/south-carolina-gamecocks';
  var scoreLink = document.getElementById('score-link');
  var scoreTimer = null;

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function scoreOf(c) {
    var s = c.score;
    if (s && typeof s === 'object') s = s.displayValue;
    return s == null ? '' : String(s);
  }
  function setText(svg, id, text, max) {
    var el = svg.querySelector('#' + id);
    if (!el) return;
    el.textContent = text;
    el.removeAttribute('textLength');
    if (max && text && el.getComputedTextLength && el.getComputedTextLength() > max) {
      el.setAttribute('textLength', max);
      el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
  }
  // Seven-segment digits: lit segments glow, unlit ones sit dull behind them.
  var SEGS = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
    '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g' };
  var SCORE_X = { 'sb-s1': 166, 'sb-s2': 268 };
  function drawScore(svg, id, text) {
    var g = svg.querySelector('#' + id);
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    var off = document.createElementNS(SVGNS, 'g');
    var on = document.createElementNS(SVGNS, 'g');
    off.setAttribute('fill', '#1c0907');
    on.setAttribute('fill', '#ff4630');
    on.setAttribute('filter', 'url(#sb-ledglow)');
    g.appendChild(off);
    g.appendChild(on);
    var chars = (text.length < 2 ? ('  ' + text).slice(-2) : text).split('');
    var w = chars.length > 2 ? 14 : 20, gap = chars.length > 2 ? 4 : 6, t = chars.length > 2 ? 4 : 5;
    var h = 40, y = 506, half = h / 2;
    var x0 = SCORE_X[id] - (chars.length * w + (chars.length - 1) * gap) / 2;
    chars.forEach(function (ch, n) {
      var x = x0 + n * (w + gap);
      var lit = SEGS[ch] || '';
      var r = {
        a: [x + 3, y, w - 6, t], d: [x + 3, y + h - t, w - 6, t], g: [x + 3, y + half - t / 2, w - 6, t],
        f: [x, y + 3, t, half - 4], b: [x + w - t, y + 3, t, half - 4],
        e: [x, y + half + 1, t, half - 4], c: [x + w - t, y + half + 1, t, half - 4]
      };
      Object.keys(r).forEach(function (k) {
        var el = document.createElementNS(SVGNS, 'rect');
        el.setAttribute('x', r[k][0]);
        el.setAttribute('y', r[k][1]);
        el.setAttribute('width', r[k][2]);
        el.setAttribute('height', r[k][3]);
        el.setAttribute('rx', 1.5);
        (lit.indexOf(k) >= 0 ? on : off).appendChild(el);
      });
    });
  }
  function showBoard(svg, rows, status, live, href, label) {
    for (var k = 0; k < 2; k++) {
      setText(svg, 'sb-t' + (k + 1), rows[k] ? rows[k][0] : '', 90);
      drawScore(svg, 'sb-s' + (k + 1), rows[k] ? rows[k][1] : '');
    }
    setText(svg, 'sb-st', status.toUpperCase(), live ? 170 : 190);
    var dot = svg.querySelector('#sb-live');
    if (dot) dot.classList.toggle('on', live);
    scoreLink.href = href;
    scoreLink.setAttribute('aria-label', 'Gamecocks scoreboard: ' + label + '. Open on ESPN');
  }
  function renderGame(svg, id, comp) {
    var type = comp.status.type;
    var state = type.state;
    var rows = comp.competitors.slice().sort(function (a, b) {
      return (a.homeAway === 'home' ? 0 : 1) - (b.homeAway === 'home' ? 0 : 1);
    }).map(function (c) {
      var pts = scoreOf(c);
      return [c.team.abbreviation, state === 'pre' || pts === '' ? '--' : pts];
    });
    var d = new Date(comp.date);
    var status = state === 'in' ? type.shortDetail
      : state === 'post' ? type.shortDetail + ' ' + (d.getMonth() + 1) + '/' + d.getDate()
      : 'Next ' + type.shortDetail.replace(' - ', ' ').replace(/ [A-Z]{2,4}$/, '');
    var label = rows.map(function (r) { return r[0] + ' ' + r[1]; }).join(', ') + ', ' + status;
    showBoard(svg, rows, status, state === 'in',
      'https://www.espn.com/college-football/game/_/gameId/' + id, label);
    return state;
  }
  function nextScore(ms) {
    clearTimeout(scoreTimer);
    scoreTimer = setTimeout(loadScore, ms);
  }
  function loadScore() {
    var svg = scene.querySelector('svg');
    if (!svg || !svg.querySelector('#scoreboard')) return;
    getJSON(ESPN + 'teams/2579/schedule').then(function (data) {
      var now = Date.now();
      var live = null, last = null, next = null;
      (data.events || []).slice().sort(function (a, b) {
        return Date.parse(a.date) - Date.parse(b.date);
      }).forEach(function (e) {
        var state = e.competitions[0].status.type.state;
        var t = Date.parse(e.date);
        if (state === 'in' || (state === 'pre' && t <= now && now - t < 6 * 3600e3)) live = live || e;
        else if (state === 'post') last = e;
        else if (state === 'pre' && !next) next = e;
      });
      if (live) {
        return getJSON(ESPN + 'summary?event=' + live.id).then(function (s) {
          renderGame(svg, live.id, s.header.competitions[0]);
          nextScore(60e3);
        });
      }
      var pick = last || next;
      if (pick) renderGame(svg, pick.id, pick.competitions[0]);
      else showBoard(svg, [['SC', '--']], 'Off season', false, TEAM_PAGE, 'off season');
      nextScore(10 * 60e3);
    }).catch(function () {
      showBoard(svg, [['SC', '--']], 'No signal', false, TEAM_PAGE, 'score unavailable');
      nextScore(5 * 60e3);
    });
  }
})();
