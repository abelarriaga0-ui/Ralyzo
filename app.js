/* Ralyzo app: single-page UI. Talks to LiveAPI (Supabase) or MockAPI (?demo=1). */
(function () {
  'use strict';
  var DEMO = !!window.RALYZO_FORCE_DEMO || /[?&]demo=1/.test(location.search);
  var API = DEMO ? MockAPI : LiveAPI;
  var P = Pricing;
  var root = document.getElementById('app');
  var ACTIVE = ['created', 'queued', 'analyzing', 'generating'];
  var STATUS = { created: 'Creando', queued: 'En cola', analyzing: 'Analizando', generating: 'Generando', succeeded: 'Listo', failed: 'Falló', canceled: 'Cancelado' };
  var st = { user: null, profile: null, wallet: { balance_micro: 0, held_micro: 0 }, S: {}, models: [], products: [], gens: [], ledger: [],
    g: null, qOpen: window.matchMedia && window.matchMedia('(min-width: 900px)').matches, topAmount: 20, authTab: 'login', polling: false, admin: null };

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(m) { return P.fmt(m || 0, 2); }
  function when(iso) { return iso ? new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
  function left(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'expirado';
    var h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return h > 0 ? h + ' h ' + m + ' min' : m + ' min';
  }
  function styleLabel(k) { var s = P.STYLES.filter(function (x) { return x.key === k; })[0]; return s ? s.label : k; }
  function modelByKey(k) { return st.models.filter(function (m) { return m.key === k; })[0]; }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4200);
  }
  function sheet(html) {
    var bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    function close() { bg.remove(); }
    document.body.appendChild(bg);
    var first = bg.querySelector('input,select,textarea,button'); if (first) first.focus();
    return { el: bg.firstChild, close: close };
  }
  var ic = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    film: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14h2"/></svg>',
    admin: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>'
  };
  var LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="6" fill="#16304f"/><path d="M11 9l12 7-12 7z" fill="#f2b01e"/></svg>';

  // ---------- data ----------
  async function loadAll() {
    var uid = st.user.id;
    var r = await Promise.all([API.profile(uid), API.wallet(uid), API.settings(), API.models(), API.products(), API.generations()]);
    st.profile = r[0]; st.wallet = r[1]; st.S = r[2]; st.models = r[3].filter(function (m) { return m.active || (st.profile && st.profile.is_admin); });
    st.products = r[4]; st.gens = r[5];
  }
  async function reloadWallet() { st.wallet = await API.wallet(st.user.id); chip(); }
  function chip() { var el = document.getElementById('chip'); if (el) el.textContent = money(st.wallet.balance_micro); }
  function activeModels() { return st.models.filter(function (m) { return m.active; }); }

  // ---------- shell ----------
  function shell(inner, active) {
    var items = [['', 'Inicio', ic.home], ['products', 'Productos', ic.box], ['generate', 'Generar', ic.spark, 1], ['history', 'Historial', ic.film], ['wallet', 'Saldo', ic.wallet]];
    var tabs = items.map(function (it) {
      return '<a href="#/' + it[0] + '"' + (active === it[0] ? ' aria-current="page"' : '') + (it[3] ? ' class="primary"' : '') + '>' +
        (it[3] ? '<span class="ic">' + it[2] + '</span>' : it[2]) + '<span>' + it[1] + '</span></a>';
    }).join('');
    var side = items.map(function (it) {
      return '<a href="#/' + it[0] + '"' + (active === it[0] ? ' aria-current="page"' : '') + '>' + it[2] + '<span>' + it[1] + '</span></a>';
    }).join('') + (st.profile && st.profile.is_admin ? '<a href="#/admin"' + (active === 'admin' ? ' aria-current="page"' : '') + '>' + ic.admin + '<span>Administración</span></a>' : '') +
      '<span class="grow"></span><a href="#/" data-act="logout"><span>Salir</span></a>';
    return (DEMO ? '<div class="banner">Vista previa con datos de ejemplo: nada se guarda en un servidor ni mueve dinero real.</div>' : '') +
      '<div class="app"><nav class="sidebar" aria-label="Principal"><a class="brand" href="#/">' + LOGO + 'Ralyzo</a>' + side + '</nav>' +
      '<div><header class="topbar"><a class="brand" href="#/">' + LOGO + 'Ralyzo</a><span class="grow"></span>' +
      (st.profile && st.profile.is_admin ? '<a class="btn small" href="#/admin">Admin</a>' : '') +
      '<a class="bal-chip" href="#/wallet"><small>Saldo</small><b id="chip">' + money(st.wallet.balance_micro) + '</b></a></header>' +
      '<main class="main" id="main">' + inner + '</main></div></div>' +
      '<nav class="tabbar" aria-label="Principal">' + tabs + '</nav>';
  }

  // ---------- auth ----------
  function authView() {
    var signup = st.authTab === 'signup';
    root.innerHTML = '<div class="auth"><div class="brand">' + LOGO + 'Ralyzo</div>' +
      '<h1 style="text-align:center">Videos con IA. Pagas solo lo que generas.</h1>' +
      '<p class="sub" style="text-align:center">Sin planes ni créditos. Recargas dinero, ves el precio antes de generar y te devolvemos lo que sobre.</p>' +
      '<div class="card"><button class="btn block" type="button" data-act="google" style="background:#fff;color:#1f1f1f;border-color:#dadce0;gap:.7rem"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Continuar con Google</button>' +
      (DEMO ? '<p class="muted" style="font-size:.8rem;text-align:center;margin:.7rem 0 0">En la vista previa este botón es una simulación. En la app real abre la ventana de Google para elegir tu cuenta.</p>' : '') +
      '<p class="muted" style="text-align:center;margin:.9rem 0 0">o con tu correo</p></div>' +
      '<form class="card" data-form="auth" novalidate>' +
      '<div class="seg" style="margin-bottom:1rem"><button type="button" class="btn small" data-act="tab" data-v="login"' + (!signup ? ' aria-pressed="true" style="border-color:var(--accent)"' : '') + '>Entrar</button>' +
      '<button type="button" class="btn small" data-act="tab" data-v="signup"' + (signup ? ' aria-pressed="true" style="border-color:var(--accent)"' : '') + '>Crear cuenta</button></div>' +
      (signup ? '<label class="f"><span>Tu nombre</span><input type="text" name="name" autocomplete="name"></label>' : '') +
      '<label class="f"><span>Correo</span><input type="email" name="email" autocomplete="email" required></label>' +
      '<label class="f"><span>Contraseña</span><input type="password" name="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required minlength="8"><small>' + (signup ? 'Mínimo 8 caracteres.' : '') + '</small></label>' +
      '<div class="err" id="autherr" role="alert"></div>' +
      '<button class="btn primary block" type="submit">' + (signup ? 'Crear cuenta' : 'Entrar') + '</button></form>' +
      (DEMO ? '<p class="muted" style="text-align:center">Vista previa: escribe cualquier correo y contraseña.</p>' : '') + '</div>';
  }

  // ---------- dashboard ----------
  function genMini(g) {
    var name = g.products ? g.products.name : 'Producto';
    return '<div class="item"><img class="thumb" alt="" data-img="' + esc(g.products && g.products.image_path || '') + '"><div><div class="t">' + esc(name) + '</div>' +
      '<div class="m">' + esc(styleLabel(g.params.style)) + ' · ' + g.params.duration + ' s · ' + when(g.created_at) + '</div></div>' +
      '<span class="pill ' + (g.status === 'succeeded' ? 'ok' : g.status === 'failed' ? 'bad' : 'run') + '">' + STATUS[g.status] + '</span></div>';
  }
  function dashboard() {
    var run = st.gens.filter(function (g) { return ACTIVE.indexOf(g.status) >= 0; });
    var done = st.gens.filter(function (g) { return g.status === 'succeeded'; }).slice(0, 3);
    var steps = (!st.products.length || st.wallet.balance_micro <= 0) ?
      '<div class="card"><h2>Empieza en 3 pasos</h2><ol class="steps"><li><div><b>Sube un producto</b><br><span class="muted">Foto y descripción. Se guarda para usarlo cuando quieras.</span></div></li>' +
      '<li><div><b>Recarga saldo</b><br><span class="muted">Desde ' + money(P.usd(st.S.min_topup_usd || 20)) + '. Es tu dinero: se descuenta solo lo que generas.</span></div></li>' +
      '<li><div><b>Elige y genera</b><br><span class="muted">Ves el costo mientras eliges. Se retiene el máximo y se te devuelve el sobrante.</span></div></li></ol></div>' : '';
    return shell('<h1>Hola, ' + esc((st.profile && st.profile.display_name) || '') + '</h1><p class="sub">Genera videos de producto con IA y paga exactamente lo que cuestan.</p>' +
      '<div class="card bal-card"><span class="muted">Saldo disponible</span><div class="big">' + money(st.wallet.balance_micro) + '</div>' +
      (st.wallet.held_micro > 0 ? '<span class="muted">Retenido en videos en curso: ' + money(st.wallet.held_micro) + '. Lo que sobre vuelve a tu saldo.</span>' : '') +
      '<div class="row" style="margin-top:.7rem"><a class="btn primary" href="#/generate">Generar video</a><a class="btn" href="#/wallet">Recargar</a></div></div>' + steps +
      (run.length ? '<h2>En curso</h2><div class="list" style="margin-bottom:1rem">' + run.map(genMini).join('') + '</div>' : '') +
      (done.length ? '<h2>Últimos videos</h2><div class="list">' + done.map(genMini).join('') + '</div><p style="margin-top:.8rem"><a href="#/history">Ver todo el historial</a></p>' : ''), '');
  }

  // ---------- products ----------
  function productsView() {
    var list = st.products.length ? '<div class="list">' + st.products.map(function (p) {
      return '<div class="item"><img class="thumb" alt="" data-img="' + esc(p.image_path || '') + '"><div><div class="t">' + esc(p.name) + '</div><div class="m">' + esc((p.description || '').slice(0, 90)) + '</div></div>' +
        '<div class="row"><button class="btn small" data-act="editprod" data-id="' + p.id + '">Editar</button></div></div>';
    }).join('') + '</div>' : '<div class="empty"><p><b>Aún no tienes productos.</b></p><p>Sube la foto y la descripción de lo que vendes. Luego solo eliges el producto para generar videos.</p></div>';
    return shell('<div class="row" style="justify-content:space-between"><h1>Productos</h1><button class="btn primary" data-act="newprod">Nuevo producto</button></div>' +
      '<p class="sub">Cada producto guarda su foto y su información para no repetirlas.</p>' + list, 'products');
  }
  function compress(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var r = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(url); b ? res(b) : rej(new Error('No se pudo procesar la imagen.')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { rej(new Error('Esa imagen no se puede leer.')); };
      img.src = url;
    });
  }
  function productSheet(p) {
    p = p || {};
    var s = sheet('<h2>' + (p.id ? 'Editar producto' : 'Nuevo producto') + '</h2><form data-form="product" novalidate>' +
      '<img class="preview" alt="" ' + (p.image_path ? 'data-img="' + esc(p.image_path) + '"' : 'hidden') + ' id="pv">' +
      '<label class="f"><span>Foto del producto</span><input type="file" name="photo" accept="image/*"><small>Una foto clara, con fondo limpio, da mejores resultados.</small></label>' +
      '<label class="f"><span>Nombre</span><input type="text" name="name" required maxlength="80" value="' + esc(p.name) + '"></label>' +
      '<label class="f"><span>Descripción</span><textarea name="description" maxlength="800">' + esc(p.description) + '</textarea><small>Qué es, para qué sirve y cómo se usa. La IA solo usa lo que escribas aquí.</small></label>' +
      '<label class="f"><span>Puntos fuertes (opcional)</span><textarea name="selling_points" maxlength="600">' + esc(p.selling_points) + '</textarea></label>' +
      '<label class="f"><span>Público (opcional)</span><input type="text" name="audience" maxlength="120" value="' + esc(p.audience) + '"></label>' +
      '<div class="err" id="perr" role="alert"></div><div class="row"><button class="btn primary" type="submit">Guardar</button>' +
      '<button class="btn" type="button" data-act="closesheet">Cancelar</button>' +
      (p.id ? '<button class="btn danger" type="button" data-act="delprod" data-id="' + p.id + '">Borrar</button>' : '') + '</div></form>');
    s.el.querySelector('form').dataset.id = p.id || '';
    hydrate(s.el);
    s.el.querySelector('input[name=photo]').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var pv = s.el.querySelector('#pv'); pv.src = URL.createObjectURL(f); pv.hidden = false;
    });
    st.sheet = s;
  }

  // ---------- generate ----------
  function initG() {
    var prev = st.g || {};
    var m = modelByKey(prev.model) && modelByKey(prev.model).active ? modelByKey(prev.model) : activeModels()[0];
    var g = { product_id: prev.product_id || (st.products[0] && st.products[0].id) || '', style: prev.style || 'ugc_testimonial', angle_mode: prev.angle_mode || 'ai',
      angle_text: prev.angle_text || '', music: !!prev.music, scenes: prev.scenes || 1, language: prev.language || 'es', notes: prev.notes || '', model: m ? m.key : '' };
    if (m) {
      var ress = priced(m);
      g.resolution = ress.indexOf(prev.resolution) >= 0 ? prev.resolution : ress[0];
      g.duration = m.durations.indexOf(Number(prev.duration)) >= 0 ? Number(prev.duration) : m.durations[0];
      g.aspect = m.aspect_ratios.indexOf(prev.aspect) >= 0 ? prev.aspect : (m.aspect_ratios.indexOf('9:16') >= 0 ? '9:16' : m.aspect_ratios[0]);
    }
    st.g = g;
  }
  function priced(m) { return Object.keys(m.per_second_usd).filter(function (k) { return Number(m.per_second_usd[k]) > 0; }); }
  function chips(name, opts, val) {
    return '<div class="chips">' + opts.map(function (o) {
      return '<label class="chip"><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
    }).join('') + '</div>';
  }
  function genOptions() {
    var g = st.g, m = modelByKey(g.model); if (!m) return '';
    return '<label class="f"><span>Calidad</span>' + chips('resolution', priced(m).map(function (r) { return [r, r]; }), g.resolution) + '</label>' +
      '<label class="f"><span>Duración</span>' + chips('duration', m.durations.map(function (d) { return [d, d + ' s']; }), g.duration) + '</label>' +
      '<label class="f"><span>Formato</span>' + chips('aspect', m.aspect_ratios.map(function (a) { return [a, a]; }), g.aspect) + '</label>' +
      '<label class="switch"><span><b>Música y sonido</b><br><small class="muted">' + (Number(m.audio_multiplier) > 1 ? 'Cuesta ' + Math.round((Number(m.audio_multiplier) - 1) * 100) + ' % más.' : 'Sin costo extra.') + '</small></span><input type="checkbox" name="music"' + (g.music ? ' checked' : '') + '></label>' +
      '<label class="f"><span>Escenas</span><div class="stepper"><button type="button" data-act="scenes" data-d="-1" aria-label="Menos escenas">−</button><output>' + g.scenes + '</output><button type="button" data-act="scenes" data-d="1" aria-label="Más escenas">+</button></div></label>';
  }
  function quotePanel() {
    var g = st.g, m = modelByKey(g.model), err = P.validate(m, g);
    if (!st.products.length) return '';
    if (err) return '<div class="quote"><div class="err">' + esc(err) + '</div></div>';
    var q = P.quote(m, g, st.S), ai = g.angle_mode === 'ai', enough = st.wallet.balance_micro >= q.max;
    function row(l, v) { return '<div><dt>' + l + '</dt><dd>' + v + '</dd></div>'; }
    var small = '<small>Reservamos ' + P.fmtUp(q.max) + ' y te devolvemos al instante lo que no se use. Nunca se cobra más.</small>';
    var lines = '<dl>' +
      row('Video ' + g.duration + ' s · ' + g.resolution + (g.music ? ' · con sonido' : ''), money(q.video)) +
      (ai ? row('IA: analiza tu foto y escribe el guion', P.fmtUp(q.aiMin) + ' a ' + P.fmtUp(q.aiMax)) : '') +
      row('Tarifa de servicio (' + Math.round(q.rate * 1000) / 10 + ' %)', P.fmtUp(q.feeMin) + (q.feeMax !== q.feeMin ? ' a ' + P.fmtUp(q.feeMax) : '')) +
      (ai ? row('Cargo fijo de la IA', money(q.aiFee)) : '') + '</dl>';
    return '<div class="quote"><div class="total"><span>Total</span><b>' + P.range(q) + '</b></div>' +
      '<details class="qd"' + (st.qOpen ? ' open' : '') + '><summary>Ver cómo se arma</summary>' + lines + '</details>' + small +
      (enough ? '<button class="btn primary block" data-act="generate">Generar video</button>' :
        '<div class="err">Tu saldo (' + money(st.wallet.balance_micro) + ') no alcanza para reservar ' + P.fmtUp(q.max) + '.</div><a class="btn primary block" href="#/wallet">Recargar saldo</a>') + '</div>';
  }
  function generateView() {
    if (!st.products.length) return shell('<h1>Generar video</h1><div class="empty"><p><b>Primero agrega un producto.</b></p><p>Necesitamos su foto y descripción.</p><a class="btn primary" href="#/products">Ir a productos</a></div>', 'generate');
    if (!activeModels().length) return shell('<h1>Generar video</h1><div class="empty"><p><b>Todavía no hay modelos activos.</b></p><p>El administrador debe activar al menos uno.</p></div>', 'generate');
    initG();
    var g = st.g;
    var form = '<form id="gform" data-form="gen" novalidate>' +
      '<div class="card"><h2>1. Producto</h2><label class="f"><select name="product_id">' + st.products.map(function (p) { return '<option value="' + p.id + '"' + (p.id === g.product_id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="card"><h2>2. Estilo</h2>' + P.STYLES.map(function (s) {
        return '<label class="opt"><input type="radio" name="style" value="' + s.key + '"' + (g.style === s.key ? ' checked' : '') + '><div><b>' + s.label + '</b><small>' + s.hint + '</small></div></label>';
      }).join('') + '</div>' +
      '<div class="card"><h2>3. Ángulo de venta</h2>' +
      '<label class="opt"><input type="radio" name="angle_mode" value="ai"' + (g.angle_mode === 'ai' ? ' checked' : '') + '><div><b>Que lo decida la IA</b><small>Analiza tu foto y tu descripción y propone el guion. Tiene un costo extra pequeño.</small></div></label>' +
      '<label class="opt"><input type="radio" name="angle_mode" value="user"' + (g.angle_mode === 'user' ? ' checked' : '') + '><div><b>Lo escribo yo</b><small>Sin costo de IA.</small></div></label>' +
      '<div id="angbox"' + (g.angle_mode === 'user' ? '' : ' hidden') + '><label class="f"><span>Tu ángulo de venta</span><textarea name="angle_text" maxlength="500">' + esc(g.angle_text) + '</textarea></label></div></div>' +
      '<div class="card"><h2>4. Modelo y calidad</h2><label class="f"><span>Modelo</span><select name="model">' + activeModels().map(function (m) { return '<option value="' + esc(m.key) + '"' + (m.key === g.model ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('') + '</select></label>' +
      '<div id="opts">' + genOptions() + '</div></div>' +
      '<div class="card"><h2>5. Idioma y notas</h2><label class="f"><span>Idioma de la voz</span>' + chips('language', P.LANGUAGES.map(function (l) { return [l.key, l.label]; }), g.language) + '</label>' +
      '<label class="f"><span>Indicaciones (opcional)</span><textarea name="notes" maxlength="500">' + esc(g.notes) + '</textarea></label></div></form>';
    return shell('<h1>Generar video</h1><p class="sub">Elige y mira cómo se arma tu cuenta abajo.</p>' + form + '<div id="quote">' + quotePanel() + '</div><div class="err" id="generr" role="alert"></div>', 'generate');
  }
  function readG() {
    var f = document.getElementById('gform'); if (!f) return;
    var d = new FormData(f), g = st.g;
    g.product_id = d.get('product_id'); g.style = d.get('style'); g.angle_mode = d.get('angle_mode'); g.angle_text = d.get('angle_text') || '';
    g.language = d.get('language'); g.notes = d.get('notes') || ''; g.music = !!f.elements.music && f.elements.music.checked;
    var newModel = d.get('model');
    if (newModel !== g.model) { g.model = newModel; initG(); document.getElementById('opts').innerHTML = genOptions(); }
    else if (d.get('resolution')) { g.resolution = d.get('resolution'); g.duration = Number(d.get('duration')); g.aspect = d.get('aspect'); }
    document.getElementById('angbox').hidden = g.angle_mode !== 'ai' ? false : true;
    document.getElementById('quote').innerHTML = quotePanel();
  }
  async function doGenerate() {
    var err = document.getElementById('generr'), btn = root.querySelector('[data-act=generate]');
    err.textContent = ''; if (btn) btn.disabled = true;
    var g = st.g;
    var params = { model: g.model, style: g.style, language: g.language, duration: g.duration, resolution: g.resolution, aspect: g.aspect, music: g.music,
      scenes: g.scenes, angle_mode: g.angle_mode, angle_text: g.angle_text, notes: g.notes };
    try {
      var r = await API.generate(g.product_id, params);
      toast('Listo. Reservamos ' + P.fmtUp(r.held_micro) + '; lo que sobre vuelve a tu saldo.');
      await Promise.all([reloadWallet(), API.generations().then(function (x) { st.gens = x; })]);
      location.hash = '#/history';
    } catch (e) { err.textContent = e.message; if (btn) btn.disabled = false; }
  }

  // ---------- history ----------
  function receipt(g) {
    function row(l, v, cls) { return '<tr><td>' + l + '</td><td class="n ' + (cls || '') + '">' + v + '</td></tr>'; }
    var back = (g.hold_micro || 0) - (g.charged_micro || 0);
    return '<details><summary class="muted">Ver la cuenta</summary><div class="tablewrap"><table><tbody>' +
      row('Costo del modelo de video', money(g.provider_cost_micro)) + (g.ai_cost_micro ? row('Costo de la IA', money(g.ai_cost_micro)) : '') +
      row('Tarifa de servicio', money(g.fee_micro)) + (g.ai_fee_micro ? row('Cargo fijo de la IA', money(g.ai_fee_micro)) : '') +
      row('<b>Total cobrado</b>', '<b>' + money(g.charged_micro) + '</b>') + row('Reservado al empezar', money(g.hold_micro)) +
      row('Devuelto a tu saldo', money(back), 'pos') + '</tbody></table></div></details>';
  }
  function genCard(g) {
    var m = g.params, name = g.products ? g.products.name : 'Producto', body = '';
    if (ACTIVE.indexOf(g.status) >= 0) {
      body = '<div class="bar" role="progressbar" aria-label="Progreso"><i></i></div><div class="muted">Reservamos ' + money(g.hold_micro) + '. Cuando termine, se cobra el costo real y se devuelve el resto. ' +
        (g.status === 'queued' ? '<button class="btn small danger" data-act="cancel" data-id="' + g.id + '">Cancelar</button>' : '') + '</div>';
    } else if (g.status === 'succeeded') {
      body = (g.video_deleted || !g.video_path ? '<p class="muted">El video ya se borró de nuestros servidores (se guardan ' + (st.S.video_ttl_hours || 48) + ' h).</p>' :
        '<video controls playsinline preload="metadata" data-video="' + esc(g.video_path) + '"></video>' +
        '<div class="row"><a class="btn primary small" data-dl="' + esc(g.video_path) + '" download="ralyzo-' + g.id.slice(0, 8) + '.mp4" href="#">Descargar</a>' +
        '<span class="muted">Descárgalo: se borra en ' + left(g.video_expires_at) + '.</span></div>') +
        (g.ai_output && g.ai_output.angle ? '<div class="muted"><b>Ángulo usado:</b> ' + esc(g.ai_output.angle) + '</div>' : '') + receipt(g);
    } else {
      body = '<div class="err">' + esc(g.error || (g.status === 'canceled' ? 'Cancelaste esta generación.' : 'No se pudo generar el video.')) + '</div><div class="muted">No se te cobró nada: te devolvimos todo lo reservado.</div>';
    }
    return '<div class="gen"><div class="head"><img class="thumb" alt="" data-img="' + esc(g.products && g.products.image_path || '') + '"><div style="flex:1"><div class="t"><b>' + esc(name) + '</b></div>' +
      '<div class="muted" style="font-size:.85rem">' + esc(styleLabel(m.style)) + ' · ' + m.duration + ' s · ' + esc(m.resolution) + ' · ' + when(g.created_at) + '</div></div>' +
      '<span class="pill ' + (g.status === 'succeeded' ? 'ok' : g.status === 'failed' || g.status === 'canceled' ? 'bad' : 'run') + '">' + STATUS[g.status] + '</span></div>' + body + '</div>';
  }
  function historyView() {
    return shell('<h1>Historial</h1><p class="sub">Tus videos y lo que costó cada uno.</p>' + (st.gens.length ? '<div class="list">' + st.gens.map(genCard).join('') + '</div>' :
      '<div class="empty"><p><b>Todavía no generas videos.</b></p><a class="btn primary" href="#/generate">Generar el primero</a></div>'), 'history');
  }

  // ---------- wallet ----------
  function topSummary() {
    var amt = Number(st.topAmount) || 0, min = Number(st.S.min_topup_usd || 20), t = P.topup(P.usd(Math.max(amt, 0)), st.S), ok = amt >= min;
    var test = st.profile && st.profile.is_admin && st.S.allow_test_topups;
    return (ok ? '<table><tbody><tr><td>Se suma a tu saldo</td><td class="n">' + money(t.net) + '</td></tr><tr><td>Cargo de recarga <small class="muted">(lo que cobra la pasarela)</small></td><td class="n">' + money(t.fee) + '</td></tr><tr><td><b>Pagas</b></td><td class="n"><b>' + money(t.gross) + '</b></td></tr></tbody></table>' :
      '<div class="err">La recarga mínima es ' + money(P.usd(min)) + '.</div>') +
      '<div class="err" id="toperr" role="alert"></div><div class="row" style="margin-top:.8rem"><button class="btn primary" data-act="paypal"' + (ok ? '' : ' disabled') + '>Pagar con PayPal</button>' +
      (test ? '<button class="btn" data-act="testtop"' + (ok ? '' : ' disabled') + '>Recarga de prueba (admin)</button>' : '') + '</div>';
  }
  function walletView() {
    var amt = Number(st.topAmount) || 0, min = Number(st.S.min_topup_usd || 20);
    var kinds = { topup: 'Recarga', hold: 'Reserva', charge: 'Cobro', release: 'Devolución', adjustment: 'Ajuste' };
    var rows = st.ledger.map(function (l) {
      var plus = l.kind === 'topup' || l.kind === 'release' || (l.kind === 'adjustment' && l.amount_micro > 0);
