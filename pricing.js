/* Ralyzo pricing engine. Shared by the Edge Function (server decides the real price) and the web app (live preview).
   Money is always integer micro-USD (1 USD = 1,000,000). Settings come from the `settings` table, in USD / percent. */
var Pricing = (function () {
  'use strict';
  var MICRO = 1e6;
  function usd(x) { return Math.round(Number(x) * MICRO); }
  function toUsd(m) { return m / MICRO; }

  var STYLES = [
    { key: 'ugc_testimonial', label: 'UGC testimonial', hint: 'Persona real hablando a cámara sobre el producto' },
    { key: 'problem_solution', label: 'Problema y solución', hint: 'Muestra el dolor y cómo lo resuelve el producto' },
    { key: 'product_demo', label: 'Demostración del producto', hint: 'Cómo se usa, paso a paso' },
    { key: 'unboxing', label: 'Unboxing', hint: 'Apertura y primeras impresiones' },
    { key: 'cinematic', label: 'Anuncio cinematográfico', hint: 'Planos de producto con música y ritmo' }
  ];
  var LANGUAGES = [{ key: 'es', label: 'Español' }, { key: 'en', label: 'Inglés' }, { key: 'pt', label: 'Portugués' }];

  function validate(model, p) {
    if (!model) return 'Modelo no disponible.';
    if (!model.durations || model.durations.indexOf(Number(p.duration)) < 0) return 'Duración no disponible para este modelo.';
    if (model.per_second_usd[p.resolution] == null) return 'Resolución no disponible para este modelo.';
    if (!(Number(model.per_second_usd[p.resolution]) > 0)) return 'Este modelo todavía no tiene precio configurado.';
    if (model.aspect_ratios.indexOf(p.aspect) < 0) return 'Formato no disponible para este modelo.';
    if (p.angle_mode !== 'ai' && p.angle_mode !== 'user') return 'Elige cómo se define el ángulo de venta.';
    return null;
  }

  function videoCost(model, p) {
    var c = usd(model.per_second_usd[p.resolution]) * Number(p.duration);
    if (p.music) c = Math.round(c * Number(model.audio_multiplier || 1));
    return c;
  }

  // Price range shown to the customer before generating. `max` is what gets held in the wallet.
  function quote(model, p, S) {
    var video = videoCost(model, p);
    var videoMax = Math.round(video * (1 + Number(S.video_contingency_pct || 0) / 100));
    var ai = p.angle_mode === 'ai';
    var aiMin = ai ? usd(S.ai_cost_min_usd) : 0;
    var aiMax = ai ? usd(S.ai_cost_max_usd) : 0;
    var rate = Number(S.service_fee_pct) / 100;
    var aiFee = ai ? usd(S.ai_fixed_fee_usd) : 0;
    var feeMin = Math.round((video + aiMin) * rate);
    var feeMax = Math.round((videoMax + aiMax) * rate);
    return {
      video: video, videoMax: videoMax, aiMin: aiMin, aiMax: aiMax, aiFee: aiFee, rate: rate,
      feeMin: feeMin, feeMax: feeMax,
      min: video + aiMin + feeMin + aiFee,
      max: videoMax + aiMax + feeMax + aiFee
    };
  }

  // Final price once real costs are known. Never more than the hold.
  function settle(S, actual, hold) {
    var rate = Number(S.service_fee_pct) / 100;
    var base = actual.videoMicro + actual.aiMicro;
    var fee = Math.round(base * rate);
    var aiFee = actual.ai ? usd(S.ai_fixed_fee_usd) : 0;
    var total = base + fee + aiFee;
    return { base: base, fee: fee, aiFee: aiFee, total: total, charged: Math.min(total, hold) };
  }

  // Top-up: the customer chooses the amount that lands in the wallet; the gateway fee is added on top, visibly.
  function topup(netMicro, S) {
    var pct = Number(S.topup_fee_pct) / 100, fixed = usd(S.topup_fee_fixed_usd);
    var gross = Math.ceil((netMicro + fixed) / (1 - pct));
    return { net: netMicro, fee: gross - netMicro, gross: gross };
  }

  function aiCostFromUsage(S, inTok, outTok) {
    return Math.round((inTok * Number(S.ai_price_in_per_mtok_usd) + outTok * Number(S.ai_price_out_per_mtok_usd)));
    // tokens * (USD per million tokens) = micro-USD directly
  }

  function fmt(micro, digits) {
    var d = digits == null ? 2 : digits;
    return '$' + (micro / MICRO).toFixed(d);
  }
  // Quotes are rounded UP to the cent so the customer is never shown less than what may be charged.
  function fmtUp(micro) { return '$' + (Math.ceil(micro / 10000 - 1e-9) / 100).toFixed(2); }
  function range(q) { return q.min === q.max ? fmtUp(q.min) : fmtUp(q.min) + ' a ' + fmtUp(q.max); }

  return { MICRO: MICRO, usd: usd, toUsd: toUsd, STYLES: STYLES, LANGUAGES: LANGUAGES, validate: validate, videoCost: videoCost,
    quote: quote, settle: settle, topup: topup, aiCostFromUsage: aiCostFromUsage, fmt: fmt, fmtUp: fmtUp, range: range };
})();
if (typeof module === 'object' && module.exports) module.exports = Pricing;
