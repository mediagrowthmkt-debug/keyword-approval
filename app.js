/* Validador de palavras-chave — MediaGrowth
   Pagina estatica (GitHub Pages) + backend PHP por slug (Hostinger/VPS).
   Le o seed clients/<slug>.json e sincroniza o estado vivo com api.php. */
(function () {
  "use strict";
  var API = (window.KW_CONFIG && window.KW_CONFIG.apiBase) || "";
  var params = new URLSearchParams(location.search);
  var SLUG = (params.get("c") || params.get("slug") || "magicis").toLowerCase().replace(/[^a-z0-9\-]/g, "");

  var seed = null;               // { client, brand, categories:[{name,hint,monitor,keywords:[]}] }
  var state = { decisions: {}, suggestions: [], reviewer: "" };
  var filter = "all";
  var query = "";
  var allKeys = [];              // todas as chaves (ordem)

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  }); }

  /* ---------- rede ---------- */
  function apiGet() {
    return fetch(API + "?action=get&slug=" + encodeURIComponent(SLUG), { cache: "no-store" })
      .then(function (r) { return r.json(); });
  }
  var saveTimer = null, savedTimer = null;
  function post(action, data) {
    var body = new URLSearchParams();
    body.set("action", action); body.set("slug", SLUG);
    Object.keys(data).forEach(function (k) { body.set(k, data[k] == null ? "" : data[k]); });
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
      .then(function (r) { return r.json(); });
  }
  function flashSaved(ok) {
    var el = $("saved");
    if (!el) return;
    clearTimeout(savedTimer);
    if (ok === false) { el.textContent = "sem conexão"; el.classList.remove("on"); return; }
    el.textContent = "salvando..."; el.classList.remove("on");
    savedTimer = setTimeout(function () { el.textContent = "salvo ✓"; el.classList.add("on"); }, 250);
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- estado ---------- */
  function decOf(key) { return state.decisions[key] || { status: "pending", note: "" }; }
  function reviewerName() { return ($("reviewer").value || state.reviewer || "").trim(); }

  function saveDecision(key) {
    var d = decOf(key);
    flashSaved();
    post("decide", { kw: key, status: d.status, note: d.note || "", by: reviewerName() })
      .then(function () { flashSaved(true); })
      .catch(function () { flashSaved(false); toast("Não consegui salvar. Verifique a conexão."); });
  }

  function setStatus(key, status) {
    var d = state.decisions[key] || { status: "pending", note: "" };
    d.status = (d.status === status) ? "pending" : status;  // toggle
    state.decisions[key] = d;
    if (d.status === "pending" && !d.note) delete state.decisions[key];
    else state.decisions[key] = d;
    saveDecision(key);
    render();
  }

  function setNote(key, note) {
    var d = state.decisions[key] || { status: "pending", note: "" };
    d.note = note;
    if (d.status === "pending" && !note) { delete state.decisions[key]; }
    else state.decisions[key] = d;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveDecision(key); }, 600);
  }

  /* ---------- contagem ---------- */
  function counts() {
    var ap = 0, re = 0;
    allKeys.forEach(function (k) {
      var s = decOf(k).status;
      if (s === "approved") ap++; else if (s === "rejected") re++;
    });
    var total = allKeys.length;
    return { ap: ap, re: re, pe: total - ap - re, total: total, done: ap + re };
  }

  /* ---------- render ---------- */
  function matchFilter(key) {
    var d = decOf(key);
    if (filter === "approved") return d.status === "approved";
    if (filter === "rejected") return d.status === "rejected";
    if (filter === "pending") return d.status !== "approved" && d.status !== "rejected";
    if (filter === "noted") return !!(d.note && d.note.trim());
    return true;
  }
  function matchQuery(kw) { return !query || kw.toLowerCase().indexOf(query) !== -1; }

  function render() {
    // topo
    var c = counts();
    $("n-done").textContent = c.done; $("n-total").textContent = c.total;
    $("n-ap").textContent = c.ap; $("n-re").textContent = c.re; $("n-pe").textContent = c.pe;
    $("pa").style.width = (c.total ? (c.ap / c.total * 100) : 0) + "%";
    $("pr").style.width = (c.total ? (c.re / c.total * 100) : 0) + "%";
    $("s-ap").textContent = c.ap; $("s-re").textContent = c.re; $("s-pe").textContent = c.pe;
    $("s-su").textContent = state.suggestions.length;
    $("s-done").textContent = c.pe === 0
      ? "Tudo avaliado! " + c.ap + " palavras aprovadas. Obrigado, pode fechar a página."
      : "Vai salvando sozinho conforme você marca. Pode fechar e voltar depois.";

    // categorias
    var host = $("cats");
    var html = "";
    var anyVisible = false;
    seed.categories.forEach(function (cat, ci) {
      var rows = "";
      var visN = 0, apN = 0;
      cat.keywords.forEach(function (kw) {
        var key = kw;
        var d = decOf(key);
        if (d.status === "approved") apN++;
        if (!matchFilter(key) || !matchQuery(kw)) return;
        visN++;
        var cls = d.status === "approved" ? " approved" : d.status === "rejected" ? " rejected" : "";
        var noteOpen = window.__openNotes && window.__openNotes[key];
        rows +=
          '<div class="kw' + cls + '" data-key="' + esc(key) + '">' +
            '<div class="kw-main">' +
              '<div class="kw-text">' + esc(kw) + '</div>' +
              (d.note ? '<div class="kw-note-preview">“' + esc(d.note) + '”</div>' : '') +
            '</div>' +
            '<div class="kw-actions">' +
              '<button class="btn-note' + (d.note ? ' has' : '') + '" data-act="note" title="Observação">✎</button>' +
              '<button class="btn-ok" data-act="ok"><span>✓</span><span class="lbl">Aprovar</span></button>' +
              '<button class="btn-no" data-act="no" title="Reprovar">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="kw-note' + (noteOpen ? ' open' : '') + '" data-notefor="' + esc(key) + '">' +
            '<textarea placeholder="Por que sim, por que não, ou um ajuste no termo...">' + esc(d.note || "") + '</textarea>' +
            '<div class="hint">Salva sozinho ao terminar de escrever.</div>' +
          '</div>';
      });
      if (visN === 0) return;
      anyVisible = true;
      var closed = window.__closedCats && window.__closedCats[ci] ? " closed" : "";
      html +=
        '<section class="cat' + (cat.monitor ? " monitor" : "") + closed + '" data-ci="' + ci + '">' +
          '<div class="cat-head" data-act="toggle">' +
            '<span class="caret">▾</span>' +
            '<div class="cat-title"><div class="n">' + esc(cat.name) +
              (cat.monitor ? ' <span class="badge-mon">só monitorar</span>' : '') +
              '</div>' + (cat.hint ? '<div class="h">' + esc(cat.hint) + '</div>' : '') + '</div>' +
            '<span class="cat-count">' + apN + '/' + cat.keywords.length + ' ✓</span>' +
          '</div>' +
          '<div class="cat-body">' + rows + '</div>' +
        '</section>';
    });
    host.innerHTML = anyVisible ? html : '<div class="empty">Nenhuma palavra-chave nesse filtro.</div>';

    renderSuggestions();
  }

  function renderSuggestions() {
    var host = $("sug-list");
    if (!state.suggestions.length) { host.innerHTML = ""; return; }
    host.innerHTML = state.suggestions.map(function (s) {
      return '<div class="sug-item" data-id="' + esc(s.id) + '">' +
        '<div class="t">' + esc(s.text) + (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</div>' +
        '<button data-act="delsug" title="Remover">✕</button></div>';
    }).join("");
  }

  /* ---------- eventos ---------- */
  function bind() {
    // delegação de cliques
    $("cats").addEventListener("click", function (e) {
      var actEl = e.target.closest("[data-act]");
      if (!actEl) return;
      var act = actEl.getAttribute("data-act");
      if (act === "toggle") {
        var sec = actEl.closest(".cat"); var ci = sec.getAttribute("data-ci");
        window.__closedCats = window.__closedCats || {};
        window.__closedCats[ci] = !window.__closedCats[ci];
        sec.classList.toggle("closed"); return;
      }
      var row = actEl.closest(".kw"); if (!row) return;
      var key = row.getAttribute("data-key");
      if (act === "ok") setStatus(key, "approved");
      else if (act === "no") setStatus(key, "rejected");
      else if (act === "note") {
        window.__openNotes = window.__openNotes || {};
        window.__openNotes[key] = !window.__openNotes[key];
        var nb = document.querySelector('.kw-note[data-notefor="' + cssq(key) + '"]');
        if (nb) { nb.classList.toggle("open"); if (nb.classList.contains("open")) { var ta = nb.querySelector("textarea"); if (ta) ta.focus(); } }
      }
    });
    // notas (input)
    $("cats").addEventListener("input", function (e) {
      if (e.target.tagName === "TEXTAREA") {
        var nb = e.target.closest(".kw-note"); var key = nb.getAttribute("data-notefor");
        setNote(key, e.target.value);
        var btn = document.querySelector('.kw[data-key="' + cssq(key) + '"] .btn-note');
        if (btn) btn.classList.toggle("has", !!e.target.value.trim());
      }
    });

    // filtros
    $("chips").addEventListener("click", function (e) {
      var chip = e.target.closest(".chip"); if (!chip) return;
      filter = chip.getAttribute("data-f");
      [].forEach.call(document.querySelectorAll(".chip"), function (c) { c.classList.toggle("on", c === chip); });
      render();
    });
    // busca
    var qt = null;
    $("q").addEventListener("input", function (e) {
      clearTimeout(qt); var v = e.target.value.trim().toLowerCase();
      qt = setTimeout(function () { query = v; render(); }, 150);
    });

    // reviewer
    var rv = $("reviewer");
    rv.value = localStorage.getItem("kw_reviewer_" + SLUG) || state.reviewer || "";
    rv.addEventListener("change", function () {
      var v = rv.value.trim();
      localStorage.setItem("kw_reviewer_" + SLUG, v);
      state.reviewer = v;
      if (v) post("reviewer", { by: v }).catch(function () {});
    });

    // sugestões
    $("sug-add").addEventListener("click", addSuggestion);
    $("sug-text").addEventListener("keydown", function (e) { if (e.key === "Enter") addSuggestion(); });
    $("sug-list").addEventListener("click", function (e) {
      var b = e.target.closest('[data-act="delsug"]'); if (!b) return;
      var id = b.closest(".sug-item").getAttribute("data-id");
      state.suggestions = state.suggestions.filter(function (s) { return s.id !== id; });
      renderSuggestions(); render();
      post("delsuggest", { id: id }).catch(function () {});
    });
  }
  function cssq(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  function addSuggestion() {
    var t = $("sug-text").value.trim();
    var n = $("sug-note").value.trim();
    if (!t) { $("sug-text").focus(); return; }
    flashSaved();
    post("suggest", { text: t, note: n, by: reviewerName() })
      .then(function (st) { if (st && st.suggestions) state.suggestions = st.suggestions; renderSuggestions(); render(); flashSaved(true); toast("Sugestão adicionada."); })
      .catch(function () { flashSaved(false); toast("Não consegui salvar a sugestão."); });
    $("sug-text").value = ""; $("sug-note").value = "";
    $("sug-text").focus();
  }

  /* ---------- boot ---------- */
  function applyBrand() {
    var b = seed.brand || {};
    var r = document.documentElement.style;
    if (b.primary) r.setProperty("--brand", b.primary);
    if (b.primaryDark) r.setProperty("--brand-dark", b.primaryDark);
    document.title = (seed.client ? seed.client + " · " : "") + (seed.title || "Validação de Palavras-chave");
    $("client").textContent = seed.client || "";
    $("title").textContent = seed.title || "Validação de Palavras-chave";
    $("subtitle").textContent = seed.subtitle || "";
    $("intro").textContent = seed.intro || "";
    if (b.logo) { var l = $("logo"); l.src = b.logo; l.style.display = ""; l.onerror = function () { l.style.display = "none"; }; l.alt = seed.client || ""; }
  }

  function fail(msg) { $("cats").innerHTML = '<div class="empty">' + esc(msg) + '</div>'; }

  fetch("clients/" + SLUG + ".json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("seed"); return r.json(); })
    .then(function (s) {
      seed = s;
      allKeys = [];
      seed.categories.forEach(function (cat) { cat.keywords.forEach(function (kw) { allKeys.push(kw); }); });
      applyBrand();
      return apiGet().catch(function () { return null; });
    })
    .then(function (live) {
      if (live && typeof live === "object") {
        state.decisions = live.decisions || {};
        state.suggestions = Array.isArray(live.suggestions) ? live.suggestions : [];
        state.reviewer = live.reviewer || "";
      }
      bind();
      render();
    })
    .catch(function () {
      fail("Não consegui carregar esta lista. Confira o link ou tente de novo.");
    });
})();
