/* Dictée FR — French spelling practice PWA. Vanilla JS, no build step. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------- storage ---------------- */
  const DEFAULT_WORDS = ["bonjour", "école", "maison", "chat", "fenêtre", "jeudi", "orange", "cahier"];
  const store = {
    words() {
      try {
        const r = JSON.parse(localStorage.getItem("df_words"));
        return Array.isArray(r) ? r : DEFAULT_WORDS.slice();
      } catch { return DEFAULT_WORDS.slice(); }
    },
    saveWords(a) {
      try {
        localStorage.setItem("df_words", JSON.stringify(a));
        localStorage.setItem("df_words_at", String(Date.now()));
      } catch {}
    },
    saveWordsFromSync(a, ts, replacedAt) {
      try {
        localStorage.setItem("df_words", JSON.stringify(a));
        localStorage.setItem("df_words_at", String(ts));
        if (replacedAt != null) localStorage.setItem("df_words_replaced_at", String(replacedAt));
        localStorage.setItem("df_synced_at", String(Date.now()));
      } catch {}
    },
    replaceWords(a) {
      try {
        const now = Date.now();
        localStorage.setItem("df_words", JSON.stringify(a));
        localStorage.setItem("df_words_at", String(now));
        localStorage.setItem("df_words_replaced_at", String(now));
      } catch {}
    },
    wordsUpdatedAt() { const r = parseInt(localStorage.getItem("df_words_at"), 10); return isFinite(r) ? r : 0; },
    wordsReplacedAt() { const r = parseInt(localStorage.getItem("df_words_replaced_at"), 10); return isFinite(r) ? r : 0; },
    familyCode() { return localStorage.getItem("df_code") || ""; },
    setFamilyCode(c) { try { localStorage.setItem("df_code", c); } catch {} },
    rate() { const r = parseFloat(localStorage.getItem("df_rate")); return isFinite(r) ? r : 0.9; },
    setRate(r) { try { localStorage.setItem("df_rate", String(r)); } catch {} },
    stats() {
      try { const r = JSON.parse(localStorage.getItem("df_stats")); return r && typeof r === "object" ? r : {}; }
      catch { return {}; }
    },
    saveStats(obj) {
      try {
        localStorage.setItem("df_stats", JSON.stringify(obj));
        localStorage.setItem("df_stats_at", String(Date.now()));
      } catch {}
    },
    saveStatsFromSync(obj, ts) {
      try {
        localStorage.setItem("df_stats", JSON.stringify(obj));
        localStorage.setItem("df_stats_at", String(ts));
      } catch {}
    },
    statsUpdatedAt() { const r = parseInt(localStorage.getItem("df_stats_at"), 10); return isFinite(r) ? r : 0; },
  };

  /* ---------------- practice stats ("Mots à revoir") ---------------- */
  const normWord = (s) => String(s || "").trim().toLowerCase();

  const stats = (() => {
    const AGE_OUT_MS = 28 * 24 * 60 * 60 * 1000; // 4 weeks with no miss -> graduated
    const GRAD_BOX = 4;   // after a miss: 3 correct answers (box 1->2->3->4) graduates it
    const MAX_BOX = 4;
    const CAP = 18;       // most words in one review session

    const now = () => Date.now();
    const load = () => store.stats();
    const save = (m) => store.saveStats(m);

    function entryFor(m, word) {
      const k = normWord(word);
      if (!m[k]) m[k] = { text: word, box: 1, seen: 0, miss: 0, lastMissAt: 0, pinned: false };
      return m[k];
    }

    /** Record one round's outcome for a word. missed = wrong at least once, or answer revealed. */
    function record(word, missed) {
      if (!word) return;
      const m = load();
      const e = entryFor(m, word);
      e.text = word;
      e.seen++;
      if (missed) { e.box = 1; e.miss++; e.lastMissAt = now(); }
      else { e.box = Math.min(MAX_BOX, e.box + 1); }
      save(m);
    }

    const isAgedOut = (e) => !e.pinned && e.box < GRAD_BOX && e.lastMissAt > 0 && (now() - e.lastMissAt) > AGE_OUT_MS;
    // On the list only if she has actually missed it (or it's pinned) and hasn't graduated.
    const onList = (e) => e.pinned || (e.miss > 0 && e.box < GRAD_BOX && !isAgedOut(e));

    /** Count of words currently due for review. */
    function dueCount() {
      const m = load();
      return Object.values(m).filter(onList).length;
    }

    /** Words to practise this session: weighted toward box 1 / pinned, capped, shuffled. */
    function poolWords() {
      const m = load();
      const due = Object.entries(m).filter(([, e]) => onList(e));
      const bag = [];
      for (const [, e] of due) {
        const w = (e.box === 1 ? 3 : 1) + (e.pinned ? 2 : 0);
        for (let i = 0; i < w; i++) bag.push(e.text);
      }
      shuffle(bag);
      const out = [];
      const seen = new Set();
      for (const t of bag) { const k = normWord(t); if (!seen.has(k)) { seen.add(k); out.push(t); } if (out.length >= CAP) break; }
      return out;
    }

    /** For the "Gérer les mots" review section: on-list entries, hardest first. */
    function listForManage() {
      const m = load();
      return Object.values(m).filter(onList)
        .sort((a, b) => (a.pinned - b.pinned) || (a.box - b.box) || (b.lastMissAt - a.lastMissAt))
        .map((e) => ({ text: e.text, box: e.box, miss: e.miss, pinned: e.pinned }));
    }

    function master(word) {
      const m = load();
      const k = normWord(word);
      if (m[k]) { m[k].box = MAX_BOX; m[k].pinned = false; save(m); }
    }
    function setPinned(word, on) {
      const m = load();
      const e = entryFor(m, word);
      e.pinned = !!on;
      save(m);
    }
    function isPinned(word) {
      const e = load()[normWord(word)];
      return !!(e && e.pinned);
    }

    /** Drop clearly-finished entries; nudge aged-out ones to graduated. Called on "Nouvelle semaine". */
    function prune() {
      const m = load();
      let changed = false;
      for (const k of Object.keys(m)) {
        const e = m[k];
        if (isAgedOut(e)) { e.box = GRAD_BOX; changed = true; }
        if (!e.pinned && e.box >= GRAD_BOX && (e.lastMissAt === 0 || (now() - e.lastMissAt) > AGE_OUT_MS)) {
          delete m[k]; changed = true;
        }
      }
      if (changed) save(m);
    }

    function mergeInto(local, remote) {
      const out = {};
      for (const k of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
        const l = (local && local[k]) || null;
        const r = (remote && remote[k]) || null;
        if (l && !r) { out[k] = l; continue; }
        if (r && !l) { out[k] = r; continue; }
        out[k] = {
          text: (l.text && l.text.length >= (r.text || "").length) ? l.text : (r.text || l.text),
          box: Math.max(l.box || 1, r.box || 1),
          seen: Math.max(l.seen || 0, r.seen || 0),
          miss: Math.max(l.miss || 0, r.miss || 0),
          lastMissAt: Math.max(l.lastMissAt || 0, r.lastMissAt || 0),
          pinned: !!(l.pinned || r.pinned),
        };
      }
      return out;
    }

    /** Remove every graduated (non-pinned) word from the store. Manual "tidy up". */
    function clearMastered() {
      const m = load();
      let n = 0;
      for (const k of Object.keys(m)) {
        if (!m[k].pinned && !onList(m[k])) { delete m[k]; n++; }
      }
      if (n) save(m);
      return n;
    }

    const boxDots = (box) => "●".repeat(Math.min(box, MAX_BOX)) + "○".repeat(Math.max(0, MAX_BOX - box));

    return { record, dueCount, poolWords, listForManage, master, setPinned, isPinned, prune, clearMastered, mergeInto, boxDots };
  })();

  /* ---------------- speech ---------------- */
  const canSpeak = "speechSynthesis" in window;
  let frVoice = null;
  function pickVoice() {
    if (!canSpeak) return;
    const vs = speechSynthesis.getVoices().filter((v) => /^fr(-|_|$)/i.test(v.lang));
    frVoice = vs.find((v) => /fr[-_]fr/i.test(v.lang)) || vs.find((v) => /france/i.test(v.name)) || vs[0] || null;
  }
  if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function say(text, opts = {}) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = "fr-FR";
      if (frVoice) u.voice = frVoice;
      u.rate = opts.rate != null ? opts.rate : store.rate();
      speechSynthesis.speak(u);
    } catch {}
  }
  function sayQueue(parts, rate) {
    if (!canSpeak) return;
    try {
      speechSynthesis.cancel();
      for (const p of parts) {
        const u = new SpeechSynthesisUtterance(String(p));
        u.lang = "fr-FR";
        if (frVoice) u.voice = frVoice;
        u.rate = rate != null ? rate : store.rate();
        speechSynthesis.speak(u);
      }
    } catch {}
  }
  function letterName(c) {
    return c === " " ? "espace" : c === "-" ? "trait d'union" : c === "'" ? "apostrophe" : c;
  }
  function spellSlowly(word) {
    if (!word) return;
    const r = Math.max(0.4, store.rate() - 0.2);
    sayQueue([word, ...[...word].map(letterName)], r);
  }

  /* ---------------- sound effects ---------------- */
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (canSpeak) { try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch {} }
    try { const a = new Audio("./sfx/correct.wav"); a.volume = 0; a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {}); } catch {}
  }
  document.addEventListener("pointerdown", unlock, { once: true });

  function feedback(kind) {
    try { const a = new Audio("./sfx/" + kind + ".wav"); a.play().catch(() => {}); } catch {}
    setTimeout(() => say(kind === "correct" ? "Bravo !" : "Essaie encore", { rate: 1 }), 380);
    if (kind === "correct") celebrate.correct(); else celebrate.reset();
  }

  /* ---------------- celebration (confetti + mascot pop) ---------------- */
  const celebrate = (() => {
    let streak = 0;
    const COLORS = ["#1565c0", "#e23b3b", "#fac775", "#ffffff", "#85b7eb"];
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Hand-rolled canvas confetti — no external dependency, works offline.
    function burst(big) {
      if (reduced) return;
      let cv = document.getElementById("confetti-canvas");
      if (!cv) {
        cv = document.createElement("canvas");
        cv.id = "confetti-canvas";
        document.body.appendChild(cv);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = (cv.width = Math.floor(innerWidth * dpr));
      const H = (cv.height = Math.floor(innerHeight * dpr));
      const ctx = cv.getContext("2d");
      const n = big ? 150 : 90;
      const originY = H * 0.32;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        parts.push({
          x: left ? W * 0.12 : W * 0.88,
          y: originY + (Math.random() * 40 - 20) * dpr,
          vx: (left ? 1 : -1) * (3 + Math.random() * 7) * dpr,
          vy: -(6 + Math.random() * 8) * dpr,
          w: (5 + Math.random() * 6) * dpr,
          h: (8 + Math.random() * 8) * dpr,
          rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 0.5,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          round: Math.random() < 0.35,
        });
      }
      const g = 0.35 * dpr;
      let alive = parts.length;
      function frame() {
        ctx.clearRect(0, 0, W, H);
        alive = 0;
        for (const p of parts) {
          p.vy += g;
          p.vx *= 0.99;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          if (p.y > H + 30) continue;
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.round) {
            ctx.beginPath();
            ctx.arc(0, 0, p.w / 2, 0, 6.28);
            ctx.fill();
          } else {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
          ctx.restore();
        }
        if (alive) requestAnimationFrame(frame);
        else cv.remove();
      }
      requestAnimationFrame(frame);
    }

    function popMascot(big) {
      let m = document.getElementById("celebrate-mascot");
      if (!m) {
        m = document.createElement("img");
        m.id = "celebrate-mascot";
        m.src = "./icons/mascot.png";
        m.alt = "";
        document.body.appendChild(m);
      }
      m.style.width = m.style.height = (big ? 168 : 132) + "px";
      m.classList.remove("show");
      void m.offsetWidth;
      m.classList.add("show");
      clearTimeout(popMascot._t);
      popMascot._t = setTimeout(() => m.classList.remove("show"), big ? 1500 : 1100);
    }

    return {
      correct() {
        streak++;
        const big = streak % 3 === 0;
        burst(big);
        popMascot(big);
      },
      reset() { streak = 0; },
    };
  })();

  /* ---------------- spelling checker ---------------- */
  function checkSpelling(target, guess) {
    const t = target.trim(), g = guess.trim();
    const n = t.length, m = g.length;
    const eq = (a, b) => a.toLowerCase() === b.toLowerCase();
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) dp[i][0] = i;
    for (let j = 0; j <= m; j++) dp[0][j] = j;
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++) {
        const cost = eq(t[i - 1], g[j - 1]) ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    let i = n, j = m;
    const ops = [];
    while (i > 0 || j > 0) {
      const diag = i > 0 && j > 0 && eq(t[i - 1], g[j - 1]) ? 0 : 1;
      if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + diag) {
        ops.push({ k: diag === 0 ? "M" : "S", t: t[i - 1], g: g[j - 1] }); i--; j--;
      } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
        ops.push({ k: "MISS", t: t[i - 1] }); i--;
      } else {
        ops.push({ k: "EXTRA", g: g[j - 1] }); j--;
      }
    }
    ops.reverse();
    return {
      correct: n === m && ops.every((o) => o.k === "M"),
      correctCount: ops.filter((o) => o.k === "M").length,
      total: n,
      ops,
    };
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function renderRow(res, targetRow) {
    const sp = (txt, cls) => `<span class="${cls}">${esc(txt)}</span> `;
    let html = "";
    for (const o of res.ops) {
      if (o.k === "M") html += sp(targetRow ? o.t : o.g, "ok");
      else if (o.k === "S") html += sp(targetRow ? o.t : o.g, "bad");
      else if (o.k === "MISS") html += targetRow ? sp(o.t, "bad under") : sp("_", "dim");
      else html += targetRow ? sp("·", "dim") : sp(o.g, "bad strike");
    }
    return html;
  }
  const greenWord = (w) => [...w].map((c) => `<span class="ok">${esc(c)}</span>`).join(" ");

  /* ---------------- distractors (for "Le bon mot") ---------------- */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function distractors(word, count = 3) {
    const w = word.trim();
    if (w.length < 2) return Array.from({ length: count }, (_, i) => w + "x".repeat(i + 1));
    const lower = w.toLowerCase();
    const out = new Set();
    const acc = { "é": "eè", "è": "eé", "ê": "eé", "ë": "e", "e": "éè", "à": "a", "â": "a", "a": "à", "ç": "c", "c": "ç", "ù": "u", "û": "u", "ü": "u", "î": "i", "ï": "i", "ô": "o" };
    const mc = (o, r) => (o === o.toUpperCase() ? r.toUpperCase() : r);
    [...w].forEach((ch, i) => {
      const alts = acc[ch.toLowerCase()];
      if (!alts) return;
      for (const r of alts) out.add(w.slice(0, i) + mc(ch, r) + w.slice(i + 1));
    });
    const dbl = "lmnprtsfcdgz";
    for (let i = 0; i < w.length; i++) {
      const c = w[i].toLowerCase();
      if (dbl.includes(c)) out.add(w.slice(0, i + 1) + w[i] + w.slice(i + 1));
      if (i + 1 < w.length && c === w[i + 1].toLowerCase() && dbl.includes(c)) out.add(w.slice(0, i) + w.slice(i + 1));
    }
    const endings = [
      ["er", ["é", "ez", "ai"]], ["é", ["er", "ée", "ai"]], ["ée", ["é", "er"]], ["ez", ["er", "é"]],
      ["eau", ["au", "o"]], ["au", ["eau", "o"]], ["tion", ["sion", "cion"]], ["sion", ["tion"]],
      ["ent", ["ant", "ents"]], ["ai", ["é", "è", "ei"]], ["ph", ["f"]], ["s", ["", "x"]], ["x", ["s"]],
    ];
    for (const [suf, alts] of endings)
      if (suf && lower.endsWith(suf)) for (const a of alts) out.add(w.slice(0, w.length - suf.length) + a);
    for (let i = 0; i < w.length - 1; i++) {
      if (w[i].toLowerCase() !== w[i + 1].toLowerCase() && w[i] !== " " && w[i + 1] !== " ") {
        const a = [...w]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; out.add(a.join(""));
      }
    }
    if (w.length > 3 && "estx".includes(w[w.length - 1].toLowerCase())) out.add(w.slice(0, -1));
    const vw = { a: "e", e: "a", i: "y", o: "au", u: "ou", y: "i" };
    [...w].forEach((ch, i) => {
      const a = vw[ch.toLowerCase()];
      if (!a) return;
      out.add(w.slice(0, i) + (ch === ch.toUpperCase() ? a[0].toUpperCase() + a.slice(1) : a) + w.slice(i + 1));
    });
    let list = [...out].filter((s) => s && s.toLowerCase() !== lower && s.length >= 2 && Math.abs(s.length - w.length) <= 2);
    list = [...new Set(list)];
    shuffle(list);
    const res = list.slice(0, count);
    let i = 0;
    while (res.length < count && i < w.length - 1) {
      const a = [...w]; [a[i], a[i + 1]] = [a[i + 1], a[i]];
      const c = a.join("");
      if (c !== w && !res.includes(c)) res.push(c);
      i++;
    }
    while (res.length < count) res.push(w + "s".repeat(res.length + 1));
    return res.slice(0, count);
  }

  /* ---------------- routing ---------------- */
  const TITLES = { home: "Dictée FR", scramble: "Lettres mélangées", choice: "Le bon mot", dictee: "Écris le mot", words: "Gérer les mots", scan: "Scanner une liste" };
  let reviewMode = false;
  const sourceWords = () => (reviewMode ? stats.poolWords() : store.words());
  const emptyMsg = () => (reviewMode
    ? "Aucun mot à revoir pour l'instant. 🎉"
    : "Ajoute d'abord des mots (« Gérer les mots »).");
  function show(view) {
    $$("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== view));
    $("#backBtn").hidden = view === "home";
    $("#topTitle").textContent = TITLES[view] || "Dictée FR";
    window.scrollTo(0, 0);
    if (view === "home") refreshHome();
  }
  $("#backBtn").addEventListener("click", () => {
    if (canSpeak) speechSynthesis.cancel();
    $$("body > .tile").forEach((t) => t.remove());
    show("home");
  });
  const game = (v) => ({ scramble, choice, dictee, words, scan }[v]);
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.go;
    reviewMode = false;
    game(v).start();
    show(v);
  }));

  $("#reviewBtn").addEventListener("click", () => {
    $("#reviewChooser").hidden = !$("#reviewChooser").hidden;
  });
  $("#reviewCancel").addEventListener("click", () => { $("#reviewChooser").hidden = true; });
  $$("[data-review]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.review;
    reviewMode = true;
    $("#reviewChooser").hidden = true;
    game(v).start();
    show(v);
  }));

  function refreshHome() {
    reviewMode = false;
    $("#reviewChooser").hidden = true;
    const n = store.words().length;
    $("#wordCount").textContent = n === 1 ? "1 mot dans la liste" : n + " mots dans la liste";
    $("#rate").value = String(store.rate());
    const due = stats.dueCount();
    const rb = $("#reviewBtn");
    rb.hidden = due === 0;
    rb.textContent = `🔁  Mots à revoir (${due})`;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    $("#installHint").hidden = !!standalone;
  }
  $("#rate").addEventListener("change", (e) => { store.setRate(parseFloat(e.target.value)); say("Voici la vitesse de la voix"); });

  function endPrompt(score, aided, total, restart) {
    const again = window.confirm(`Terminé !\nSans aide : ${score} / ${total}\nAvec aide : ${aided}\n\nRecommencer ?`);
    if (again) restart(); else show("home");
  }

  /* ================= SCRAMBLE ================= */
  const scramble = (() => {
    let list = [], order = [], pos = 0, score = 0, aided = 0, solved = false, hinted = false, wrongThisWord = false;
    let slotChars = [];
    const wordStart = new Set();

    const slotsEl = () => $("#slots");
    const trayEl = () => $("#tray");
    const slotEls = () => $$("#slots .slot");
    const tileIn = (s) => s.querySelector(".tile");
    const allFilled = () => slotEls().every((s) => tileIn(s));
    const curWord = () => list[order[pos]];
    const progressText = () =>
      (reviewMode ? "Révision · " : "") +
      `Mot ${pos + 1} / ${order.length}     Score : ${score}` + (aided > 0 ? `   ·   avec aide : ${aided}` : "");

    function start() {
      list = sourceWords();
      const empty = list.length === 0;
      $("#scrEmpty").textContent = emptyMsg();
      $("#scrEmpty").hidden = !empty;
      $("#board").hidden = empty;
      $("#scrControls").hidden = empty;
      $("#scrNext").hidden = true;
      $("#scrFeedback").textContent = "";
      $("#scrProgress").textContent = "";
      if (empty) return;
      order = [...list.keys()];
      shuffle(order);
      pos = 0; score = 0; aided = 0;
      round();
    }

    function round() {
      cleanupOrphans();
      solved = false; hinted = false; wrongThisWord = false;
      $("#scrFeedback").textContent = "";
      $("#scrFeedback").className = "feedback";
      $("#scrNext").hidden = true;
      const spec = [...curWord()];
      slotChars = spec.filter((c) => c !== " ");
      wordStart.clear();
      slotsEl().innerHTML = "";
      trayEl().innerHTML = "";
      let li = 0, brk = true;
      for (const c of spec) {
        if (c === " ") {
          brk = true;
          const g = document.createElement("div");
          g.className = "slot-gap";
          slotsEl().appendChild(g);
        } else {
          if (brk) wordStart.add(li);
          brk = false;
          const s = document.createElement("div");
          s.className = "slot";
          s.dataset.slot = String(li);
          slotsEl().appendChild(s);
          li++;
        }
      }
      const letters = [...slotChars];
      if (letters.length > 1 && new Set(letters).size > 1) {
        let guard = 0;
        do { shuffle(letters); guard++; } while (letters.join("") === slotChars.join("") && guard < 20);
      }
      for (const L of letters) {
        const t = document.createElement("div");
        t.className = "tile";
        t.textContent = L;
        t.dataset.letter = L;
        attachDrag(t);
        trayEl().appendChild(t);
      }
      $("#scrProgress").textContent = progressText();
      say(curWord());
    }

    function runFor(k) {
      const slots = slotEls();
      if (!slots[k] || !tileIn(slots[k])) return "";
      let lo = k, hi = k;
      while (lo > 0 && !wordStart.has(lo) && tileIn(slots[lo - 1])) lo--;
      while (hi + 1 < slots.length && !wordStart.has(hi + 1) && tileIn(slots[hi + 1])) hi++;
      let s = "";
      for (let i = lo; i <= hi; i++) s += tileIn(slots[i]).dataset.letter;
      return s;
    }
    function announce(k) {
      const run = runFor(k);
      if (run.length >= 2) say(run, { rate: Math.max(0.5, store.rate() - 0.1) });
      else say(run || slotChars[k]);
    }

    function attachDrag(tile) {
      let dragging = false, dx = 0, dy = 0, pid = null, lastX = 0, lastY = 0;
      const onMove = (e) => {
        if (!dragging || e.pointerId !== pid) return;
        lastX = e.clientX; lastY = e.clientY;
        tile.style.left = e.clientX - dx + "px";
        tile.style.top = e.clientY - dy + "px";
      };
      const onEnd = (e) => {
        if (!dragging || (e.pointerId != null && e.pointerId !== pid)) return;
        dragging = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        const x = e.clientX ?? lastX, y = e.clientY ?? lastY;
        const under = document.elementFromPoint(x, y); // tile has pointer-events:none while .drag
        tile.classList.remove("drag");
        const slot = under && under.closest ? under.closest(".slot") : null;
        if (slot && !tileIn(slot)) placeInSlot(tile, slot);
        else returnToTray(tile);
      };
      tile.addEventListener("pointerdown", (e) => {
        if (solved || tile.classList.contains("locked")) return;
        pid = e.pointerId;
        const r = tile.getBoundingClientRect();
        dx = e.clientX - r.left;
        dy = e.clientY - r.top;
        lastX = e.clientX; lastY = e.clientY;
        dragging = true;
        tile.classList.add("drag");
        tile.style.width = r.width + "px";
        tile.style.height = r.height + "px";
        tile.style.left = r.left + "px";
        tile.style.top = r.top + "px";
        document.body.appendChild(tile); // out of any clipping container
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onEnd);
        window.addEventListener("pointercancel", onEnd);
        e.preventDefault();
      });
    }

    function cleanupOrphans() {
      $$("body > .tile").forEach((t) => t.remove());
    }

    function clearInline(t) { t.removeAttribute("style"); }
    function returnToTray(t) { clearInline(t); trayEl().appendChild(t); }
    function placeInSlot(tile, slot) {
      clearInline(tile);
      slot.appendChild(tile);
      const k = +slot.dataset.slot;
      const full = allFilled();
      announce(k);
      if (full) setTimeout(check, 700);
    }

    function check() {
      if (solved) return;
      const slots = slotEls();
      const right = slotChars.every((c, i) => {
        const t = tileIn(slots[i]);
        return t && t.dataset.letter.toLowerCase() === c.toLowerCase();
      });
      if (right) {
        solved = true;
        $$("#board .tile").forEach((t) => t.classList.add("locked", "good"));
        $("#scrFeedback").className = "feedback good";
        $("#scrFeedback").textContent = hinted ? "Bravo ! (avec aide)" : "Bravo ! 🎉";
        if (hinted) aided++; else score++;
        $("#scrProgress").textContent = progressText();
        stats.record(curWord(), wrongThisWord);
        feedback("correct");
        $("#scrNext").hidden = false;
      } else {
        wrongThisWord = true;
        $("#scrFeedback").className = "feedback bad";
        $("#scrFeedback").textContent = "Pas tout à fait — les lettres en rouge reviennent.";
        feedback("wrong");
        slotChars.forEach((c, i) => {
          const t = tileIn(slots[i]);
          if (t && t.dataset.letter.toLowerCase() !== c.toLowerCase()) {
            t.classList.add("bad");
            setTimeout(() => { t.classList.remove("bad"); returnToTray(t); }, 550);
          }
        });
      }
    }

    function hint() {
      if (solved) return;
      const slots = slotEls();
      const k = slots.findIndex((s) => !tileIn(s));
      if (k < 0) return;
      const want = slotChars[k].toLowerCase();
      let tile = $$("#tray .tile").find((t) => t.dataset.letter.toLowerCase() === want);
      if (!tile) {
        for (const s of slots) {
          const t = tileIn(s);
          if (t && t.dataset.letter.toLowerCase() === want && +s.dataset.slot !== k) { tile = t; break; }
        }
      }
      if (!tile) return;
      clearInline(tile);
      tile.classList.add("locked", "good");
      slots[k].appendChild(tile);
      hinted = true;
      const full = allFilled();
      announce(k);
      if (full) setTimeout(check, 700);
    }

    function next() {
      if (pos + 1 >= order.length) {
        endPrompt(score, aided, order.length, () => { shuffle(order); pos = 0; score = 0; aided = 0; round(); });
        return;
      }
      pos++;
      round();
    }

    $("#scrListen").addEventListener("click", () => say(curWord()));
    $("#scrHint").addEventListener("click", hint);
    $("#scrSpell").addEventListener("click", () => spellSlowly(curWord()));
    $("#scrNext").addEventListener("click", next);

    return { start };
  })();

  /* ================= CHOICE ================= */
  const choice = (() => {
    let list = [], order = [], pos = 0, score = 0, aided = 0, correctIdx = -1, solved = false, wrong = false;
    const opts = $$("#choice .opt");
    const curWord = () => list[order[pos]];
    const prog = () =>
      (reviewMode ? "Révision · " : "") +
      `Mot ${pos + 1} / ${order.length}     Score : ${score}` + (aided > 0 ? `   ·   avec aide : ${aided}` : "");

    function start() {
      list = sourceWords();
      const empty = list.length === 0;
      $("#choiceEmpty").textContent = emptyMsg();
      $("#choiceEmpty").hidden = !empty;
      $("#choiceListen").hidden = empty;
      $("#choiceInstruction").hidden = empty;
      opts.forEach((o) => (o.hidden = empty));
      $("#choiceNext").hidden = true;
      $("#choiceFeedback").textContent = "";
      $("#choiceProgress").textContent = "";
      if (empty) return;
      order = [...list.keys()];
      shuffle(order);
      pos = 0; score = 0; aided = 0;
      round();
    }

    function round() {
      solved = false; wrong = false;
      $("#choiceFeedback").textContent = "";
      $("#choiceFeedback").className = "feedback";
      $("#choiceNext").hidden = true;
      const target = curWord();
      let choices = [...new Set([...distractors(target, 3), target])];
      while (choices.length < 4) choices.push(target + "s".repeat(choices.length));
      shuffle(choices);
      correctIdx = choices.indexOf(target);
      if (correctIdx < 0) { choices[0] = target; correctIdx = 0; }
      opts.forEach((b, i) => {
        b.textContent = choices[i];
        b.disabled = false;
        b.className = "opt";
      });
      $("#choiceProgress").textContent = prog();
      say(target);
    }

    function pick(i) {
      if (solved || opts[i].disabled) return;
      if (i === correctIdx) {
        solved = true;
        opts[i].classList.add("good");
        opts.forEach((b) => (b.disabled = true));
        $("#choiceFeedback").className = "feedback good";
        $("#choiceFeedback").textContent = wrong ? "Bravo ! (avec aide)" : "Bravo ! 🎉";
        if (wrong) aided++; else score++;
        $("#choiceProgress").textContent = prog();
        stats.record(curWord(), wrong);
        feedback("correct");
        $("#choiceNext").hidden = false;
      } else {
        wrong = true;
        opts[i].disabled = true;
        opts[i].classList.add("bad");
        $("#choiceFeedback").className = "feedback bad";
        $("#choiceFeedback").textContent = "Essaie encore.";
        feedback("wrong");
      }
    }

    function next() {
      if (pos + 1 >= order.length) {
        endPrompt(score, aided, order.length, () => { shuffle(order); pos = 0; score = 0; aided = 0; round(); });
        return;
      }
      pos++;
      round();
    }

    opts.forEach((b, i) => b.addEventListener("click", () => pick(i)));
    $("#choiceListen").addEventListener("click", () => say(curWord()));
    $("#choiceNext").addEventListener("click", next);

    return { start };
  })();

  /* ================= DICTÉE ================= */
  const dictee = (() => {
    const KEYS = [..."abcdefghijklmnopqrstuvwxyz".split(""), "é", "è", "ê", "ë", "à", "â", "î", "ï", "ô", "û", "ù", "ü", "ç", "œ", "'", "-", " "];
    let list = [], order = [], pos = 0, score = 0, aidedCount = 0;
    let guess = "", scored = false, aided = false, revealCount = 0, attempts = 0, revealed = false, recorded = false;
    const REVEAL_AFTER = 3;
    const curWord = () => list[order[pos]];
    const prog = () =>
      (reviewMode ? "Révision · " : "") +
      `Mot ${pos + 1} / ${order.length}     Score : ${score}` + (aidedCount > 0 ? `   ·   avec aide : ${aidedCount}` : "");

    let built = false;
    function buildKeyboard() {
      if (built) return;
      built = true;
      const kb = $("#keyboard");
      for (const k of KEYS) {
        const b = document.createElement("button");
        if (k === " ") { b.textContent = "espace"; b.className = "space"; }
        else b.textContent = k;
        b.addEventListener("click", () => {
          guess += k;
          refreshGuess();
          say(letterName(k));
        });
        kb.appendChild(b);
      }
    }

    function start() {
      buildKeyboard();
      list = sourceWords();
      const empty = list.length === 0;
      $("#dictEmpty").textContent = emptyMsg();
      $("#dictEmpty").hidden = !empty;
      $("#dictBody").hidden = empty;
      $("#dictProgress").textContent = "";
      if (empty) return;
      order = [...list.keys()];
      shuffle(order);
      pos = 0; score = 0; aidedCount = 0;
      round();
    }

    function round() {
      guess = "";
      scored = false; aided = false; revealed = false; recorded = false;
      revealCount = 0; attempts = 0;
      $("#dictResult").hidden = true;
      $("#dictHintLine").hidden = true;
      $("#dictProgress").textContent = prog();
      refreshGuess();
    }

    function refreshGuess() {
      $("#dictGuess").textContent = guess.length ? [...guess].join("  ") : "— — —";
    }

    function revealHint() {
      const w = curWord();
      if (revealCount < w.length) revealCount++;
      aided = true;
      updateHint();
    }
    function updateHint() {
      if (revealCount <= 0) { $("#dictHintLine").hidden = true; return; }
      const w = curWord();
      let s = "";
      [...w].forEach((c, i) => { s += (i < revealCount ? c : "_") + " "; });
      $("#dictHintLine").textContent = "Indice : " + s.trim();
      $("#dictHintLine").hidden = false;
    }

    function onCheck() {
      if (!guess.length) { say("Écris d'abord ton orthographe"); return; }
      const res = checkSpelling(curWord(), guess);
      $("#dictYours").innerHTML = renderRow(res, false);
      const summary = $("#dictSummary");
      if (res.correct) {
        if (!scored) { if (aided || revealed) aidedCount++; else score++; scored = true; }
        if (!recorded) { stats.record(curWord(), attempts > 0 || revealed); recorded = true; }
        $("#dictAnswerRow").hidden = false;
        $("#dictTarget").innerHTML = renderRow(res, true);
        summary.style.color = "var(--ok)";
        summary.textContent = aided || revealed ? "Bravo ! 🎉  (avec aide)" : "Bravo ! 🎉  Orthographe parfaite.";
        $("#dictHear").hidden = false;
        $("#dictRetry").hidden = true;
        $("#dictReveal").hidden = true;
        $("#dictProgress").textContent = prog();
        feedback("correct");
      } else {
        attempts++;
        if (!revealed) $("#dictAnswerRow").hidden = true;
        summary.style.color = "var(--bad)";
        summary.textContent = "Essaie encore — corrige les lettres en rouge.";
        $("#dictHear").hidden = true;
        $("#dictRetry").hidden = false;
        $("#dictReveal").hidden = !(attempts >= REVEAL_AFTER && !revealed);
        feedback("wrong");
      }
      $("#dictResult").hidden = false;
    }

    function revealAnswer() {
      revealed = true;
      aided = true;
      $("#dictAnswerRow").hidden = false;
      $("#dictTarget").innerHTML = greenWord(curWord());
      const summary = $("#dictSummary");
      summary.style.color = "var(--ink)";
      summary.textContent = "La bonne réponse : " + curWord();
      $("#dictReveal").hidden = true;
    }

    function next() {
      if (!recorded && attempts > 0) { stats.record(curWord(), true); recorded = true; }
      if (pos + 1 >= order.length) {
        endPrompt(score, aidedCount, order.length, () => { shuffle(order); pos = 0; score = 0; aidedCount = 0; round(); });
        return;
      }
      pos++;
      round();
    }

    $("#dictListen").addEventListener("click", () => say(curWord()));
    $("#dictRepeat").addEventListener("click", () => say(curWord()));
    $("#dictHint").addEventListener("click", revealHint);
    $("#dictSpell").addEventListener("click", () => spellSlowly(curWord()));
    $("#dictBack").addEventListener("click", () => { guess = guess.slice(0, -1); refreshGuess(); });
    $("#dictClear").addEventListener("click", () => { guess = ""; refreshGuess(); });
    $("#dictCheck").addEventListener("click", onCheck);
    $("#dictHear").addEventListener("click", () => { const w = curWord(); sayQueue([w, [...w].map(letterName).join(", ")]); });
    $("#dictRetry").addEventListener("click", () => { $("#dictResult").hidden = true; });
    $("#dictReveal").addEventListener("click", revealAnswer);
    $("#dictNext").addEventListener("click", next);

    return { start };
  })();

  /* ================= WORDS ================= */
  const words = (() => {
    function start() { render(); renderReview(); $("#wordInput").value = ""; sync.refresh(); }

    function makeRow(text, controls) {
      const row = document.createElement("div");
      row.className = "row";
      const span = document.createElement("span");
      span.textContent = text;
      row.append(span, ...controls);
      return row;
    }

    function render() {
      const list = store.words();
      $("#wordCountList").textContent = list.length === 1 ? "1 mot" : list.length + " mot" + (list.length ? "s" : "s");
      const box = $("#wordList");
      box.innerHTML = "";
      list.forEach((w, idx) => {
        const pin = document.createElement("button");
        pin.className = "iconbtn" + (stats.isPinned(w) ? " on" : "");
        pin.title = "Toujours réviser ce mot";
        pin.textContent = "📌";
        pin.addEventListener("click", () => { stats.setPinned(w, !stats.isPinned(w)); render(); renderReview(); });
        const del = document.createElement("button");
        del.textContent = "Supprimer";
        del.addEventListener("click", () => {
          const cur = store.words();
          cur.splice(idx, 1);
          store.saveWords(cur);
          render();
        });
        box.appendChild(makeRow(w, [pin, del]));
      });
    }

    function renderReview() {
      const items = stats.listForManage();
      $("#reviewSection").hidden = items.length === 0;
      $("#reviewTitle").textContent = `🔁 Mots à revoir (${items.length})`;
      const box = $("#reviewList");
      box.innerHTML = "";
      items.forEach((it) => {
        const dots = document.createElement("span");
        dots.className = "dots";
        dots.textContent = stats.boxDots(it.box);
        const ok = document.createElement("button");
        ok.className = "iconbtn";
        ok.title = "Elle le maîtrise";
        ok.textContent = "✓";
        ok.addEventListener("click", () => { stats.master(it.text); renderReview(); render(); });
        const pin = document.createElement("button");
        pin.className = "iconbtn" + (it.pinned ? " on" : "");
        pin.title = "Toujours réviser ce mot";
        pin.textContent = "📌";
        pin.addEventListener("click", () => { stats.setPinned(it.text, !it.pinned); renderReview(); render(); });
        const row = makeRow(it.text, [dots, ok, pin]);
        box.appendChild(row);
      });
    }

    function addFromInput(replace) {
      const parts = $("#wordInput").value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      if (!parts.length) { say("Écris au moins un mot"); return; }
      if (replace) {
        if (!window.confirm(`Remplacer la liste par ces ${parts.length} mots ?\n\nLes « Mots à revoir » sont gardés.`)) return;
        stats.prune();
        const uniq = [];
        const seen = new Set();
        for (const p of parts) { const k = p.toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(p); } }
        store.replaceWords(uniq);
        $("#wordInput").value = "";
        render(); renderReview();
        window.alert(`Nouvelle liste : ${uniq.length} mots.\nMots à revoir : ${stats.dueCount()}.`);
      } else {
        const cur = store.words();
        let added = 0;
        for (const p of parts) if (!cur.some((x) => x.toLowerCase() === p.toLowerCase())) { cur.push(p); added++; }
        store.saveWords(cur);
        $("#wordInput").value = "";
        render();
      }
    }

    $("#wordAdd").addEventListener("click", () => addFromInput(false));
    $("#wordReplace").addEventListener("click", () => addFromInput(true));
    $("#reviewClean").addEventListener("click", () => {
      const n = stats.clearMastered();
      renderReview();
      say(n ? `${n} mots retirés` : "Rien à retirer");
    });
    return { start, render, renderReview };
  })();

  /* ================= SYNC (family code) ================= */
  const sync = (() => {
    // Cloudflare Worker from the app repo's worker/ dir (no trailing slash).
    const SYNC_BASE_URL = "https://dictee-sync.johnboniello.workers.dev";

    const ADJ = ["bleu", "rouge", "vert", "jaune", "rose", "gris", "petit", "grand", "joli", "sage", "vif", "doux", "fier", "calme"];
    const NOUN = ["coq", "chat", "chien", "lion", "ours", "loup", "cerf", "pie", "pomme", "poire", "prune", "fleur", "arbre", "livre", "craie", "stylo"];

    const configured = !!SYNC_BASE_URL;
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    const newCode = () => `${rnd(NOUN)}-${rnd(ADJ)}-${1000 + Math.floor(Math.random() * 9000)}`;
    const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const valid = (c) => /^[a-z0-9-]{4,40}$/.test(c);

    function mergeLists(primary, other) {
      const seen = new Set();
      const out = [];
      for (const w of primary) { const k = w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
      for (const w of other) { const k = w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
      return out;
    }

    async function pull(kind, code) {
      const r = await fetch(`${SYNC_BASE_URL}/${kind}/${code}`, { method: "GET" });
      if (r.status === 404) return { empty: true };
      if (!r.ok) throw new Error("serveur " + r.status);
      return r.json();
    }

    async function push(kind, code, body) {
      const r = await fetch(`${SYNC_BASE_URL}/${kind}/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("serveur " + r.status);
      return r.json();
    }

    function setStatus(t) { $("#syncStatus").textContent = t; }

    async function syncList(code, now) {
      const local = store.words();
      const localRep = store.wordsReplacedAt();
      const remote = await pull("list", code);
      if (remote.empty || !Array.isArray(remote.words)) {
        await push("list", code, { words: local, updatedAt: now, replacedAt: localRep });
        return `envoyé ${local.length} mot(s)`;
      }
      const remoteRep = remote.replacedAt || 0;
      let merged, replacedAt, adopted = false;
      if (remoteRep > localRep) {            // other device started a new week
        merged = remote.words.slice();
        replacedAt = remoteRep;
        adopted = true;
      } else if (localRep > remoteRep) {     // this device started a new week
        merged = local.slice();
        replacedAt = localRep;
      } else {                               // same generation -> union
        merged = mergeLists(local, remote.words);
        replacedAt = localRep;
      }
      store.saveWordsFromSync(merged, now, replacedAt);
      await push("list", code, { words: merged, updatedAt: now, replacedAt });
      if (adopted) return `nouvelle liste : ${merged.length} mot(s)`;
      const received = merged.filter((w) => !local.some((x) => x.toLowerCase() === w.toLowerCase())).length;
      return received > 0 ? `${merged.length} mot(s) (+${received} reçu(s))` : `${merged.length} mot(s)`;
    }

    async function syncStats(code, now) {
      const local = store.stats();
      let remote;
      try { remote = await pull("stats", code); }
      catch { return "stats non synchronisées (serveur à mettre à jour)"; }
      const remoteStats = (remote && !remote.empty && remote.stats && typeof remote.stats === "object") ? remote.stats : {};
      const merged = stats.mergeInto(local, remoteStats);
      store.saveStatsFromSync(merged, now);
      try { await push("stats", code, { stats: merged, updatedAt: now }); }
      catch { return "mots à revoir fusionnés (envoi à réessayer)"; }
      return null;
    }

    async function run() {
      const code = norm($("#codeInput").value);
      if (!valid(code)) { setStatus("Code invalide : 4 à 40 lettres, chiffres ou tirets."); return; }
      $("#codeInput").value = code;
      store.setFamilyCode(code);
      $("#syncBtn").disabled = true;
      setStatus("Synchronisation…");
      try {
        const now = Date.now();
        const listText = await syncList(code, now);
        const statsNote = await syncStats(code, now);
        words.render();
        words.renderReview();
        setStatus(`À jour : ${listText}.` + (statsNote ? " " + statsNote : ""));
      } catch (e) {
        setStatus("Échec : " + (e && e.message ? e.message : "réseau"));
      } finally {
        $("#syncBtn").disabled = false;
      }
    }

    function init() {
      if (!configured) return;
      $("#syncCard").hidden = false;
      $("#codeInput").value = store.familyCode();
      $("#genCodeBtn").addEventListener("click", () => {
        const cur = norm($("#codeInput").value);
        if (valid(cur) && !window.confirm(`Remplacer le code « ${cur} » ? Un nouveau code ne verra pas la liste déjà partagée.`)) return;
        $("#codeInput").value = newCode();
      });
      $("#copyCodeBtn").addEventListener("click", async () => {
        const code = norm($("#codeInput").value);
        if (!valid(code)) { setStatus("Crée d'abord un code."); return; }
        store.setFamilyCode(code);
        try { await navigator.clipboard.writeText(code); setStatus("Code copié : " + code); }
        catch { setStatus("Code : " + code); }
      });
      $("#syncBtn").addEventListener("click", run);
    }

    // Re-fill the code field whenever the words view opens.
    function refresh() { if (configured) $("#codeInput").value = store.familyCode(); }

    return { init, refresh };
  })();

  /* ================= SCAN (OCR) ================= */
  const scan = (() => {
    function start() {
      $("#scanReview").value = "";
      $("#scanStatus").textContent = "Les mots trouvés apparaîtront ici pour que tu les vérifies.";
    }
    function status(t) { $("#scanStatus").textContent = t; }

    async function ensureTesseract() {
      if (window.Tesseract) return;
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
        s.onload = res;
        s.onerror = () => rej(new Error("réseau"));
        document.head.appendChild(s);
      });
    }

    function extractWords(raw) {
      const out = [];
      for (let line of String(raw).split("\n")) {
        line = line.trim();
        if (!line) continue;
        line = line.replace(/^\s*(\d+\s*[.)\-–]|[-*•·–])\s*/, "");
        for (let part of line.split(/[,;/|]|\s{2,}|\s-\s/)) {
          part = part.trim().replace(/^[.,;:"'()!?·–_-]+|[.,;:"'()!?·–_-]+$/g, "");
          if (part.length >= 1 && part.length <= 30 && /\p{L}/u.test(part) && !/\d/.test(part)) out.push(part);
        }
      }
      return [...new Set(out.map((w) => w))];
    }

    async function run(file) {
      try {
        status("Chargement du lecteur… (première fois : ~2 Mo)");
        await ensureTesseract();
        status("Lecture en cours…");
        const { data } = await window.Tesseract.recognize(file, "fra", {
          logger: (m) => {
            if (m.status === "recognizing text") status("Lecture : " + Math.round(m.progress * 100) + " %");
          },
        });
        const found = extractWords(data.text || "");
        if (!found.length) {
          status("Aucun mot reconnu. Réessaie avec plus de lumière, le texte bien à plat.");
          return;
        }
        const existing = $("#scanReview").value.trim();
        const merged = [...new Set(((existing ? existing.split("\n") : []).concat(found)).map((s) => s.trim()).filter(Boolean))];
        $("#scanReview").value = merged.join("\n");
        status("Vérifie et corrige, puis « Ajouter à la liste ».");
      } catch (e) {
        status("Lecture impossible : " + (e && e.message ? e.message : "erreur") + ". Tu peux taper les mots à la main.");
      }
    }

    $("#scanFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) run(f);
      e.target.value = "";
    });
    $("#scanAdd").addEventListener("click", () => {
      const parts = $("#scanReview").value.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!parts.length) { say("Rien à ajouter"); return; }
      const cur = store.words();
      let added = 0;
      for (const p of parts) if (!cur.some((x) => x.toLowerCase() === p.toLowerCase())) { cur.push(p); added++; }
      store.saveWords(cur);
      status(added ? added + " mot(s) ajouté(s)." : "Ces mots sont déjà dans la liste.");
    });

    return { start };
  })();

  /* ---------------- boot ---------------- */
  sync.init();
  show("home");
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
