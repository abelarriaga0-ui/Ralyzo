/* Live backend: Supabase auth + tables + storage, and the `api` Edge Function for anything that moves money. */
var LiveAPI = (function () {
  'use strict';
  var cfg = window.RALYZO_CONFIG || {};
  var sb = null, cache = {};

  function init() {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  }
  function must(res) {
    if (res.error) throw new Error(res.error.message || 'Error de datos');
    return res.data;
  }
  async function fn(action, body) {
    var res = await sb.functions.invoke('api', { body: Object.assign({ action: action }, body || {}) });
    if (res.error) {
      var msg = 'No se pudo completar la acción. Intenta de nuevo.';
      try { var j = await res.error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* keep default */ }
      throw new Error(msg);
    }
    return res.data;
  }
  async function signed(bucket, path, ttl) {
    var k = bucket + '/' + path, now = Date.now();
    if (cache[k] && cache[k].exp > now) return cache[k].url;
    var r = await sb.storage.from(bucket).createSignedUrl(path, ttl || 3600);
    if (r.error) return null;
    cache[k] = { url: r.data.signedUrl, exp: now + (ttl || 3600) * 1000 - 60000 };
    return cache[k].url;
  }

  return {
    mode: 'live',
    init: init,
    // auth
    async session() { var r = await sb.auth.getSession(); return r.data.session ? r.data.session.user : null; },
    async signUp(email, password, name) {
      await fn('signup', { email: email, password: password, name: name || '' });
      await this.signIn(email, password);
      return { needsConfirm: false };
    },
    async signIn(email, password) {
      var r = await sb.auth.signInWithPassword({ email: email, password: password });
      if (r.error) throw new Error(/invalid/i.test(r.error.message) ? 'Correo o contraseña incorrectos.' : r.error.message);
    },
    async signInGoogle() {
      var r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (r.error) throw new Error(/provider is not enabled|unsupported provider/i.test(r.error.message) ? 'El acceso con Google todavía no está activado en el servidor.' : r.error.message);
    },
    async signOut() { await sb.auth.signOut(); cache = {}; },
    // reads
    async profile(uid) { return must(await sb.from('profiles').select('*').eq('id', uid).single()); },
    async wallet(uid) { return must(await sb.from('wallets').select('*').eq('user_id', uid).single()); },
    async ledger() { return must(await sb.from('ledger').select('*').order('id', { ascending: false }).limit(60)); },
    async settings() {
      var rows = must(await sb.from('settings').select('key,value')), S = {};
      rows.forEach(function (r) { S[r.key] = r.value; });
      return S;
    },
    async models() { return must(await sb.from('model_prices').select('*').order('sort')); },
    async products() { return must(await sb.from('products').select('*').order('created_at', { ascending: false })); },
    async generations() {
      return must(await sb.from('generations').select('*, products(name,image_path)').order('created_at', { ascending: false }).limit(40));
    },
    imageUrl: function (path) { return path ? signed('products', path, 3600) : Promise.resolve(null); },
    videoUrl: function (path) { return path ? signed('videos', path, 3600) : Promise.resolve(null); },
    // products
    async saveProduct(p, blob, uid) {
      var row = { name: p.name, description: p.description, selling_points: p.selling_points || '', audience: p.audience || '', language: p.language || 'es' };
      if (blob) {
        var path = uid + '/' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '.jpg';
        var up = await sb.storage.from('products').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw new Error('No se pudo subir la foto: ' + up.error.message);
        row.image_path = path;
      }
      if (p.id) must(await sb.from('products').update(row).eq('id', p.id));
      else { row.user_id = uid; must(await sb.from('products').insert(row)); }
    },
    async deleteProduct(id) { must(await sb.from('products').delete().eq('id', id)); },
    // money (server decides)
    generate: function (productId, params) { return fn('generate', { product_id: productId, params: params }); },
    refresh: function (id) { return fn('refresh', { generation_id: id }); },
    cancel: function (id) { return fn('cancel', { generation_id: id }); },
    topup: function (amountUsd, provider) {
      var ret = location.origin + location.pathname + '?paypal=1';
      return fn('topup_create', { amount_usd: amountUsd, provider: provider, return_url: ret });
    },
    topupCapture: function (orderId) { return fn('topup_capture', { order_id: orderId }); },
    // admin
    async adminStats() { return must(await sb.rpc('admin_stats')); },
    async adminUsers() { return must(await sb.rpc('admin_users')); },
    async saveSetting(key, value) { must(await sb.from('settings').upsert({ key: key, value: value, updated_at: new Date().toISOString() })); },
    async saveModel(m) { must(await sb.from('model_prices').upsert(m)); },
    adminSecrets: function () { return fn('admin_secrets').then(function (r) { return r.secrets; }); },
    adminSetSecret: function (name, value) { return fn('admin_set_secret', { name: name, value: value }); },
    adminTest: function (name) { return fn('admin_test', { name: name }); },
    adminSetPassword: function (userId, password) { return fn('admin_set_password', { user_id: userId, password: password }); },
    adminAdjust: function (userId, amountUsd, note) { return fn('admin_adjust', { user_id: userId, amount_usd: amountUsd, note: note }); }
  };
})();
