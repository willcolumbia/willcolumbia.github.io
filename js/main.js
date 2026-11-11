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
    if (e.target.closest('.lightctl, #weather, #bottle-btn')) return;
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
  fetch('scene/porch.svg?v=28')
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (svg) {
      scene.insertAdjacentHTML('afterbegin', svg);
      var art = scene.querySelector('svg');
      // The rain patterns fall via SMIL, which CSS can't stop; pause it here.
      if (art && art.pauseAnimations && window.matchMedia('(prefers-reduced-motion: reduce)').matches) art.pauseAnimations();
      applyPreset();
      loadScore();
      startTurkey();
      updateRace();
      loadRunLog();
      startBottle();
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

  // Thanksgiving garland for November, Christmas lights for December;
  // ?thanksgiving or ?xmas previews either one any time.
  var month = new Date().getMonth();
  if (month === 10 || /[?&]thanksgiving\b/.test(location.search)) document.body.classList.add('autumn-on');
  if (month === 11 || /[?&]xmas\b/.test(location.search)) document.body.classList.add('xmas-on');

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
  // One click toggles the rain; five quick clicks start a meteor shower instead.
  var moonClicks = 0, moonTimer = null;
  weatherBtn.addEventListener('click', function () {
    moonClicks++;
    clearTimeout(moonTimer);
    if (moonClicks >= 5) {
      moonClicks = 0;
      meteorShower();
      return;
    }
    moonTimer = setTimeout(function () {
      moonClicks = 0;
      pickedWeather = true;
      setRain(!document.body.classList.contains('raining'));
    }, 350);
  });
  fetch('https://api.open-meteo.com/v1/forecast?latitude=32.78&longitude=-79.93&current=weather_code')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var code = d && d.current ? d.current.weather_code : -1;
      var wet = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
      if (wet && !pickedWeather) setRain(true);
    })
    .catch(function () {});

  // November turkey: pops out from behind something, hangs around a few
  // seconds, ducks back out of sight and turns up somewhere else.
  // x/y = where his feet go, s = size, f = facing (1 right, -1 left),
  // dx/dy = where he slides in from, clip = what's visible (hides him
  // behind the ledge, a post, the desk, the server or the bottom edge).
  var TURKEY_SPOTS = [
    { x: 500, y: 597, s: 1, f: 1, dx: 0, dy: 66, clip: [0, 0, 1600, 597] },
    { x: 1250, y: 597, s: 1, f: -1, dx: 0, dy: 66, clip: [0, 0, 1600, 597] },
    { x: 1484, y: 738, s: 1.1, f: -1, dx: 64, dy: 0, clip: [0, 0, 1506, 900] },
    { x: 118, y: 742, s: 1.1, f: 1, dx: -64, dy: 0, clip: [94, 0, 1506, 900] },
    { x: 720, y: 930, s: 1.4, f: 1, dx: 0, dy: 100, clip: [0, 0, 1600, 900] },
    { x: 1426, y: 892, s: 1.1, f: -1, dx: 60, dy: 0, clip: [0, 0, 1448, 900] },
    { x: 440, y: 694, s: .9, f: 1, dx: 0, dy: 60, clip: [0, 0, 1600, 690] },
    { x: 1096, y: 694, s: .9, f: -1, dx: 0, dy: 60, clip: [0, 0, 1600, 690] }
  ];
  function startTurkey() {
    var svg = scene.querySelector('svg');
    var slide = svg && svg.querySelector('#turkey-slide');
    if (!slide || !document.body.classList.contains('autumn-on')) return;
    var pos = svg.querySelector('#turkey-pos');
    var clip = svg.querySelector('#tk-clip rect');
    var gobble = svg.querySelector('#turkey-gobble');
    var say = svg.querySelector('#tk-say');
    var bubble = svg.querySelector('#tk-bubble');
    var tail = svg.querySelector('#tk-tail');
    // He takes turns giving away the porch's easter eggs, with a gobble now and then.
    var HINTS = ['TYPE GAMECOCKS FOR A SURPRISE!', 'CLICK THE MOON 5 TIMES FAST!', 'CLICK THE MOON TO MAKE IT RAIN',
      'WATCH THE WATER FOR A BOTTLE', 'TRY THE KONAMI CODE!', 'GOBBLE!'];
    var hintAt = 0;
    function speak(p, text) {
      say.textContent = text;
      var w = say.getComputedTextLength ? say.getComputedTextLength() : text.length * 11;
      var half = w / 2 + 14;
      var headX = p.x + p.f * 16 * p.s;
      var cx = Math.max(half + 8, Math.min(1592 - half, p.x + p.f * 30 * p.s));
      var tx = Math.max(-half + 14, Math.min(half - 18, headX - cx));
      bubble.setAttribute('x', -half);
      bubble.setAttribute('width', half * 2);
      tail.setAttribute('points', (tx - 7) + ',12 ' + (tx + 7) + ',12 ' + (tx - 3 * p.f) + ',24');
      gobble.setAttribute('transform', 'translate(' + cx.toFixed(1) + ' ' + (p.y - 72 * p.s - 22).toFixed(1) + ')');
    }
    var last = -1;
    function away(p) { return 'translate(' + p.dx + 'px,' + p.dy + 'px)'; }
    function visit() {
      var i;
      do { i = Math.floor(Math.random() * TURKEY_SPOTS.length); } while (i === last);
      last = i;
      var p = TURKEY_SPOTS[i];
      slide.style.transition = 'none';
      slide.style.transform = away(p);
      pos.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ') scale(' + (p.f * p.s) + ' ' + p.s + ')');
      gobble.setAttribute('opacity', '0');
      clip.setAttribute('x', p.clip[0]);
      clip.setAttribute('y', p.clip[1]);
      clip.setAttribute('width', p.clip[2]);
      clip.setAttribute('height', p.clip[3]);
      slide.style.visibility = 'visible';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          slide.style.transition = 'transform .6s cubic-bezier(.2,.9,.3,1.25)';
          slide.style.transform = 'translate(0px,0px)';
        });
      });
      var line = HINTS[hintAt++ % HINTS.length];
      var stay = line === 'GOBBLE!' ? 3200 + Math.random() * 1500 : 5200 + Math.random() * 1200;
      setTimeout(function () { speak(p, line); gobble.setAttribute('opacity', '1'); }, 800);
      setTimeout(function () { gobble.setAttribute('opacity', '0'); }, stay - 300);
      setTimeout(function () {
        slide.style.transition = 'transform .45s ease-in';
        slide.style.transform = away(p);
        setTimeout(function () {
          slide.style.visibility = 'hidden';
          setTimeout(visit, 4000 + Math.random() * 7000);
        }, 500);
      }, stay);
    }
    setTimeout(visit, 2500);
  }

  // Race countdown on the calendar pinned to the screen (by calendar day).
  var RACE_DAY = Date.UTC(2026, 11, 12);
  function updateRace() {
    var svg = scene.querySelector('svg');
    var big = svg && svg.querySelector('#race-days');
    if (!big) return;
    var label = svg.querySelector('#race-label');
    var t = new Date();
    var days = Math.round((RACE_DAY - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
    big.removeAttribute('textLength');
    big.setAttribute('font-size', days > 0 ? 34 : 22);
    if (days > 1) { big.textContent = days; label.textContent = 'DAYS TO GO'; }
    else if (days === 1) { big.textContent = '1'; label.textContent = 'DAY TO GO'; }
    else if (days === 0) { big.textContent = 'GO!'; label.textContent = 'RACE DAY'; }
    else { big.textContent = 'DONE'; label.textContent = 'FINISHED'; }
  }

  // Run log clipboard: Strava totals synced on the homelab and served at
  // status.willcolumbia.me/runs.json; data/runs.json is the fallback.
  // Run log in the Training panel: last 4 runs from Strava, synced on the
  // homelab and served at status.willcolumbia.me/runs.json (data/runs.json
  // is the fallback).
  function loadRunLog() {
    var list = document.getElementById('runs-list');
    function json(url) { return fetch(url).then(function (r) { if (!r.ok) throw r.status; return r.json(); }); }
    function md(iso) { var d = new Date(iso + 'T12:00:00'); return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate(); }
    json('https://status.willcolumbia.me/runs.json').then(function (d) {
      if (d.status !== 'ok' && d.status !== 'stale') throw d.status;
      return d;
    }).catch(function () { return json('data/runs.json?v=28'); }).then(function (d) {
      var runs = (d && d.recent) || [];
      list.textContent = '';
      if (!runs.length) {
        var none = document.createElement('p');
        none.className = 'subtle';
        none.textContent = 'No runs synced yet.';
        list.appendChild(none);
      }
      runs.forEach(function (run) {
        var e = document.createElement('div');
        e.className = 'entry';
        [['when', md(run.date)],
         ['role', (+run.mi).toFixed(1) + ' mi'],
         ['where', [run.pace && run.pace + ' /mi', run.time, run.elev_ft != null && run.elev_ft + ' ft climb'].filter(Boolean).join(' \u00b7 ')]
        ].forEach(function (part) {
          var span = document.createElement('span');
          span.className = part[0];
          span.textContent = part[1];
          e.appendChild(span);
        });
        list.appendChild(e);
      });
      if (d && d.week_mi != null) {
        document.getElementById('rt-week').textContent = d.week_mi.toFixed(1) + ' mi';
        document.getElementById('rt-month').textContent = d.four_week_mi.toFixed(1) + ' mi over ' + d.runs_4wk + ' runs';
        document.getElementById('runs-totals').hidden = false;
      }
    }).catch(function () {
      list.textContent = 'Couldn\'t reach the run log right now.';
    });
  }

  // Secret: type "gamecocks" (or the Konami code) and the string lights
  // chase garnet and black, the laptop shows the Gamecocks logo, and
  // media/audio/gameday.mp3 plays if that file is there.
  var cheering = false;
  var cheerAudio = null;
  function goCocks() {
    var svg = scene.querySelector('svg');
    if (!svg || cheering) return;
    cheering = true;
    document.body.classList.add('cheering');
    try {
      cheerAudio = cheerAudio || new Audio('media/audio/gameday.mp3');
      cheerAudio.currentTime = 0;
      cheerAudio.volume = .6;
      var playing = cheerAudio.play();
      if (playing && playing.catch) playing.catch(function () {});
    } catch (e) {}
    var defs = svg.querySelector('defs');
    var g = svg.querySelector('#pz-cheer');
    if (!g) {
      g = document.createElementNS(SVGNS, 'radialGradient');
      g.setAttribute('id', 'pz-cheer');
      [[0, .55], [.45, .2], [1, 0]].forEach(function (o) {
        var st = document.createElementNS(SVGNS, 'stop');
        st.setAttribute('offset', o[0]);
        st.setAttribute('stop-opacity', o[1]);
        st.setAttribute('stop-color', '#ff2b3b');
        g.appendChild(st);
      });
      defs.appendChild(g);
    }
    svg.querySelectorAll('#pz-warm stop').forEach(function (st) { st.setAttribute('stop-color', '#c41e3a'); });
    var lanterns = svg.querySelectorAll('.lantern');
    var board = svg.querySelector('#sb-st');
    var boardText = board ? board.textContent : '';
    if (board) board.textContent = 'GO COCKS!';
    var frame = 0;
    var timer = setInterval(function () {
      lanterns.forEach(function (l, n) {
        var on = (n + frame) % 2 === 0;
        l.querySelector('circle').setAttribute('fill', on ? 'url(#pz-cheer)' : 'none');
        l.querySelector('ellipse').setAttribute('fill', on ? '#ff2b3b' : '#1a1414');
      });
      frame++;
    }, 320);
    setTimeout(function () {
      clearInterval(timer);
      cheering = false;
      document.body.classList.remove('cheering');
      if (cheerAudio) cheerAudio.pause();
      if (board && board.textContent === 'GO COCKS!') board.textContent = boardText;
      applyPreset();
    }, 9000);
  }
  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var konamiAt = 0, typed = '';
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiAt = k === KONAMI[konamiAt] ? konamiAt + 1 : (k === KONAMI[0] ? 1 : 0);
    if (konamiAt === KONAMI.length) { konamiAt = 0; goCocks(); }
    if (k.length === 1) {
      typed = (typed + k).slice(-9);
      if (typed === 'gamecocks') { typed = ''; goCocks(); }
    }
  });

  // Secret: five quick clicks on the moon set off a meteor shower.
  var showerTimer = null;
  function meteorShower() {
    var svg = scene.querySelector('svg');
    var g = svg && svg.querySelector('#meteor-shower');
    if (!g) return;
    if (document.body.classList.contains('raining')) setRain(false);
    var html = '';
    for (var i = 0; i < 28; i++) {
      html += '<g transform="translate(' + Math.round(200 + Math.random() * 1350) + ' ' + Math.round(20 + Math.random() * 260) + ')">' +
        '<g class="meteor-once" style="animation-delay:' + (Math.random() * 4.5).toFixed(2) + 's;animation-duration:' + (.8 + Math.random() * .6).toFixed(2) + 's">' +
        '<path d="M0 0 l90 -45" stroke="url(#pz-meteor)" stroke-width="1.6" stroke-linecap="round"/><circle r="1.6" fill="#fff"/></g></g>';
    }
    g.innerHTML = html;
    clearTimeout(showerTimer);
    showerTimer = setTimeout(function () { g.innerHTML = ''; }, 7000);
  }

  // Secret: a message in a bottle drifts past now and then. Click it for a note.
  var FACTS = [
    'I helped coach Riverside High School to its fifth straight 5A state title in the 2024-25 season.',
    'My home server runs 13 Docker containers, including the chess app you can find under Projects.',
    'This whole porch is drawn by hand in SVG, from the string lights down to the floorboards.',
    'I\'m training for the Kiawah Island Half Marathon on December 12.',
    'I managed Greer Event Rentals for four and a half years, before and during college.',
    'I was a computer science teaching assistant at USC for a year and a half.',
    'My chess app lets you play against the Stockfish engine and learn standard openings.',
    'When I\'m not working, you\'ll probably find me at a Gamecock football game or on a golf course.',
    'The scoreboard on the ledge pulls the real Gamecocks score, live on game days.'
  ];
  var lastFact = -1;
  var bottleBtn = document.getElementById('bottle-btn');
  var bottleNote = document.getElementById('bottle-note');
  function readBottle() {
    var i;
    do { i = Math.floor(Math.random() * FACTS.length); } while (i === lastFact);
    lastFact = i;
    bottleNote.textContent = FACTS[i];
  }
  bottleBtn.addEventListener('click', function () {
    readBottle();
    show('bottle', bottleBtn);
  });
  document.getElementById('bottle-again').addEventListener('click', readBottle);
  function placeBottle(b, x, y) {
    b.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
    bottleBtn.style.left = ((x - 22) / 16) + '%';
    bottleBtn.style.top = ((y - 23) / 9) + '%';
  }
  function startBottle() {
    var svg = scene.querySelector('svg');
    var b = svg && svg.querySelector('#bottle');
    if (!b) return;
    b.style.visibility = 'visible';
    bottleBtn.hidden = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      placeBottle(b, 1090, 578);
      return;
    }
    b.style.visibility = 'hidden';
    bottleBtn.hidden = true;
    function trip() {
      var start = performance.now();
      var duration = 45000;
      b.style.visibility = 'visible';
      bottleBtn.hidden = false;
      requestAnimationFrame(function step(now) {
        var t = (now - start) / duration;
        if (t >= 1) {
          b.style.visibility = 'hidden';
          bottleBtn.hidden = true;
          setTimeout(trip, 40000 + Math.random() * 50000);
          return;
        }
        placeBottle(b, 1660 - t * 1760, 577 + Math.sin(now / 600) * 2.5);
        requestAnimationFrame(step);
      });
    }
    setTimeout(trip, 12000);
  }

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
