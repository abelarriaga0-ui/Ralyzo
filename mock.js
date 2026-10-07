/* Demo backend: same interface as LiveAPI, everything in memory (and localStorage when available).
   Used for ?demo=1 and for the preview. It never talks to a server and never moves real money. */
var MockAPI = (function () {
  'use strict';
  var KEY = 'ralyzo_demo_v4', P = Pricing, st = null, nextId = 1;
  var DEFAULTS = {
    service_fee_pct: 25, ai_fixed_fee_usd: 0.5, min_topup_usd: 20, topup_fee_pct: 3.49, topup_fee_fixed_usd: 0.3,
    video_contingency_pct: 0, ai_cost_min_usd: 0.005, ai_cost_max_usd: 0.04, ai_price_in_per_mtok_usd: 0.75, ai_price_out_per_mtok_usd: 4.5,
    provider_mode: 'mock', mock_seconds: 15, allow_test_topups: true, video_ttl_hours: 48, max_generation_minutes: 25, app_url: 'https://ralyzo.com/'
  };
  function fresh() {
    return {
      user: null, profile: null, wallet: { balance_micro: 0, held_micro: 0 }, ledger: [], products: [], generations: [], payments: [],
      settings: JSON.parse(JSON.stringify(DEFAULTS)),
      models: [
        { key: 'simulado', label: 'Simulado (pruebas, no genera video real)', provider: 'mock', endpoint: '', per_second_usd: { '480p': 0.05, '720p': 0.1 }, audio_multiplier: 1.2, durations: [5, 10, 15], aspect_ratios: ['9:16', '1:1', '16:9'], extra_params: {}, video_url_path: 'video.url', active: true, sort: 0, note: 'Modelo de prueba. Precios de ejemplo.' },
        { key: 'seedance-2-0-mini', label: 'Seedance 2.0 Mini (el más barato)', provider: 'byteplus', endpoint: 'dreamina-seedance-2-0-mini-260615', per_second_usd: { '480p': 0.036, '720p': 0.076 }, audio_multiplier: 1, durations: [5, 10, 15], aspect_ratios: ['9:16', '1:1', '16:9'], extra_params: {}, video_url_path: 'content.video_url', active: true, sort: 5, note: 'BytePlus ModelArk. Precio base de referencia (oct 2026).' },
        { key: 'seedance-2-0-fast', label: 'Seedance 2.0 Fast (rápido y económico)', provider: 'byteplus', endpoint: 'dreamina-seedance-2-0-fast-260128', per_second_usd: { '480p': 0.056, '720p': 0.12 }, audio_multiplier: 1, durations: [5, 10, 15], aspect_ratios: ['9:16', '1:1', '16:9'], extra_params: {}, video_url_path: 'content.video_url', active: true, sort: 10, note: 'BytePlus ModelArk. Precio base de referencia (oct 2026).' },
        { key: 'seedance-2-0', label: 'Seedance 2.0 (alta calidad)', provider: 'byteplus', endpoint: 'dreamina-seedance-2-0-260128', per_second_usd: { '480p': 0.07, '720p': 0.152, '1080p': 0.374 }, audio_multiplier: 1, durations: [5, 10, 15], aspect_ratios: ['9:16', '1:1', '16:9'], extra_params: {}, video_url_path: 'content.video_url', active: true, sort: 20, note: 'BytePlus ModelArk. Precio base de referencia (oct 2026).' },
        { key: 'seedance-2-5', label: 'Seedance 2.5 (el más nuevo)', provider: 'byteplus', endpoint: 'dreamina-seedance-2-5-260628', per_second_usd: { '480p': 0.1028, '720p': 0.2312 }, audio_multiplier: 1, durations: [5, 10, 15, 30], aspect_ratios: ['9:16', '1:1', '16:9'], extra_params: {}, video_url_path: 'content.video_url', active: true, sort: 30, note: 'BytePlus ModelArk. Precio base de referencia (oct 2026).' }
      ]
    };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable */ } }
  function load() { try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) { /* ignore */ } return null; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function now() { return new Date().toISOString(); }
  function id() { return 'demo-' + Date.now().toString(36) + '-' + (nextId++); }
  function entry(kind, amount, genId, note) {
    st.ledger.unshift({ id: Date.now() * 100 + st.ledger.length, user_id: 'demo-user', kind: kind, amount_micro: amount, balance_after_micro: st.wallet.balance_micro,
      held_after_micro: st.wallet.held_micro, generation_id: genId || null, note: note, created_at: now() });
  }
  function must(c, msg) { if (!c) throw new Error(msg); }
  function fakeLatency() { return new Promise(function (r) { setTimeout(r, 120); }); }

  function advance(g) {
    var S = st.settings;
    if (g.status === 'queued') { g.status = g.params.angle_mode === 'ai' ? 'analyzing' : 'generating'; g.started_at = g.started_at || now(); }
    var age = Date.now() - new Date(g.started_at || g.created_at).getTime();
    if (g.status === 'analyzing' && age > 2500) {
      g.status = 'generating';
      g.ai_cost_micro = P.usd(S.ai_cost_min_usd) + Math.round((P.usd(S.ai_cost_max_usd) - P.usd(S.ai_cost_min_usd)) * 0.25);
      g.ai_output = { angle: 'Ángulo simulado: el producto resuelve un problema cotidiano en segundos', hook: '¿Todavía haces esto de la forma difícil?', source: 'mock' };
    }
    if (g.status === 'generating' && age > Number(S.mock_seconds || 15) * 1000) {
      var model = st.models.filter(function (m) { return m.key === g.params.model; })[0];
      g.provider_cost_micro = P.videoCost(model, g.params);
      var s = P.settle(S, { videoMicro: g.provider_cost_micro, aiMicro: g.ai_cost_micro || 0, ai: g.params.angle_mode === 'ai' }, g.hold_micro);
      var rem = g.hold_micro - s.charged;
      st.wallet.held_micro -= g.hold_micro; st.wallet.balance_micro += rem;
      entry('charge', s.charged, g.id, 'Cobro final de la generación');
      if (rem > 0) entry('release', rem, g.id, 'Sobrante devuelto a tu saldo');
      g.fee_micro = s.fee; g.ai_fee_micro = s.aiFee; g.charged_micro = s.charged;
      g.status = 'succeeded'; g.video_path = 'demo/' + g.id + '.mp4'; g.finished_at = now();
      g.video_expires_at = new Date(Date.now() + Number(S.video_ttl_hours || 48) * 36e5).toISOString();
    }
  }
  function toBlobUrl() { return 'data:video/mp4;base64,' + window.DEMO_MP4_B64; }
  var videoUrl = null;

  return {
    mode: 'demo',
    init: function () { st = load() || fresh(); },
    async session() { return st.user ? clone(st.user) : null; },
    async signUp(email, password, name) { await fakeLatency(); this._login(email, name); return { needsConfirm: false }; },
    async signInGoogle() { await fakeLatency(); this._login('demo@gmail.com', 'Demo Google'); },
    async signIn(email) { await fakeLatency(); this._login(email); },
    _login: function (email, name) {
      st.user = { id: 'demo-user', email: email };
      st.profile = { id: 'demo-user', email: email, display_name: name || String(email).split('@')[0], is_admin: true, created_at: now() };
      save();
    },
    async signOut() { st.user = null; save(); },
    async profile() { return clone(st.profile); },
    async wallet() { return clone(st.wallet); },
    async ledger() { return clone(st.ledger.slice(0, 60)); },
    async settings() { return clone(st.settings); },
    async models() { return clone(st.models); },
    async products() { return clone(st.products); },
    async generations() {
      return clone(st.generations.map(function (g) {
        var p = st.products.filter(function (x) { return x.id === g.product_id; })[0];
        return Object.assign({}, g, { products: p ? { name: p.name, image_path: p.image_path } : null });
      }));
    },
    imageUrl: function (path) { return Promise.resolve(path || null); },
    videoUrl: function (path) { if (!path) return Promise.resolve(null); videoUrl = videoUrl || toBlobUrl(); return Promise.resolve(videoUrl); },
    async saveProduct(p, blob, uid) {
      var path = null;
      if (blob) path = await new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(blob); });
      if (p.id) {
        var x = st.products.filter(function (q) { return q.id === p.id; })[0];
        Object.assign(x, { name: p.name, description: p.description, selling_points: p.selling_points || '', audience: p.audience || '', language: p.language || 'es' });
        if (path) x.image_path = path;
      } else {
        st.products.unshift({ id: id(), user_id: uid, name: p.name, description: p.description, selling_points: p.selling_points || '', audience: p.audience || '', language: p.language || 'es', image_path: path, created_at: now() });
      }
      save();
    },
    async deleteProduct(pid) { st.products = st.products.filter(function (x) { return x.id !== pid; }); save(); },
    async generate(productId, params) {
      await fakeLatency();
      var S = st.settings, model = st.models.filter(function (m) { return m.key === params.model && m.active; })[0];
      var err = P.validate(model, params); must(!err, err);
      var product = st.products.filter(function (x) { return x.id === productId; })[0];
      must(product, 'Elige uno de tus productos.'); must(product.image_path, 'El producto necesita una foto para generar el video.');
      var running = st.generations.filter(function (g) { return ['queued', 'analyzing', 'generating'].indexOf(g.status) >= 0; }).length;
      must(running < 3, 'Ya tienes 3 generaciones en curso. Espera a que termine alguna.');
      var q = P.quote(model, params, S);
      must(st.wallet.balance_micro >= q.max, 'Saldo insuficiente. Necesitas al menos ' + P.fmtUp(q.max) + ' disponibles.');
      st.wallet.balance_micro -= q.max; st.wallet.held_micro += q.max;
      var g = { id: id(), user_id: 'demo-user', product_id: productId, status: 'queued', params: params, quote_min_micro: q.min, quote_max_micro: q.max, hold_micro: q.max,
        provider_cost_micro: null, ai_cost_micro: null, fee_micro: null, ai_fee_micro: null, charged_micro: null, ai_output: null, video_path: null, video_expires_at: null,
        video_deleted: false, error: null, created_at: now(), started_at: now(), finished_at: null };
      st.generations.unshift(g);
      entry('hold', q.max, g.id, 'Retención del máximo para la generación');
      save();
      return { generation_id: g.id, held_micro: q.max };
    },
    async refresh(gid) {
      var g = st.generations.filter(function (x) { return x.id === gid; })[0];
      must(g, 'No encontramos esa generación.');
      advance(g); save();
      return { generation: clone(g) };
    },
    async cancel(gid) {
      var g = st.generations.filter(function (x) { return x.id === gid; })[0];
      must(g && g.status === 'queued', 'Esta generación ya empezó y no se puede cancelar.');
      g.status = 'canceled'; g.charged_micro = 0; g.finished_at = now();
      st.wallet.held_micro -= g.hold_micro; st.wallet.balance_micro += g.hold_micro;
      entry('release', g.hold_micro, g.id, 'Generación cancelada: retención devuelta'); save();
      return { ok: true };
    },
    async topup(amountUsd, provider) {
      var S = st.settings; await fakeLatency();
      must(amountUsd >= Number(S.min_topup_usd), 'La recarga mínima es $' + S.min_topup_usd + '.');
      must(provider === 'test', 'PayPal no está disponible en la vista previa. Usa la recarga de prueba.');
      var net = P.usd(amountUsd);
      st.wallet.balance_micro += net; entry('topup', net, null, 'Recarga de prueba'); save();
      return { status: 'completed' };
    },
    async topupCapture() { return { status: 'completed' }; },
    async adminStats() {
      var ok = st.generations.filter(function (g) { return g.status === 'succeeded'; });
      var sum = function (k) { return ok.reduce(function (a, g) { return a + (g[k] || 0); }, 0); };
      return { users: 1, topups_micro: 0, topups_test_micro: st.ledger.filter(function (l) { return l.kind === 'topup'; }).reduce(function (a, l) { return a + l.amount_micro; }, 0),
        topup_fees_micro: 0, charged_micro: sum('charged_micro'), provider_cost_micro: sum('provider_cost_micro'), ai_cost_micro: sum('ai_cost_micro'),
        ok: ok.length, failed: st.generations.filter(function (g) { return g.status === 'failed'; }).length, balances_micro: st.wallet.balance_micro, held_micro: st.wallet.held_micro };
    },
    async adminUsers() { return [Object.assign({}, st.profile, { balance_micro: st.wallet.balance_micro, held_micro: st.wallet.held_micro })]; },
    async saveSetting(key, value) { st.settings[key] = value; save(); },
    async saveModel(m) {
      var i = st.models.findIndex(function (x) { return x.key === m.key; });
      if (i >= 0) st.models[i] = Object.assign(st.models[i], m); else st.models.push(m);
      save();
    },
    async adminAdjust(userId, amountUsd, note) {
      var amt = P.usd(amountUsd); must(st.wallet.balance_micro + amt >= 0, 'El saldo no alcanza para ese descuento.');
      st.wallet.balance_micro += amt; entry('adjustment', amt, null, 'Ajuste del administrador: ' + (note || '')); save(); return { ok: true };
    },
    async adminSecrets() {
      st.secrets = st.secrets || {};
      return ['BYTEPLUS_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_ENV'].map(function (n) {
        var v = st.secrets[n], pub = n === 'PAYPAL_ENV' || n === 'OPENAI_MODEL';
        return { name: n, set: !!v, source: v ? 'app' : null, last4: v && !pub ? String(v).slice(-4) : null, value: pub ? (v || null) : null };
      });
    },
    async adminSetSecret(name, value) { st.secrets = st.secrets || {}; if (value) st.secrets[name] = value; else delete st.secrets[name]; save(); return { ok: true }; },
    async adminTest(name) {
      await fakeLatency(); st.secrets = st.secrets || {};
      var need = { byteplus: ['BYTEPLUS_API_KEY'], openai: ['OPENAI_API_KEY'], paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'] }[name] || [];
      var ok = need.every(function (n) { return st.secrets[n]; });
      return ok ? { ok: true, msg: 'Conexión simulada correcta (vista previa).' } : { ok: false, msg: 'Falta pegar la llave.' };
    },
    async adminSetPassword() { return { ok: true }; },
    reset: function () { st = fresh(); save(); }
  };
})();
