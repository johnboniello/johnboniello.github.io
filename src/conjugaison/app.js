/* Conjugaison FR — French verb conjugation practice PWA. Vanilla JS, no build step. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------- data ---------------- */
  let VERBS = [];
  const VMAP = {};
  let DATA_READY = false;

  const LEVEL_TENSES = {
    1: ["pres", "imp", "fut"],
    2: ["pres", "imp", "fut", "pc"],
    3: ["pres", "imp", "fut", "pc", "cond", "subj"],
    4: ["pres", "imp", "fut", "pc", "cond", "subj", "impe"],
  };
  const LEVEL_DESC = {
    1: "Présent · imparfait · futur simple",
    2: "+ passé composé",
    3: "+ conditionnel · subjonctif présent",
    4: "+ impératif",
  };
  const TENSE_NAME = {
    pres: "présent", imp: "imparfait", fut: "futur simple", pc: "passé composé",
    cond: "conditionnel présent", subj: "subjonctif présent", impe: "impératif",
  };
  const PERSON = ["je", "tu", "il", "nous", "vous", "ils"];
  const PERSON_LABEL = ["je", "tu", "il / elle", "nous", "vous", "ils / elles"];
  const IMPE_PIDX = [1, 3, 4];           // impé forms -> tu / nous / vous
  const IMPE_LABEL = { 1: "tu", 3: "nous", 4: "vous" };

  const CORE = ("être avoir aller faire dire pouvoir vouloir savoir voir venir prendre " +
    "parler aimer manger donner trouver mettre partir sortir devoir vivre écrire lire " +
    "finir choisir attendre répondre entrer rester passer regarder écouter jouer acheter " +
    "payer commencer appeler courir dormir ouvrir boire").split(" ");

  const OBJ = {
    manger: "une pomme", boire: "de l'eau", lire: "un livre", écrire: "une lettre",
    parler: "à un ami", regarder: "la télé", écouter: "de la musique", jouer: "au foot",
    chanter: "une chanson", travailler: "à la maison", étudier: "le français",
    finir: "le travail", choisir: "un dessert", ouvrir: "la porte",
    prendre: "le bus", faire: "les devoirs", dire: "la vérité", voir: "un film",
    aller: "à l'école", partir: "en voyage", venir: "chez nous", sortir: "le soir",
    acheter: "du pain", donner: "un cadeau", aimer: "le chocolat", trouver: "la solution",
    chercher: "ses clés", attendre: "le bus", répondre: "à la question", gagner: "le match",
    dormir: "tôt", courir: "vite", mettre: "la table", perdre: "ses clés",
    porter: "un sac", montrer: "le chemin", écouter: "la radio", rendre: "le livre",
  };

  const FRAMES = {
    pres: ["Maintenant, {s} {b} {t}.", "Tous les jours, {s} {b} {t}.", "En ce moment, {s} {b} {t}.", "D'habitude, {s} {b} {t}."],
    imp:  ["Avant, {s} {b} {t} souvent.", "Quand j'étais petit, {s} {b} {t}.", "Autrefois, {s} {b} {t}.", "À cette époque-là, {s} {b} {t}."],
    fut:  ["Demain, {s} {b} {t}.", "La semaine prochaine, {s} {b} {t}.", "Bientôt, {s} {b} {t}.", "Un jour, {s} {b} {t}."],
    pc:   ["Hier, {s} {b} {t}.", "La semaine dernière, {s} {b} {t}.", "Ce matin, {s} {b} {t}.", "Récemment, {s} {b} {t}."],
    cond: ["À ta place, {s} {b} {t}.", "Si c'était possible, {s} {b} {t}.", "Avec plus de temps, {s} {b} {t}."],
    subj: ["Il faut que {s} {b} {t}.", "Je veux que {s} {b} {t}.", "Il est important que {s} {b} {t}.", "Bien que {s} {b} {t}, ça va."],
    impe: ["{b} {t} maintenant !", "{b} {t}, s'il te plaît !", "{b} {t} tout de suite !", "Allez, {b} {t} !"],
  };
  const BLANK = '<span class="blank">_____</span>';

  /* ---------------- storage ---------------- */
  const store = {
    level() { const n = parseInt(localStorage.getItem("cf_level"), 10); return [1, 2, 3, 4].includes(n) ? n : 2; },
    setLevel(n) { try { localStorage.setItem("cf_level", String(n)); } catch {} },
    rate() { const r = parseFloat(localStorage.getItem("cf_rate")); return isFinite(r) ? r : 0.9; },
    setRate(r) { try { localStorage.setItem("cf_rate", String(r)); } catch {} },
    active() {
      try {
        const a = JSON.parse(localStorage.getItem("cf_verbs"));
        if (Array.isArray(a) && a.length) return a;
      } catch {}
      return CORE.slice();
    },
    setActive(a) { try { localStorage.setItem("cf_verbs", JSON.stringify(a)); } catch {} },
  };

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
  }

  /* ---------------- spelling diff ---------------- */
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
    let i = n, j = m; const ops = [];
    while (i > 0 || j > 0) {
      const diag = i > 0 && j > 0 && eq(t[i - 1], g[j - 1]) ? 0 : 1;
      if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + diag) { ops.push({ k: diag === 0 ? "M" : "S", t: t[i - 1], g: g[j - 1] }); i--; j--; }
      else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { ops.push({ k: "MISS", t: t[i - 1] }); i--; }
      else { ops.push({ k: "EXTRA", g: g[j - 1] }); j--; }
    }
    ops.reverse();
    return { correct: n === m && ops.every((o) => o.k === "M"), ops };
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function renderRow(res, targetRow) {
    const sp = (txt, cls) => `<span class="${cls}">${esc(txt === " " ? "␣" : txt)}</span>`;
    let out = "";
    for (const o of res.ops) {
      if (o.k === "M") out += sp(targetRow ? o.t : o.g, "ok");
      else if (o.k === "S") out += sp(targetRow ? o.t : o.g, "bad");
      else if (o.k === "MISS") out += targetRow ? sp(o.t, "bad under") : sp("_", "dim");
      else out += targetRow ? sp("·", "dim") : sp(o.g, "bad strike");
    }
    return out;
  }
  const greenWord = (w) => [...w].map((c) => `<span class="ok">${esc(c === " " ? "␣" : c)}</span>`).join("");
  const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------------- challenge generation ---------------- */
  function pickChallenge() {
    const active = store.active().filter((inf) => VMAP[inf]);
    if (!active.length) return null;
    const tenses = LEVEL_TENSES[store.level()];
    for (let tries = 0; tries < 300; tries++) {
      const inf = active[(Math.random() * active.length) | 0];
      const v = VMAP[inf];
      const avail = tenses.filter((t) => v.t[t]);
      if (!avail.length) continue;
      const tense = avail[(Math.random() * avail.length) | 0];
      const forms = v.t[tense];
      let pIdx, answer, label;
      if (tense === "impe") {
        const cand = [0, 1, 2].filter((k) => forms[k]);
        if (!cand.length) continue;
        const k = cand[(Math.random() * cand.length) | 0];
        pIdx = IMPE_PIDX[k];
        answer = forms[k];
        label = IMPE_LABEL[pIdx];
      } else {
        const cand = [0, 1, 2, 3, 4, 5].filter((k) => forms[k]);
        if (!cand.length) continue;
        pIdx = cand[(Math.random() * cand.length) | 0];
        answer = forms[pIdx];
        label = PERSON_LABEL[pIdx];
      }
      return { v, inf, tense, tenseName: TENSE_NAME[tense], pIdx, answer, personLabel: label, impe: tense === "impe" };
    }
    return null;
  }

  function promptHTML(ch) {
    const en = ch.v.en ? `<div class="en">(${esc(ch.v.en)})</div>` : "";
    return `<div class="verb">${esc(ch.inf)}</div>${en}` +
      `<div class="spec"><b>${esc(ch.personLabel)}</b> &nbsp;·&nbsp; <span class="tense">${esc(ch.tenseName)}</span></div>`;
  }

  function buildCloze(ch) {
    const frames = FRAMES[ch.tense];
    const frame = frames[(Math.random() * frames.length) | 0];
    const tail = OBJ[ch.inf] || "";
    let s;
    if (ch.tense === "impe") {
      s = frame.replace("{b}", BLANK).replace("{t}", tail);
    } else {
      let subj;
      if (ch.pIdx === 0) subj = /^[aàâäeéèêëiîïoôöuùûüyh]/i.test(ch.answer) ? "j’" : "je";
      else subj = PERSON[ch.pIdx];
      s = frame.replace("{s}", subj).replace("{b}", BLANK).replace("{t}", tail);
      s = s.replace("j’ <span", "j’<span");
    }
    return s.replace(/\s+([.!?,])/g, "$1").replace(/\s{2,}/g, " ").trim();
  }
  function clozeSpoken(ch, sentence) {
    // strip HTML, replace blank with a pause for the "listen" button
    return sentence.replace(/<[^>]+>/g, "___").replace("___", ", ... ,").replace(/\s{2,}/g, " ");
  }

  function m3Options(ch) {
    const pool = new Set();
    (ch.v.t[ch.tense] || []).forEach((f) => { if (f && f !== ch.answer) pool.add(f); });
    for (const t of LEVEL_TENSES[store.level()]) {
      if (t === ch.tense || !ch.v.t[t]) continue;
      let f;
      if (t === "impe") { const k = [1, 3, 4].indexOf(ch.pIdx); f = k >= 0 ? ch.v.t.impe[k] : null; }
      else f = ch.v.t[t][ch.pIdx];
      if (f && f !== ch.answer) pool.add(f);
    }
    const arr = shuffle([...pool]).slice(0, 3);
    const opts = shuffle([ch.answer, ...arr]);
    let n = 1;
    while (opts.length < 4) { const c = ch.answer + (n === 1 ? "s" : "nt"); if (!opts.includes(c)) opts.push(c); n++; }
    return { opts, correctIdx: opts.indexOf(ch.answer) };
  }

  /* ---------------- keyboards ---------------- */
  const KEYS = [..."abcdefghijklmnopqrstuvwxyz".split(""),
    "é", "è", "ê", "ë", "à", "â", "î", "ï", "ô", "û", "ù", "ü", "ç", " "];
  function buildKeyboard(el, onKey) {
    if (el.dataset.built) return;
    el.dataset.built = "1";
    for (const k of KEYS) {
      const b = document.createElement("button");
      if (k === " ") { b.textContent = "espace"; b.className = "space"; }
      else b.textContent = k;
      b.addEventListener("click", () => onKey(k));
      el.appendChild(b);
    }
  }

  /* ---------------- routing ---------------- */
  const TITLES = { home: "Conjugaison FR", m1: "Conjugue", m2: "En contexte", m3: "Choix multiple", verbs: "Choisir les verbes" };
  function show(view) {
    $$("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== view));
    $("#backBtn").hidden = view === "home";
    $("#topTitle").textContent = TITLES[view] || "Conjugaison FR";
    window.scrollTo(0, 0);
    if (view === "home") refreshHome();
  }
  $("#backBtn").addEventListener("click", () => { if (canSpeak) speechSynthesis.cancel(); show("home"); });
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.go;
    ({ m1, m2, m3, verbs: verbsView }[v]).start();
    show(v);
  }));

  function refreshHome() {
    $$("#levelRow button").forEach((b) => b.classList.toggle("on", +b.dataset.lvl === store.level()));
    $("#levelDesc").textContent = LEVEL_DESC[store.level()];
    const n = store.active().filter((i) => VMAP[i]).length;
    $("#verbCount").textContent = n === 1 ? "1 verbe actif" : n + " verbes actifs";
    $("#rate").value = String(store.rate());
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    $("#installHint").hidden = !!standalone;
  }
  $$("#levelRow button").forEach((b) => b.addEventListener("click", () => { store.setLevel(+b.dataset.lvl); refreshHome(); }));
  $("#rate").addEventListener("change", (e) => { store.setRate(parseFloat(e.target.value)); say("Voici la vitesse de la voix"); });

  function endPrompt(score, aided, total, restart) {
    const again = window.confirm(`Série terminée !\nSans aide : ${score} / ${total}\nAvec aide : ${aided}\n\nRecommencer ?`);
    if (again) restart(); else show("home");
  }

  /* =============== TYPED MODES (shared) =============== */
  function makeTypedMode(ids, opts) {
    // ids: {progress, empty, body, prompt|cloze, hintLine, guess, kb, back, clear, check,
    //       result, answerRow, target, yours, summary, retry, reveal2, next, listen?}
    let ch = null, guess = "", n = 0, score = 0, aided = 0;
    let scored = false, aidedThis = false, revealCount = 0, attempts = 0, revealed = false;
    const REVEAL_AFTER = 3;
    const el = (k) => $("#" + ids[k]);

    buildKeyboard(el("kb"), (k) => { guess += k; refreshGuess(); });
    el("back").addEventListener("click", () => { guess = guess.slice(0, -1); refreshGuess(); });
    el("clear").addEventListener("click", () => { guess = ""; refreshGuess(); });
    el("check").addEventListener("click", onCheck);
    el("retry").addEventListener("click", () => { el("result").hidden = true; });
    el("reveal2").addEventListener("click", revealAnswer);
    el("next").addEventListener("click", next);
    el("hint").addEventListener("click", revealHint);
    if (ids.listen) el("listen").addEventListener("click", () => opts.onListen && opts.onListen(ch));

    function start() {
      const active = store.active().filter((i) => VMAP[i]);
      const empty = active.length === 0;
      el("empty").hidden = !empty;
      el("body").hidden = empty;
      el("progress").textContent = "";
      if (empty) return;
      n = 0; score = 0; aided = 0;
      round();
    }
    function round() {
      ch = pickChallenge();
      if (!ch) { el("empty").hidden = false; el("body").hidden = true; return; }
      guess = "";
      scored = false; aidedThis = false; revealed = false;
      revealCount = 0; attempts = 0;
      n++;
      el("result").hidden = true;
      el("hintLine").hidden = true;
      el("progress").textContent = progressText();
      opts.render(ch, el);
      refreshGuess();
    }
    function progressText() {
      return `Question ${n}     Score : ${score}` + (aided > 0 ? `   ·   avec aide : ${aided}` : "");
    }
    function refreshGuess() {
      el("guess").textContent = guess.length ? [...guess].join(" ") : "—";
    }
    function revealHint() {
      const a = ch.answer;
      if (revealCount < a.length) revealCount++;
      aidedThis = true;
      let s = "";
      [...a].forEach((c, i) => { s += (i < revealCount ? (c === " " ? "␣" : c) : "_") + " "; });
      el("hintLine").textContent = "Indice : " + s.trim();
      el("hintLine").hidden = false;
    }
    function onCheck() {
      if (!norm(guess)) { say("Écris d'abord ta réponse"); return; }
      const res = checkSpelling(ch.answer, guess);
      const ok = norm(guess) === norm(ch.answer);
      el("yours").innerHTML = renderRow(res, false);
      const sum = el("summary");
      if (ok) {
        if (!scored) { if (aidedThis || revealed) aided++; else score++; scored = true; }
        el("answerRow").hidden = false;
        el("target").innerHTML = renderRow(checkSpelling(ch.answer, ch.answer), true);
        sum.style.color = "var(--ok)";
        sum.textContent = aidedThis || revealed ? "Bravo ! 🎉  (avec aide)" : "Bravo ! 🎉";
        el("retry").hidden = true;
        el("reveal2").hidden = true;
        el("progress").textContent = progressText();
        feedback("correct");
      } else {
        attempts++;
        if (!revealed) el("answerRow").hidden = true;
        sum.style.color = "var(--bad)";
        sum.textContent = "Essaie encore — regarde les lettres en rouge.";
        el("retry").hidden = false;
        el("reveal2").hidden = !(attempts >= REVEAL_AFTER && !revealed);
        feedback("wrong");
      }
      el("result").hidden = false;
    }
    function revealAnswer() {
      revealed = true; aidedThis = true;
      el("answerRow").hidden = false;
      el("target").innerHTML = greenWord(ch.answer);
      const sum = el("summary");
      sum.style.color = "var(--ink)";
      sum.textContent = "La bonne réponse : " + ch.answer;
      el("reveal2").hidden = true;
    }
    function next() {
      if (n >= 15) { endPrompt(score, aided, 15, () => { n = 0; score = 0; aided = 0; round(); }); return; }
      round();
    }
    return { start };
  }

  const m1 = makeTypedMode(
    { prompt: "m1Prompt", progress: "m1Progress", empty: "m1Empty", body: "m1Body",
      hint: "m1Hint", hintLine: "m1HintLine",
      guess: "m1Guess", kb: "m1Keyboard", back: "m1Back", clear: "m1Clear", check: "m1Check",
      result: "m1Result", answerRow: "m1AnswerRow", target: "m1Target", yours: "m1Yours",
      summary: "m1Summary", retry: "m1Retry", reveal2: "m1Reveal2", next: "m1Next" },
    { render: (ch, el) => { el("prompt").innerHTML = promptHTML(ch); } }
  );

  const m2 = makeTypedMode(
    { cloze: "m2Cloze", progress: "m2Progress", empty: "m2Empty", body: "m2Body",
      hint: "m2Hint", hintLine: "m2HintLine",
      guess: "m2Guess", kb: "m2Keyboard", back: "m2Back", clear: "m2Clear", check: "m2Check",
      result: "m2Result", answerRow: "m2AnswerRow", target: "m2Target", yours: "m2Yours",
      summary: "m2Summary", retry: "m2Retry", reveal2: "m2Reveal2", next: "m2Next", listen: "m2Listen" },
    {
      render: (ch, el) => {
        const sentence = buildCloze(ch);
        ch._sentence = sentence;
        el("cloze").innerHTML = sentence +
          ` <span class="inf">(${esc(ch.inf)})</span>` +
          `<span class="tense">→ ${esc(ch.tenseName)} · ${esc(ch.personLabel)}</span>`;
      },
      onListen: (ch) => { if (ch && ch._sentence) say(clozeSpoken(ch, ch._sentence)); },
    }
  );

  /* =============== MODE 3 — MULTIPLE CHOICE =============== */
  const m3 = (() => {
    let ch = null, opts = [], correctIdx = -1, n = 0, score = 0, aided = 0, solved = false, wrong = false;
    const optBtns = $$("#m3 .opt");
    function start() {
      const active = store.active().filter((i) => VMAP[i]);
      const empty = active.length === 0;
      $("#m3Empty").hidden = !empty;
      $("#m3Body").hidden = empty;
      $("#m3Progress").textContent = "";
      if (empty) return;
      n = 0; score = 0; aided = 0;
      round();
    }
    function round() {
      ch = pickChallenge();
      if (!ch) { $("#m3Empty").hidden = false; $("#m3Body").hidden = true; return; }
      solved = false; wrong = false;
      n++;
      $("#m3Feedback").textContent = "";
      $("#m3Feedback").className = "feedback";
      $("#m3Next").hidden = true;
      $("#m3Prompt").innerHTML = promptHTML(ch);
      const o = m3Options(ch);
      opts = o.opts; correctIdx = o.correctIdx;
      optBtns.forEach((b, i) => { b.textContent = opts[i]; b.disabled = false; b.className = "opt"; });
      $("#m3Progress").textContent = `Question ${n}     Score : ${score}` + (aided > 0 ? `   ·   avec aide : ${aided}` : "");
    }
    function pick(i) {
      if (solved || optBtns[i].disabled) return;
      if (i === correctIdx) {
        solved = true;
        optBtns[i].classList.add("good");
        optBtns.forEach((b) => (b.disabled = true));
        $("#m3Feedback").className = "feedback good";
        $("#m3Feedback").textContent = wrong ? "Bravo ! (avec aide)" : "Bravo ! 🎉";
        if (wrong) aided++; else score++;
        $("#m3Progress").textContent = `Question ${n}     Score : ${score}` + (aided > 0 ? `   ·   avec aide : ${aided}` : "");
        feedback("correct");
        $("#m3Next").hidden = false;
      } else {
        wrong = true;
        optBtns[i].disabled = true;
        optBtns[i].classList.add("bad");
        $("#m3Feedback").className = "feedback bad";
        $("#m3Feedback").textContent = "Essaie encore.";
        feedback("wrong");
      }
    }
    function next() {
      if (n >= 15) { endPrompt(score, aided, 15, () => { n = 0; score = 0; aided = 0; round(); }); return; }
      round();
    }
    optBtns.forEach((b, i) => b.addEventListener("click", () => pick(i)));
    $("#m3Next").addEventListener("click", next);
    return { start };
  })();

  /* =============== VERB PICKER =============== */
  const verbsView = (() => {
    function start() { render(); }
    function render() {
      const sel = new Set(store.active());
      const box = $("#verbPick");
      box.innerHTML = "";
      for (const v of VERBS) {
        const id = "vp_" + v.inf.replace(/[^a-z]/gi, "");
        const lab = document.createElement("label");
        lab.innerHTML = `<input type="checkbox" ${sel.has(v.inf) ? "checked" : ""}> <span>${esc(v.inf)}</span>`;
        lab.querySelector("input").addEventListener("change", (e) => {
          const cur = new Set(store.active());
          if (e.target.checked) cur.add(v.inf); else cur.delete(v.inf);
          store.setActive([...cur]);
          updateCount();
        });
        box.appendChild(lab);
      }
      updateCount();
    }
    function updateCount() {
      const n = store.active().filter((i) => VMAP[i]).length;
      $("#pickCount").textContent = (n === 1 ? "1 verbe coché" : n + " verbes cochés");
    }
    function setAll(list) { store.setActive(list); render(); }
    $("#pickAll").addEventListener("click", () => setAll(VERBS.map((v) => v.inf)));
    $("#pickNone").addEventListener("click", () => setAll([]));
    $("#pickCore").addEventListener("click", () => setAll(CORE.filter((i) => VMAP[i])));
    $("#pickG1").addEventListener("click", () => setAll(VERBS.filter((v) => v.group === 1).map((v) => v.inf)));
    $("#pickG2").addEventListener("click", () => setAll(VERBS.filter((v) => v.group === 2).map((v) => v.inf)));
    $("#pickG3").addEventListener("click", () => setAll(VERBS.filter((v) => v.group === 3).map((v) => v.inf)));
    return { start };
  })();

  /* ---------------- boot ---------------- */
  fetch("./verbs.json")
    .then((r) => r.json())
    .then((d) => {
      VERBS = d.verbs || [];
      VERBS.forEach((v) => (VMAP[v.inf] = v));
      DATA_READY = true;
      refreshHome();
    })
    .catch(() => {
      $("#verbCount").textContent = "Erreur : impossible de charger les verbes.";
    });

  show("home");
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
