/* Spelling EN — English spelling practice PWA. Vanilla JS, no build step.
   A port of Dictée FR (../dictee/); keep the two in step. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------- storage ---------------- */
  const DEFAULT_WORDS = ["because", "friend", "said", "would", "people", "school", "Wednesday", "beautiful"];
  const store = {
    words() {
      try {
        const r = JSON.parse(localStorage.getItem("en_words"));
        return Array.isArray(r) ? r : DEFAULT_WORDS.slice();
      } catch { return DEFAULT_WORDS.slice(); }
    },
    saveWords(a) {
      try {
        localStorage.setItem("en_words", JSON.stringify(a));
        localStorage.setItem("en_words_at", String(Date.now()));
      } catch {}
    },
    saveWordsFromSync(a, ts, replacedAt) {
      try {
        localStorage.setItem("en_words", JSON.stringify(a));
        localStorage.setItem("en_words_at", String(ts));
        if (replacedAt != null) localStorage.setItem("en_words_replaced_at", String(replacedAt));
        localStorage.setItem("en_synced_at", String(Date.now()));
      } catch {}
    },
    replaceWords(a) {
      try {
        const now = Date.now();
        localStorage.setItem("en_words", JSON.stringify(a));
        localStorage.setItem("en_words_at", String(now));
        localStorage.setItem("en_words_replaced_at", String(now));
      } catch {}
    },
    wordsUpdatedAt() { const r = parseInt(localStorage.getItem("en_words_at"), 10); return isFinite(r) ? r : 0; },
    wordsReplacedAt() { const r = parseInt(localStorage.getItem("en_words_replaced_at"), 10); return isFinite(r) ? r : 0; },
    // Game limits: rounds allowed per week's list (0 = unlimited). Plays are only
    // counted while a game is limited, and each count belongs to one week's list
    // (wordsReplacedAt), so a "New week" starts it over.
    parentPinHash() { return localStorage.getItem("en_parent_pin") || null; },
    setParentPinHash(v) { try { if (v) localStorage.setItem("en_parent_pin", v); else localStorage.removeItem("en_parent_pin"); } catch {} },
    playLimit(game) { const n = parseInt(localStorage.getItem("en_limit_" + game), 10); return isFinite(n) ? n : 0; },
    setPlayLimit(game, n) { try { localStorage.setItem("en_limit_" + game, String(n)); } catch {} },
    _playsUsed(game) {
      const week = parseInt(localStorage.getItem("en_plays_week_" + game), 10);
      const used = parseInt(localStorage.getItem("en_plays_used_" + game), 10);
      return week === this.wordsReplacedAt() && isFinite(used) ? used : 0;
    },
    /** Rounds left this week, or null when the game is unlimited. */
    playsLeft(game) { const lim = this.playLimit(game); return lim === 0 ? null : Math.max(0, lim - this._playsUsed(game)); },
    usePlay(game) {
      if (this.playLimit(game) === 0) return;
      try {
        const used = this._playsUsed(game);
        localStorage.setItem("en_plays_week_" + game, String(this.wordsReplacedAt()));
        localStorage.setItem("en_plays_used_" + game, String(used + 1));
      } catch {}
    },
    // A word removed one at a time (not via "New week") is remembered
    // here so a sync can't resurrect it from another device's older copy of
    // the list — a plain word union has no way to represent a removal.
    //
    // Tombstones alone can't represent putting a word *back*: the server keeps
    // its copy, so a re-added word would be deleted again on the next sync.
    // So each device also journals what it deleted and re-added since its last
    // successful sync; sync applies the journal on top of the server's
    // tombstones and clears it once the server has the result.
    deletedWords() {
      try { const r = JSON.parse(localStorage.getItem("en_deleted")); return Array.isArray(r) ? r : []; }
      catch { return []; }
    },
    saveDeletedWords(a) { try { localStorage.setItem("en_deleted", JSON.stringify(a)); } catch {} },
    /** Remember a single word removed via "Delete" so sync won't bring it back. */
    markDeleted(word) {
      const cur = this.deletedWords();
      if (!cur.some((w) => w.toLowerCase() === word.toLowerCase())) { cur.push(word); this.saveDeletedWords(cur); }
      this._journal("en_pending_undeleted", null, word);
      this._journal("en_pending_deleted", word, null);
    },
    /** A word typed or scanned in is no longer considered deleted — here, and
     *  (via the journal) on the server and the other devices at the next sync. */
    unmarkDeleted(word) {
      const cur = this.deletedWords();
      const next = cur.filter((w) => w.toLowerCase() !== word.toLowerCase());
      if (next.length !== cur.length) this.saveDeletedWords(next);
      this._journal("en_pending_deleted", null, word);
      this._journal("en_pending_undeleted", word, null);
    },
    /** "New week" declares a fresh, authoritative list: old tombstones no longer apply. */
    clearDeletedWords() { this.saveDeletedWords([]); this._writeList("en_pending_deleted", []); this._writeList("en_pending_undeleted", []); },
    /** Words deleted / re-added here since the last successful sync. Before the
     *  first sync with this version there's no journal: the local tombstones
     *  themselves are the pending deletes (the old behaviour). */
    pendingDeleted() { return this._readList("en_pending_deleted") || this.deletedWords(); },
    pendingUndeleted() { return this._readList("en_pending_undeleted") || []; },
    /** The server now holds these changes: drop them from the journal. */
    clearJournal(syncedDeleted, syncedUndeleted) {
      const has = (arr, w) => arr.some((x) => x.toLowerCase() === w.toLowerCase());
      this._writeList("en_pending_deleted", this.pendingDeleted().filter((w) => !has(syncedDeleted, w)));
      this._writeList("en_pending_undeleted", this.pendingUndeleted().filter((w) => !has(syncedUndeleted, w)));
    },
    _journal(key, add, remove) {
      let cur = this._readList(key) || (key === "en_pending_deleted" ? this.deletedWords() : []);
      if (remove) cur = cur.filter((w) => w.toLowerCase() !== remove.toLowerCase());
      if (add && !cur.some((w) => w.toLowerCase() === add.toLowerCase())) cur.push(add);
      this._writeList(key, cur);
    },
    _readList(key) {
      try { const r = JSON.parse(localStorage.getItem(key)); return Array.isArray(r) ? r : null; }
      catch { return null; }
    },
    _writeList(key, a) { try { localStorage.setItem(key, JSON.stringify(a)); } catch {} },
    saveDeletedWordsFromSync(a) { this.saveDeletedWords(a); },
    familyCode() { return localStorage.getItem("en_code") || ""; },
    setFamilyCode(c) { try { localStorage.setItem("en_code", c); } catch {} },
    rate() { const r = parseFloat(localStorage.getItem("en_rate")); return isFinite(r) ? r : 0.9; },
    setRate(r) { try { localStorage.setItem("en_rate", String(r)); } catch {} },
    stats() {
      try { const r = JSON.parse(localStorage.getItem("en_stats")); return r && typeof r === "object" ? r : {}; }
      catch { return {}; }
    },
    saveStats(obj) {
      try {
        localStorage.setItem("en_stats", JSON.stringify(obj));
        localStorage.setItem("en_stats_at", String(Date.now()));
      } catch {}
    },
    saveStatsFromSync(obj, ts) {
      try {
        localStorage.setItem("en_stats", JSON.stringify(obj));
        localStorage.setItem("en_stats_at", String(ts));
      } catch {}
    },
    statsUpdatedAt() { const r = parseInt(localStorage.getItem("en_stats_at"), 10); return isFinite(r) ? r : 0; },
    lastSyncedAt() { const r = parseInt(localStorage.getItem("en_last_synced_at"), 10); return isFinite(r) ? r : 0; },
    markSyncedNow() { try { localStorage.setItem("en_last_synced_at", String(Date.now())); } catch {} },
  };

  /* ---------------- practice stats ("Words to review") ---------------- */
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

    /** For the "Manage Words" review section: on-list entries, hardest first. */
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

    /** Drop clearly-finished entries; nudge aged-out ones to graduated. Called on "New week". */
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
        // The side with the more recent miss decides the box: a miss resets it
        // to 1, and taking the max would let the other device's older,
        // higher box silently erase that miss. Same last miss -> keep the
        // higher box (progress or "mastered" made after that shared miss).
        const lMiss = l.lastMissAt || 0, rMiss = r.lastMissAt || 0;
        const box = lMiss > rMiss ? (l.box || 1)
          : rMiss > lMiss ? (r.box || 1)
          : Math.max(l.box || 1, r.box || 1);
        out[k] = {
          text: (l.text && l.text.length >= (r.text || "").length) ? l.text : (r.text || l.text),
          box,
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
  let enVoice = null;
  function pickVoice() {
    if (!canSpeak) return;
    const vs = speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
    enVoice = vs.find((v) => /en[-_]us/i.test(v.lang)) || vs.find((v) => /united states/i.test(v.name)) || vs[0] || null;
  }
  if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function say(text, opts = {}) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = "en-US";
      if (enVoice) u.voice = enVoice;
      u.rate = opts.rate != null ? opts.rate : store.rate();
      speechSynthesis.speak(u);
    } catch {}
  }
  /* Says the word once at half the current speed, without changing the saved rate. */
  function saySlow(word) {
    if (word) say(word, { rate: Math.max(0.3, store.rate() * 0.5) });
  }
  function sayQueue(parts, rate) {
    if (!canSpeak) return;
    try {
      speechSynthesis.cancel();
      for (const p of parts) {
        const u = new SpeechSynthesisUtterance(String(p));
        u.lang = "en-US";
        if (enVoice) u.voice = enVoice;
        u.rate = rate != null ? rate : store.rate();
        speechSynthesis.speak(u);
      }
    } catch {}
  }
  // A lone lowercase "a" is read as the word "uh"; the capital is read as the
  // letter name ("ay"), so spelling always speaks capitals.
  function letterName(c) {
    return c === " " ? "space" : c === "-" ? "hyphen" : c === "'" ? "apostrophe" : c.toUpperCase();
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
    setTimeout(() => say(kind === "correct" ? "Great job!" : "Try again", { rate: 1 }), 380);
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

  /* ---------------- distractors (for "Pick the Spelling") ---------------- */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Plausible wrong spellings, built from the mistakes kids actually make in
  // English: vowel teams (ie/ei, ee/ea…), silent letters, doubled consonants,
  // confusable endings, c/k/ck, ph/f. Each kind of mistake is its own group and
  // the three choices are drawn from different groups, so one word doesn't get
  // three doubled-letter variants. Plain vowel swaps and transposed letters only
  // fill in when a word has too few real-mistake variants.
  const SWAPS = [
    ["ie", "ei"], ["ei", "ie"], ["ee", "ea"], ["ea", "ee"], ["ai", "ay"], ["ay", "ai"], ["ai", "a"],
    ["oa", "o"], ["ow", "ou"], ["ou", "ow"], ["oi", "oy"], ["oy", "oi"], ["au", "aw"], ["aw", "au"],
    ["oo", "u"], ["ew", "oo"], ["ue", "oo"], ["ph", "f"], ["wh", "w"], ["kn", "n"], ["wr", "r"],
    ["mb", "m"], ["gh", ""], ["tch", "ch"], ["dge", "ge"], ["ck", "k"], ["ck", "c"],
    ["ce", "se"], ["se", "ce"], ["ci", "si"], ["cy", "sy"], ["qu", "kw"], ["x", "ks"],
  ];
  const ENDINGS = [
    ["tion", ["shun", "sion", "cion"]], ["sion", ["tion", "shun"]], ["ture", ["cher", "chure"]],
    ["ough", ["uff", "ow", "o"]], ["ight", ["ite", "it"]], ["ence", ["ance", "ense"]], ["ance", ["ence"]],
    ["ible", ["able"]], ["able", ["ible"]], ["ous", ["us", "ious"]], ["ful", ["full"]],
    ["ies", ["ys", "eys"]], ["ly", ["ley", "lee"]], ["ey", ["y", "ie"]], ["y", ["ey", "ie", "ee"]],
    ["le", ["el", "al", "ul"]], ["el", ["le", "il"]], ["al", ["le", "el"]],
    ["er", ["ur", "or", "ar"]], ["or", ["er"]], ["ar", ["er"]], ["ed", ["d", "t"]],
    ["tch", ["ch"]], ["dge", ["ge", "j"]], ["ge", ["dge", "j"]], ["ch", ["tch"]], ["es", ["s"]],
  ];
  const isVowel = (c) => "aeiou".includes(c);
  // Keeps a capital first letter capital ("Wednesday" -> "Wensday", not "wensday").
  function matchCase(orig, rep) {
    return rep && orig && orig[0] !== orig[0].toLowerCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
  }
  function distractors(word, count = 3) {
    const w = word.trim();
    if (w.length < 2) return Array.from({ length: count }, (_, i) => w + "x".repeat(i + 1));
    const lower = w.toLowerCase();
    const at = (i, len, rep) => w.slice(0, i) + matchCase(w.slice(i, i + len), rep) + w.slice(i + len);
    const groups = { team: new Set(), ending: new Set(), silent: new Set(), double: new Set(), sound: new Set() };
    const weak = new Set();

    for (const [from, to] of SWAPS)
      for (let i = lower.indexOf(from); i >= 0; i = lower.indexOf(from, i + 1)) groups.team.add(at(i, from.length, to));

    for (const [suf, alts] of ENDINGS)
      if (lower.length > suf.length + 1 && lower.endsWith(suf)) {
        for (const a of alts) groups.ending.add(at(w.length - suf.length, suf.length, a));
        break; // only the longest matching ending ("tion", not also "on")
      }

    // Silent e: drop it ("hope" -> "hop"), or add one that isn't there ("bus" -> "buse").
    const last = lower[lower.length - 1], prev = lower[lower.length - 2];
    if (w.length > 3 && last === "e" && !isVowel(prev)) groups.silent.add(w.slice(0, -1));
    if (w.length > 2 && !isVowel(last) && !"ywxs".includes(last) && isVowel(prev)) groups.silent.add(w + "e");
    // Silent first letters dropped: "knee" -> "nee", "write" -> "rite" are covered by SWAPS.

    // Doubled consonants: undouble ("little" -> "litle") or double ("until" -> "untill").
    const dbl = "bdfglmnprstz";
    for (let i = 0; i < w.length; i++) {
      const c = lower[i];
      if (i + 1 < w.length && c === lower[i + 1] && dbl.includes(c)) groups.double.add(w.slice(0, i) + w.slice(i + 1));
      // Only where a doubled letter could really go: after a vowel, before a vowel or at the end.
      else if (dbl.includes(c) && i > 0 && isVowel(lower[i - 1]) && (i + 1 === w.length || isVowel(lower[i + 1])))
        groups.double.add(w.slice(0, i + 1) + w[i] + w.slice(i + 1));
    }

    // Same sound, other letter: c/k, s/z — skipping digraphs like ch, ck, sh.
    for (let i = 0; i < w.length; i++) {
      const c = lower[i], n = lower[i + 1] || "", p = lower[i - 1] || "";
      if (c === "c" && !"hk".includes(n) && !"eiy".includes(n || "x")) groups.sound.add(at(i, 1, "k"));
      if (c === "k" && p !== "c" && !(i === 0 && n === "n") && !"eiy".includes(n || "x")) groups.sound.add(at(i, 1, "c"));
      if (c === "s" && n !== "h" && i > 0 && isVowel(p)) groups.sound.add(at(i, 1, "z"));
    }

    // Weak fallbacks: a vowel swapped for a neighbour, two letters transposed.
    const VW = { a: "e", e: "i", i: "e", o: "u", u: "o" };
    for (let i = 0; i < w.length; i++) if (VW[lower[i]]) weak.add(at(i, 1, VW[lower[i]]));
    for (let i = 0; i < w.length - 1; i++)
      if (lower[i] !== lower[i + 1] && w[i] !== " " && w[i + 1] !== " ") {
        const a = [...w]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; weak.add(a.join(""));
      }

    const ok = (s) => s && s.length >= 2 && s.toLowerCase() !== lower && Math.abs(s.length - w.length) <= 3;
    const res = [];
    const taken = new Set([lower]);
    const take = (s) => { if (ok(s) && !taken.has(s.toLowerCase())) { taken.add(s.toLowerCase()); res.push(s); return true; } return false; };
    // Round-robin over the mistake groups in random order, a random variant from each.
    const pools = shuffle(Object.values(groups).map((g) => shuffle([...g])).filter((g) => g.length));
    while (res.length < count && pools.some((g) => g.length))
      for (const g of pools) { while (g.length && !take(g.pop())); if (res.length >= count) break; }
    for (const s of shuffle([...weak])) { if (res.length >= count) break; take(s); }
    while (res.length < count) res.push(w + "s".repeat(res.length + 1));
    return res.slice(0, count);
  }

  /* ---------------- routing ---------------- */
  const TITLES = { home: "Spelling EN", scramble: "Scrambled Letters", choice: "Pick the Spelling", dictee: "Write the Word", words: "Manage Words", scan: "Scan a List" };
  let reviewMode = false;
  const sourceWords = () => (reviewMode ? stats.poolWords() : store.words());
  const emptyMsg = () => (reviewMode
    ? "No words to review right now. 🎉"
    : "Add some words first (“Manage Words”).");
  function show(view) {
    $$("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== view));
    $("#backBtn").hidden = view === "home";
    $("#topTitle").textContent = TITLES[view] || "Spelling EN";
    window.scrollTo(0, 0);
    if (view === "home") refreshHome();
  }
  $("#backBtn").addEventListener("click", () => {
    if (canSpeak) speechSynthesis.cancel();
    $$("body > .tile").forEach((t) => t.remove());
    show("home");
  });
  const game = (v) => ({ scramble, choice, dictee, words, scan }[v]);
  $$("[data-go]").forEach((b) => b.addEventListener("click", async () => {
    const v = b.dataset.go;
    if ((v === "words" || v === "scan") && !(await unlockParent())) return;
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
    $("#wordCount").textContent = n === 1 ? "1 word in the list" : n + " words in the list";
    $("#rate").value = String(store.rate());
    for (const game of Object.keys(GAMES)) {
      $$(`[data-go="${game}"], [data-review="${game}"]`).forEach((b) => {
        b.textContent = gameLabel(game);
        b.style.opacity = store.playsLeft(game) === 0 ? "0.5" : "";
      });
    }
    const due = stats.dueCount();
    const rb = $("#reviewBtn");
    rb.hidden = due === 0;
    rb.textContent = `🔁  Words to review (${due})`;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    $("#installHint").hidden = !!standalone;
  }
  $("#rate").addEventListener("change", (e) => { store.setRate(parseFloat(e.target.value)); say("This is the voice speed"); });

  /* ---------------- parent PIN ---------------- */
  // Optional, not the device's PIN. When set, the parent screens (word list,
  // scan) ask for it, so a child can't change the game limits or reset them
  // with a new week. Stored as a hash.
  async function pinHash(pin) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("spelling-pin:" + pin));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  /** Shows the PIN pop-up; resolves to the digits typed, or null if cancelled. */
  function askPin(title, forgot = false) {
    const dlg = $("#pinDialog");
    $("#pinTitle").textContent = title;
    $("#pinInput").value = "";
    $("#pinForgot").hidden = !forgot;
    return new Promise((resolve) => {
      dlg.onclose = () => resolve(dlg.returnValue === "ok" ? $("#pinInput").value.trim() : null);
      dlg.returnValue = "";
      dlg.showModal();
      $("#pinInput").focus();
    });
  }
  $("#pinForgot").addEventListener("click", () => window.alert("To remove the PIN, clear this site's data in the browser settings. The word list comes back at the next sync if you use a family code; otherwise you'll need to scan it again."));
  /** Resolves true when there's no PIN or the right one was entered. */
  async function unlockParent() {
    const want = store.parentPinHash();
    if (!want) return true;
    for (;;) {
      const pin = await askPin("Parent PIN", true);
      if (pin == null) return false;
      if ((await pinHash(pin)) === want) return true;
      window.alert("Wrong PIN.");
    }
  }
  async function setNewPin() {
    for (;;) {
      const first = await askPin("New parent PIN (4 to 8 digits)");
      if (first == null) return;
      if (!/^\d{4,8}$/.test(first)) { window.alert("The PIN must be 4 to 8 digits."); continue; }
      const second = await askPin("Enter the PIN again");
      if (second == null) return;
      if (second !== first) { window.alert("The two PINs don't match."); continue; }
      store.setParentPinHash(await pinHash(first));
      window.alert("Parent PIN set. It will be asked for Manage Words and Scan a List.");
      return;
    }
  }
  function renderPin() {
    const on = !!store.parentPinHash();
    $("#pinStatus").textContent = on ? "on" : "none";
    $("#pinSet").textContent = on ? "Change" : "Set";
    $("#pinRemove").hidden = !on;
  }
  $("#pinSet").addEventListener("click", async () => { await setNewPin(); renderPin(); });
  $("#pinRemove").addEventListener("click", () => {
    if (window.confirm("Remove the parent PIN?")) { store.setParentPinHash(null); renderPin(); }
  });

  /* ---------------- game limits ---------------- */
  function renderLimits() {
    $$("[data-limit]").forEach((sel) => {
      if (!sel.options.length) {
        for (const n of LIMIT_OPTIONS) sel.add(new Option(describeLimit(n), String(n)));
        sel.addEventListener("change", () => store.setPlayLimit(sel.dataset.limit, parseInt(sel.value, 10)));
      }
      sel.value = String(store.playLimit(sel.dataset.limit));
    });
  }
  const GAMES = { scramble: ["🔤", "Scrambled Letters"], choice: ["🎯", "Pick the Spelling"], dictee: ["✏️", "Write the Word"] };
  const LIMIT_OPTIONS = [0, 1, 2, 3, 4, 5, 10];
  function gameLabel(game) {
    const left = store.playsLeft(game);
    const suffix = left == null ? "" : left === 0 ? " (done for this week)" : left === 1 ? " (1 game left)" : ` (${left} games left)`;
    return `${GAMES[game][0]}\u00a0 ${GAMES[game][1]}${suffix}`;
  }
  const blockedText = (game) => `You've played ${GAMES[game][1]} ${store.playLimit(game) === 1 ? "once" : store.playLimit(game) + " times"} this week. 💪 Try another game!`;
  const describeLimit = (n) => (n === 0 ? "Unlimited" : n === 1 ? "1 game per week" : `${n} games per week`);
  /** One game's round: it uses up a play on its first answer, so opening a game
   *  and backing out costs nothing. */
  function playCharge(game) {
    let week = -1;
    const charged = () => week === store.wordsReplacedAt();
    return {
      blocked: () => !charged() && store.playsLeft(game) === 0,
      charge() { if (!charged()) { store.usePlay(game); week = store.wordsReplacedAt(); } },
      reset() { week = -1; },
    };
  }

  function endPrompt(score, aided, total, restart, game) {
    const res = `All done!\nWithout help: ${score} / ${total}\nWith help: ${aided}`;
    const left = store.playsLeft(game);
    if (left === 0) { window.alert(res + "\n\n" + `No more ${GAMES[game][1]} games this week.`); show("home"); return; }
    const more = left == null ? "" : left === 1 ? "\n\n1 game left" : `\n\n${left} games left`;
    const again = window.confirm(res + more + "\n\nPlay again?");
    if (again) restart(); else show("home");
  }

  /* ================= SCRAMBLE ================= */
  const scramble = (() => {
    const ch = playCharge("scramble");
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
      (reviewMode ? "Review · " : "") +
      `Word ${pos + 1} / ${order.length}     Score: ${score}` + (aided > 0 ? `   ·   with help: ${aided}` : "");

    function start() {
      list = sourceWords();
      ch.reset();
      const blocked = list.length > 0 && ch.blocked();
      const empty = list.length === 0 || blocked;
      $("#scrEmpty").textContent = blocked ? blockedText("scramble") : emptyMsg();
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
      clearTimeout(checkTimer);
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
      else say(letterName(run || slotChars[k]));
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
    // One pending "is the board right?" check, so quick moves don't queue several.
    let checkTimer = 0;
    function scheduleCheck() { clearTimeout(checkTimer); checkTimer = setTimeout(check, 700); }
    function placeInSlot(tile, slot) {
      clearInline(tile);
      slot.appendChild(tile);
      const k = +slot.dataset.slot;
      const full = allFilled();
      announce(k);
      if (full) scheduleCheck();
    }

    function check() {
      // Runs 0.7 s after the last slot fills. If she has picked a tile back up
      // since, the word isn't finished: judging it now would say "Not quite"
      // and record a miss she never made.
      if (solved || !allFilled()) return;
      ch.charge();
      const slots = slotEls();
      const right = slotChars.every((c, i) => {
        const t = tileIn(slots[i]);
        return t && t.dataset.letter.toLowerCase() === c.toLowerCase();
      });
      if (right) {
        solved = true;
        $$("#board .tile").forEach((t) => t.classList.add("locked", "good"));
        $("#scrFeedback").className = "feedback good";
        $("#scrFeedback").textContent = hinted ? "Great job! (with help)" : "Great job! 🎉";
        if (hinted) aided++; else score++;
        $("#scrProgress").textContent = progressText();
        stats.record(curWord(), wrongThisWord);
        feedback("correct");
        $("#scrNext").hidden = false;
      } else {
        wrongThisWord = true;
        $("#scrFeedback").className = "feedback bad";
        $("#scrFeedback").textContent = "Not quite — the red letters go back.";
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
      if (full) scheduleCheck();
    }

    function next() {
      if (pos + 1 >= order.length) {
        endPrompt(score, aided, order.length, () => { ch.reset(); shuffle(order); pos = 0; score = 0; aided = 0; round(); }, "scramble");
        return;
      }
      pos++;
      round();
    }

    $("#scrListen").addEventListener("click", () => say(curWord()));
    $("#scrSlow").addEventListener("click", () => saySlow(curWord()));
    $("#scrHint").addEventListener("click", hint);
    $("#scrSpell").addEventListener("click", () => spellSlowly(curWord()));
    $("#scrNext").addEventListener("click", next);

    return { start };
  })();

  /* ================= CHOICE ================= */
  const choice = (() => {
    const ch = playCharge("choice");
    let list = [], order = [], pos = 0, score = 0, aided = 0, correctIdx = -1, solved = false, wrong = false;
    const opts = $$("#choice .opt");
    const curWord = () => list[order[pos]];
    const prog = () =>
      (reviewMode ? "Review · " : "") +
      `Word ${pos + 1} / ${order.length}     Score: ${score}` + (aided > 0 ? `   ·   with help: ${aided}` : "");

    function start() {
      list = sourceWords();
      ch.reset();
      const blocked = list.length > 0 && ch.blocked();
      const empty = list.length === 0 || blocked;
      $("#choiceEmpty").textContent = blocked ? blockedText("choice") : emptyMsg();
      $("#choiceEmpty").hidden = !empty;
      $("#choiceListenRow").hidden = empty;
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
      ch.charge();
      if (i === correctIdx) {
        solved = true;
        opts[i].classList.add("good");
        opts.forEach((b) => (b.disabled = true));
        $("#choiceFeedback").className = "feedback good";
        $("#choiceFeedback").textContent = wrong ? "Great job! (with help)" : "Great job! 🎉";
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
        $("#choiceFeedback").textContent = "Try again.";
        feedback("wrong");
      }
    }

    function next() {
      if (pos + 1 >= order.length) {
        endPrompt(score, aided, order.length, () => { ch.reset(); shuffle(order); pos = 0; score = 0; aided = 0; round(); }, "choice");
        return;
      }
      pos++;
      round();
    }

    opts.forEach((b, i) => b.addEventListener("click", () => pick(i)));
    $("#choiceListen").addEventListener("click", () => say(curWord()));
    $("#choiceSlow").addEventListener("click", () => saySlow(curWord()));
    $("#choiceNext").addEventListener("click", next);

    return { start };
  })();

  /* ================= WRITE THE WORD ================= */
  const dictee = (() => {
    const ch = playCharge("dictee");
    const KEYS = [..."abcdefghijklmnopqrstuvwxyz".split(""), "'", "-", " "];
    let list = [], order = [], pos = 0, score = 0, aidedCount = 0;
    let guess = "", scored = false, aided = false, revealCount = 0, attempts = 0, revealed = false, recorded = false;
    const REVEAL_AFTER = 3;
    const curWord = () => list[order[pos]];
    const prog = () =>
      (reviewMode ? "Review · " : "") +
      `Word ${pos + 1} / ${order.length}     Score: ${score}` + (aidedCount > 0 ? `   ·   with help: ${aidedCount}` : "");

    let built = false;
    function buildKeyboard() {
      if (built) return;
      built = true;
      const kb = $("#keyboard");
      for (const k of KEYS) {
        const b = document.createElement("button");
        if (k === " ") { b.textContent = "space"; b.className = "space"; }
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
      ch.reset();
      const blocked = list.length > 0 && ch.blocked();
      const empty = list.length === 0 || blocked;
      $("#dictEmpty").textContent = blocked ? blockedText("dictee") : emptyMsg();
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
      $("#dictHintLine").textContent = "Hint: " + s.trim();
      $("#dictHintLine").hidden = false;
    }

    function onCheck() {
      if (!guess.length) { say("Type your spelling first"); return; }
      ch.charge();
      const res = checkSpelling(curWord(), guess);
      $("#dictYours").innerHTML = renderRow(res, false);
      const summary = $("#dictSummary");
      if (res.correct) {
        if (!scored) { if (aided || revealed) aidedCount++; else score++; scored = true; }
        if (!recorded) { stats.record(curWord(), attempts > 0 || revealed); recorded = true; }
        $("#dictAnswerRow").hidden = false;
        $("#dictTarget").innerHTML = renderRow(res, true);
        summary.style.color = "var(--ok)";
        summary.textContent = aided || revealed ? "Great job! 🎉  (with help)" : "Great job! 🎉  Perfect spelling.";
        $("#dictHear").hidden = false;
        $("#dictRetry").hidden = true;
        $("#dictReveal").hidden = true;
        $("#dictProgress").textContent = prog();
        feedback("correct");
      } else {
        attempts++;
        if (!revealed) $("#dictAnswerRow").hidden = true;
        summary.style.color = "var(--bad)";
        summary.textContent = "Try again — fix the red letters.";
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
      summary.textContent = "The right answer: " + curWord();
      $("#dictReveal").hidden = true;
    }

    function next() {
      if (!recorded && attempts > 0) { stats.record(curWord(), true); recorded = true; }
      if (pos + 1 >= order.length) {
        endPrompt(score, aidedCount, order.length, () => { ch.reset(); shuffle(order); pos = 0; score = 0; aidedCount = 0; round(); }, "dictee");
        return;
      }
      pos++;
      round();
    }

    $("#dictListen").addEventListener("click", () => say(curWord()));
    $("#dictRepeat").addEventListener("click", () => say(curWord()));
    $("#dictSlow").addEventListener("click", () => saySlow(curWord()));
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
    function start() { render(); renderReview(); renderLimits(); renderPin(); $("#wordInput").value = ""; sync.refresh(); }

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
      $("#wordCountList").textContent = list.length === 1 ? "1 word" : list.length + " words";
      const box = $("#wordList");
      box.innerHTML = "";
      list.forEach((w) => {
        const pin = document.createElement("button");
        pin.className = "iconbtn" + (stats.isPinned(w) ? " on" : "");
        pin.title = "Always review this word";
        pin.textContent = "📌";
        pin.addEventListener("click", () => { stats.setPinned(w, !stats.isPinned(w)); render(); renderReview(); });
        const del = document.createElement("button");
        del.textContent = "Delete";
        // By word, not by the row's index: a sync may have saved a different
        // list since this one was drawn, and the index would hit another word.
        del.addEventListener("click", () => {
          store.saveWords(store.words().filter((x) => x.toLowerCase() !== w.toLowerCase()));
          store.markDeleted(w);
          render();
        });
        box.appendChild(makeRow(w, [pin, del]));
      });
    }

    function renderReview() {
      const items = stats.listForManage();
      $("#reviewSection").hidden = items.length === 0;
      $("#reviewTitle").textContent = `🔁 Words to review (${items.length})`;
      const box = $("#reviewList");
      box.innerHTML = "";
      items.forEach((it) => {
        const dots = document.createElement("span");
        dots.className = "dots";
        dots.textContent = stats.boxDots(it.box);
        const ok = document.createElement("button");
        ok.className = "iconbtn";
        ok.title = "She knows it";
        ok.textContent = "✓";
        ok.addEventListener("click", () => { stats.master(it.text); renderReview(); render(); });
        const pin = document.createElement("button");
        pin.className = "iconbtn" + (it.pinned ? " on" : "");
        pin.title = "Always review this word";
        pin.textContent = "📌";
        pin.addEventListener("click", () => { stats.setPinned(it.text, !it.pinned); renderReview(); render(); });
        const row = makeRow(it.text, [dots, ok, pin]);
        box.appendChild(row);
      });
    }

    function addFromInput(replace) {
      const parts = $("#wordInput").value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      if (!parts.length) { say("Type at least one word"); return; }
      if (replace) {
        if (!window.confirm(`Replace the list with these ${parts.length} words?\n\n“Words to review” are kept.`)) return;
        stats.prune();
        store.clearDeletedWords();
        const uniq = [];
        const seen = new Set();
        for (const p of parts) { const k = p.toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(p); } }
        store.replaceWords(uniq);
        $("#wordInput").value = "";
        render(); renderReview();
        window.alert(`New list: ${uniq.length} words.\nWords to review: ${stats.dueCount()}.`);
      } else {
        const cur = store.words();
        let added = 0;
        for (const p of parts) {
          if (!cur.some((x) => x.toLowerCase() === p.toLowerCase())) { cur.push(p); added++; }
          store.unmarkDeleted(p);
        }
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
      say(n ? `${n} words removed` : "Nothing to remove");
    });
    return { start, render, renderReview };
  })();

  /* ================= SYNC (family code) ================= */
  const sync = (() => {
    // Cloudflare Worker from the app repo's worker/ dir (no trailing slash).
    const SYNC_BASE_URL = "https://dictee-sync.johnboniello.workers.dev";
    // Same worker as Dictée FR. Every code is stored under "en-<code>" so an
    // English list never merges with a French list that has the same code.
    // The worker caps keys at 40 chars, so codes here are at most 37.
    const SERVER_PREFIX = "en-";

    const ADJ = ["blue", "red", "green", "gold", "pink", "gray", "tiny", "big", "happy", "wise", "quick", "calm", "brave", "sunny"];
    const NOUN = ["owl", "cat", "dog", "lion", "bear", "wolf", "deer", "fox", "apple", "pear", "plum", "rose", "tree", "book", "chalk", "pen"];

    const configured = !!SYNC_BASE_URL;
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
    function randStr(n) {
      const buf = new Uint8Array(n);
      (self.crypto || {}).getRandomValues ? crypto.getRandomValues(buf) : buf.forEach((_, i) => (buf[i] = (Math.random() * 256) | 0));
      return [...buf].map((x) => ALNUM[x % ALNUM.length]).join("");
    }
    // Readable prefix so a parent recognises "their" code + 6 random chars so it
    // isn't guessable: e.g. "owl-blue-h7k2m9" (~40 bits).
    const newCode = () => `${rnd(NOUN)}-${rnd(ADJ)}-${randStr(6)}`;
    const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const valid = (c) => /^[a-z0-9-]{8,37}$/.test(c);

    function mergeLists(primary, other) {
      const seen = new Set();
      const out = [];
      for (const w of primary) { const k = w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
      for (const w of other) { const k = w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
      return out;
    }

    async function pull(kind, code) {
      const r = await fetch(`${SYNC_BASE_URL}/${kind}/${SERVER_PREFIX}${code}`, { method: "GET" });
      if (r.status === 404) return { empty: true };
      if (!r.ok) throw new Error("server " + r.status);
      return r.json();
    }

    async function push(kind, code, body) {
      const r = await fetch(`${SYNC_BASE_URL}/${kind}/${SERVER_PREFIX}${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("server " + r.status);
      return r.json();
    }

    function setStatus(t) { $("#syncStatus").textContent = t; }

    async function syncList(code, now) {
      const remote = await pull("list", code);
      // Read local state only after the request: nothing can run between
      // these reads and the save below, so a word added while the request
      // was in flight can no longer be overwritten by an older snapshot.
      const local = store.words();
      const localRep = store.wordsReplacedAt();
      const localDeleted = store.deletedWords();
      const pendingDel = store.pendingDeleted();
      const pendingUndel = store.pendingUndeleted();
      if (remote.empty || !Array.isArray(remote.words)) {
        await push("list", code, { words: local, deleted: localDeleted, updatedAt: now, replacedAt: localRep });
        store.clearJournal(pendingDel, pendingUndel);
        return `sent ${local.length} word(s)`;
      }
      const remoteWords = remote.words;
      const remoteDeleted = Array.isArray(remote.deleted) ? remote.deleted : [];
      const remoteRep = remote.replacedAt || 0;
      let merged, mergedDeleted, replacedAt, adopted = false;
      if (remoteRep > localRep) {            // other device started a new week: adopt it whole
        merged = remoteWords.slice();
        mergedDeleted = remoteDeleted.slice();
        replacedAt = remoteRep;
        adopted = true;
      } else if (localRep > remoteRep) {     // this device started a new week: its list wins
        merged = local.slice();
        mergedDeleted = localDeleted.slice();
        replacedAt = localRep;
      } else {                               // same generation -> union, minus what's deleted.
        // The server's tombstones are the shared truth; on top of them go the
        // deletes made here since the last sync, and out come the words
        // re-added here. A stale local tombstone no longer counts, so a word
        // re-added on any device stays added everywhere.
        const undeleted = new Set(pendingUndel.map((w) => w.toLowerCase()));
        mergedDeleted = mergeLists(remoteDeleted.filter((w) => !undeleted.has(w.toLowerCase())), pendingDel);
        const deletedKeys = new Set(mergedDeleted.map((w) => w.toLowerCase()));
        merged = mergeLists(local, remoteWords).filter((w) => !deletedKeys.has(w.toLowerCase()));
        replacedAt = localRep;
      }
      store.saveWordsFromSync(merged, now, replacedAt);
      store.saveDeletedWordsFromSync(mergedDeleted);
      await push("list", code, { words: merged, deleted: mergedDeleted, updatedAt: now, replacedAt });
      // The server has it now. (Adopting another device's new week also
      // retires this device's journal: those edits were to last week's list.)
      store.clearJournal(pendingDel, pendingUndel);
      if (adopted) return `new list: ${merged.length} word(s)`;
      const received = merged.filter((w) => !local.some((x) => x.toLowerCase() === w.toLowerCase())).length;
      return received > 0 ? `${merged.length} word(s) (+${received} received)` : `${merged.length} word(s)`;
    }

    async function syncStats(code, now) {
      let remote;
      try { remote = await pull("stats", code); }
      catch { return "review words not synced (server needs updating)"; }
      const local = store.stats(); // read after the request, as in syncList
      const remoteStats = (remote && !remote.empty && remote.stats && typeof remote.stats === "object") ? remote.stats : {};
      const merged = stats.mergeInto(local, remoteStats);
      store.saveStatsFromSync(merged, now);
      try { await push("stats", code, { stats: merged, updatedAt: now }); }
      catch { return "review words merged (upload will retry)"; }
      return null;
    }

    let syncing = false;
    const AUTO_MIN_INTERVAL_MS = 20000;

    /** Runs one sync pass. [silent] suppresses the button/status UI — used by
     *  auto-sync and pull-to-refresh, which have their own indicators. */
    async function doSync(code, silent) {
      if (syncing) return { ok: false };
      syncing = true;
      if (!silent) { $("#syncBtn").disabled = true; setStatus("Syncing…"); }
      try {
        const now = Date.now();
        const listText = await syncList(code, now);
        const statsNote = await syncStats(code, now);
        store.markSyncedNow();
        words.render();
        words.renderReview();
        if (!$("#home").hidden) refreshHome();
        if (!silent) setStatus(`Up to date: ${listText}.` + (statsNote ? " " + statsNote : ""));
        return { ok: true };
      } catch (e) {
        if (!silent) setStatus("Failed: " + (e && e.message ? e.message : "network"));
        return { ok: false, error: e };
      } finally {
        syncing = false;
        if (!silent) $("#syncBtn").disabled = false;
      }
    }

    async function run() {
      const code = norm($("#codeInput").value);
      if (!valid(code)) { setStatus("Invalid code: 8 to 37 letters, numbers or dashes."); return; }
      $("#codeInput").value = code;
      store.setFamilyCode(code);
      await doSync(code, false);
    }

    /**
     * Sync triggered by app-open/tab-visible or pull-to-refresh rather than a
     * button tap: no-ops if syncing isn't configured, no family code has been
     * saved yet, or — for the passive case — we already synced recently. Pass
     * { force: true } to bypass that cooldown, e.g. for pull-to-refresh.
     */
    async function autoSync({ force = false } = {}) {
      const code = store.familyCode();
      if (!configured || !valid(code)) return { ok: false };
      if (!force && Date.now() - store.lastSyncedAt() < AUTO_MIN_INTERVAL_MS) return { ok: false };
      return doSync(code, true);
    }

    function init() {
      if (!configured) return;
      $("#syncCard").hidden = false;
      $("#codeInput").value = store.familyCode();
      $("#genCodeBtn").addEventListener("click", () => {
        const cur = norm($("#codeInput").value);
        if (valid(cur) && !window.confirm(`Replace the code “${cur}”? A new code won't see the list that is already shared.`)) return;
        $("#codeInput").value = newCode();
      });
      $("#copyCodeBtn").addEventListener("click", async () => {
        const code = norm($("#codeInput").value);
        if (!valid(code)) { setStatus("Make a code first."); return; }
        store.setFamilyCode(code);
        try { await navigator.clipboard.writeText(code); setStatus("Code copied: " + code); }
        catch { setStatus("Code: " + code); }
      });
      $("#syncBtn").addEventListener("click", run);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") autoSync();
      });
    }

    // Re-fill the code field whenever the words view opens.
    function refresh() { if (configured) $("#codeInput").value = store.familyCode(); }

    return { init, refresh, autoSync };
  })();

  /* ================= PULL TO REFRESH ================= */
  (() => {
    const PULL_MAX = 80;
    const PULL_TRIGGER = 60;
    const el = document.createElement("div");
    el.className = "ptr-indicator";
    el.textContent = "↓ Pull to sync";
    document.body.insertBefore(el, document.body.firstChild);

    let startY = 0, dragging = false, armed = false;
    const setPull = (px) => { el.style.transform = `translateY(calc(${px}px - 100%))`; };

    document.addEventListener("touchstart", (e) => {
      dragging = document.scrollingElement.scrollTop <= 0 && e.touches.length === 1;
      startY = dragging ? e.touches[0].clientY : 0;
      armed = false;
      el.classList.remove("settling");
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { setPull(0); return; }
      e.preventDefault();
      const pull = Math.min(dy * 0.5, PULL_MAX);
      armed = pull >= PULL_TRIGGER;
      el.textContent = armed ? "↑ Release to sync" : "↓ Pull to sync";
      setPull(pull);
    }, { passive: false });

    function release() {
      if (!dragging) return;
      dragging = false;
      el.classList.add("settling");
      if (!armed) { setPull(0); return; }
      el.textContent = "🔄 Syncing…";
      setPull(PULL_TRIGGER);
      sync.autoSync({ force: true }).finally(() => {
        setPull(0);
        el.textContent = "↓ Pull to sync";
      });
    }
    document.addEventListener("touchend", release);
    document.addEventListener("touchcancel", release);
  })();

  /* ================= SCAN (OCR) ================= */
  const scan = (() => {
    function start() {
      $("#scanReview").value = "";
      updateCount();
      $("#scanStatus").textContent = "The words it finds will show up here so you can check them.";
    }
    function status(t) { $("#scanStatus").textContent = t; }
    const uniqWords = (arr) => {
      const seen = new Set();
      return arr.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
    };
    const fieldWords = () => uniqWords($("#scanReview").value.split("\n"));
    function updateCount() {
      const n = fieldWords().length;
      $("#scanCount").textContent = n === 0 ? "" : n === 1 ? "1 word" : n + " words";
    }
    $("#scanReview").addEventListener("input", updateCount);

    async function ensureTesseract() {
      if (window.Tesseract) return;
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
        s.onload = res;
        s.onerror = () => rej(new Error("network"));
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
          // A lone letter is almost always a list number OCR misread ("1." -> "l");
          // more than three words is a sentence or a heading, not a spelling word.
          const lone = part.length === 1 && !/^[aAI]$/.test(part);
          const sentence = part.split(/\s+/).length > 3;
          if (part.length >= 1 && part.length <= 30 && /\p{L}/u.test(part) && !/\d/.test(part) && !lone && !sentence) out.push(part);
        }
      }
      return [...new Set(out.map((w) => w))];
    }

    async function run(file) {
      try {
        status("Loading the reader… (first time: ~2 MB)");
        await ensureTesseract();
        status("Reading…");
        const { data } = await window.Tesseract.recognize(file, "eng", {
          logger: (m) => {
            if (m.status === "recognizing text") status("Reading: " + Math.round(m.progress * 100) + "%");
          },
        });
        const found = extractWords(data.text || "");
        if (!found.length) {
          status("No words found. Try again with more light and the page flat.");
          return;
        }
        // A second photo (a retake, or page two) shouldn't silently pile onto
        // the first one's words.
        const existing = fieldWords();
        const keep = existing.length > 0 && window.confirm(
          `Found ${found.length} words. There are already ${existing.length} scanned words.\n\nOK = keep both (a second page)\nCancel = replace them (a retake)`);
        $("#scanReview").value = uniqWords((keep ? existing : []).concat(found)).join("\n");
        updateCount();
        status("Check and fix them, then tap “New week”.");
      } catch (e) {
        status("Couldn't read it: " + (e && e.message ? e.message : "error") + ". You can type the words by hand.");
      }
    }

    $("#scanFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) run(f);
      e.target.value = "";
    });
    $("#scanReplace").addEventListener("click", () => {
      const parts = fieldWords();
      if (!parts.length) { say("Nothing to add"); return; }
      if (!window.confirm(`Replace the list with these ${parts.length} words?\n\n“Words to review” are kept.`)) return;
      stats.prune();
      store.clearDeletedWords();
      store.replaceWords(parts);
      status(`New list: ${parts.length} word(s).`);
      $("#scanReview").value = "";
      updateCount();
    });
    $("#scanAdd").addEventListener("click", () => {
      const parts = fieldWords();
      if (!parts.length) { say("Nothing to add"); return; }
      const cur = store.words();
      const newOnes = parts.filter((p) => !cur.some((x) => x.toLowerCase() === p.toLowerCase())).length;
      // Adding a new week's scan to last week's list doubles it: say so first.
      if (cur.length && newOnes && !window.confirm(
        `The list already has ${cur.length} words. Adding these ${newOnes} makes ${cur.length + newOnes}.\n\nIf these are a new week's words, tap Cancel and use “New week” instead.`)) return;
      let added = 0;
      for (const p of parts) {
        if (!cur.some((x) => x.toLowerCase() === p.toLowerCase())) { cur.push(p); added++; }
        // A re-scanned word that was deleted earlier must lose its tombstone,
        // or the next sync's merge filters it right back out.
        store.unmarkDeleted(p);
      }
      store.saveWords(cur);
      status(added ? added + " word(s) added." : "Those words are already in the list.");
    });

    return { start };
  })();

  /* ---------------- boot ---------------- */
  sync.init();
  show("home");
  sync.autoSync();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
