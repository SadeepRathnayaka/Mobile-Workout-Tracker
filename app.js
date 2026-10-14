(function () {
  "use strict";

  const KEYS = {
    data: "wt.data",
    drafts: "wt.drafts",
    settings: "wt.settings",
    schedule: "wt.schedule",
  };
  const KG_PER_LB = 0.45359237;

  const app = document.getElementById("app");
  const titleEl = document.getElementById("title");
  const backBtn = document.getElementById("backBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const toastEl = document.getElementById("toast");

  // ---------- Storage ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getData() {
    const data = load(KEYS.data, null);
    if (data && Array.isArray(data.sessions)) return data;
    return { version: 1, sessions: [] };
  }

  function setData(data) { save(KEYS.data, data); }
  function getDrafts() { return load(KEYS.drafts, {}); }
  function setDrafts(drafts) { save(KEYS.drafts, drafts); }
  function getSettings() { return Object.assign({ unit: "kg" }, load(KEYS.settings, {})); }
  function setSettings(s) { save(KEYS.settings, s); }

  // The routine you edited in the app, or the defaults from schedule.js.
  function getSchedule() {
    const stored = load(KEYS.schedule, null);
    return Array.isArray(stored) && stored.length ? stored : JSON.parse(JSON.stringify(SCHEDULE));
  }
  function setSchedule(s) { save(KEYS.schedule, s); }

  // ---------- Helpers ----------

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fmtDate(iso, withYear) {
    const d = new Date(iso);
    const opts = { month: "short", day: "numeric" };
    if (withYear || d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString(undefined, opts);
  }

  function daysAgo(iso) {
    const start = new Date(iso);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const n = Math.round((today - start) / 86400000);
    if (n === 0) return "today";
    if (n === 1) return "yesterday";
    return n + " days ago";
  }

  function shortAgo(iso) {
    const label = daysAgo(iso);
    if (label === "today") return "Today";
    if (label === "yesterday") return "1d";
    return label.replace(" days ago", "d");
  }

  function convert(weight, fromUnit, toUnit) {
    if (weight == null || weight === "" || fromUnit === toUnit) return weight;
    const w = Number(weight);
    const out = fromUnit === "kg" ? w / KG_PER_LB : w * KG_PER_LB;
    return Math.round(out * 4) / 4;
  }

  function fmtNum(n) {
    if (n == null || n === "") return "-";
    return String(Math.round(Number(n) * 100) / 100);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.hidden = true; }, 2200);
  }

  function findDay(dayId) {
    return getSchedule().find((d) => d.id === dayId);
  }

  function formVideoUrl(ex) {
    const q = (ex.search || ex.name) + " proper form";
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  }

  function findExercise(exId) {
    for (const day of getSchedule()) {
      const ex = day.exercises.find((e) => e.id === exId);
      if (ex) return ex;
    }
    return null;
  }

  function sortedSessions() {
    return getData().sessions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // Most recent saved sets for an exercise, converted to the current unit.
  function lastEntry(exId) {
    const unit = getSettings().unit;
    for (const s of sortedSessions()) {
      const entry = s.entries.find((e) => e.exerciseId === exId);
      if (entry && entry.sets.length) {
        return {
          date: s.date,
          sets: entry.sets.map((set) => ({
            weight: convert(set.weight, s.unit || "kg", unit),
            reps: set.reps,
          })),
        };
      }
    }
    return null;
  }

  function lastDoneDate(dayId) {
    const s = sortedSessions().find((x) => x.dayId === dayId);
    return s ? s.date : null;
  }

  function nextDayId() {
    const schedule = getSchedule();
    const latest = sortedSessions()[0];
    if (!latest) return schedule[0].id;
    const idx = schedule.findIndex((d) => d.id === latest.dayId);
    return schedule[(idx + 1) % schedule.length].id;
  }

  function setsSummary(sets, unit) {
    return sets.map((s) => `${fmtNum(s.weight)}${unit} x${s.reps}`).join(", ");
  }

  function setHeader(title, backHash) {
    titleEl.textContent = title;
    backBtn.hidden = !backHash;
    backBtn.onclick = backHash ? () => { location.hash = backHash; } : null;
  }

  function setBottomBar(html) {
    let bar = document.querySelector(".bottom-bar");
    if (!html) {
      if (bar) bar.remove();
      return null;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "bottom-bar";
      document.body.appendChild(bar);
    }
    bar.innerHTML = html;
    return bar;
  }

  // ---------- Home ----------

  const QUOTES = [
    "No excuses. Just results.",
    "Stronger than yesterday.",
    "One more rep.",
    "Earn it.",
    "Light weight, baby!",
    "The only bad workout is the one you skipped.",
    "Beat your last numbers.",
    "Discipline over motivation.",
  ];

  function startOfWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function renderHome() {
    setHeader("Workout", null);
    setBottomBar(null);
    const next = nextDayId();
    const nextDay = findDay(next);
    const drafts = getDrafts();
    const sessions = sortedSessions();
    const weekStart = startOfWeek();
    const thisWeek = sessions.filter((s) => new Date(s.date) >= weekStart).length;
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    const hero = `
      <section class="hero">
        <div class="hero-kicker">Up next</div>
        <div class="hero-title">${esc(nextDay.focus)}</div>
        <div class="hero-sub">${esc(quote)}</div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="num">${thisWeek}</div><div class="lbl">This week</div></div>
          <div class="hero-stat"><div class="num">${sessions.length}</div><div class="lbl">Total</div></div>
          <div class="hero-stat"><div class="num">${sessions.length ? shortAgo(sessions[0].date) : "-"}</div><div class="lbl">Last workout</div></div>
        </div>
      </section>
      <div class="section-title">Your split</div>`;

    app.innerHTML = hero + getSchedule().map((day, idx) => {
      const last = lastDoneDate(day.id);
      const isNext = day.id === next;
      return `
        <button class="card day-card ${isNext ? "next" : ""}" data-day="${day.id}">
          <div class="day-num">${String(idx + 1).padStart(2, "0")}</div>
          <div class="day-body">
            <div class="day-name">${esc(day.focus)}
              ${isNext ? '<span class="badge">Next</span>' : ""}
              ${drafts[day.id] ? '<span class="badge draft">In progress</span>' : ""}
            </div>
            <div class="meta">
              <span>${esc(day.name)} &middot; ${day.exercises.length} exercises</span>
              <span>${last ? fmtDate(last) : "Not done yet"}</span>
            </div>
          </div>
          <div class="chev">&#8250;</div>
        </button>`;
    }).join("");

    app.querySelectorAll("[data-day]").forEach((el) => {
      el.addEventListener("click", () => { location.hash = "#/day/" + el.dataset.day; });
    });
  }

  // ---------- Day / logging ----------

  function newDraft(day) {
    const entries = {};
    for (const ex of day.exercises) {
      const last = lastEntry(ex.id);
      entries[ex.id] = {
        sets: ex.reps.map((target, i) => {
          const prev = last ? (last.sets[i] || last.sets[last.sets.length - 1]) : null;
          return {
            weight: prev && prev.weight != null ? prev.weight : "",
            reps: target,
            done: false,
          };
        }),
      };
    }
    return { dayId: day.id, startedAt: new Date().toISOString(), unit: getSettings().unit, entries };
  }

  function getDraft(day) {
    const drafts = getDrafts();
    let draft = drafts[day.id];
    if (!draft) return newDraft(day);
    const unit = getSettings().unit;
    if (draft.unit && draft.unit !== unit) {
      for (const id in draft.entries) {
        for (const s of draft.entries[id].sets) s.weight = convert(s.weight, draft.unit, unit);
      }
    }
    draft.unit = unit;
    // Pick up exercises added to schedule.js after the draft was created.
    const fresh = newDraft(day);
    for (const ex of day.exercises) {
      if (!draft.entries[ex.id]) draft.entries[ex.id] = fresh.entries[ex.id];
    }
    return draft;
  }

  function persistDraft(draft) {
    const drafts = getDrafts();
    drafts[draft.dayId] = draft;
    setDrafts(drafts);
  }

  function discardDraft(dayId) {
    const drafts = getDrafts();
    delete drafts[dayId];
    setDrafts(drafts);
  }

  function setRowHtml(exId, i, set, prev) {
    return `
      <div class="set-row ${set.done ? "done" : ""}" data-ex="${exId}" data-i="${i}">
        <div class="set-num">${i + 1}</div>
        <div class="set-prev">${prev ? `${fmtNum(prev.weight)} &times; ${prev.reps}` : "&ndash;"}</div>
        <input type="number" inputmode="decimal" step="any" min="0" data-field="weight"
               value="${set.weight === "" ? "" : esc(set.weight)}" placeholder="0" aria-label="Weight">
        <input type="number" inputmode="numeric" pattern="[0-9]*" min="0" data-field="reps"
               value="${set.reps === "" ? "" : esc(set.reps)}" placeholder="0" aria-label="Reps">
        <button class="check" data-action="toggle" aria-label="Mark set done">&#10003;</button>
      </div>`;
  }

  function setRowsHtml(exId, sets, last) {
    return sets.map((s, i) => setRowHtml(exId, i, s, last && last.sets[i])).join("");
  }

  function renderDay(dayId) {
    const day = findDay(dayId);
    if (!day) { location.hash = "#/"; return; }
    const unit = getSettings().unit;
    const draft = getDraft(day);
    const hasSavedDraft = !!getDrafts()[day.id];

    setHeader(day.focus, "#/");

    const isComplete = (exId) => draft.entries[exId].sets.every((s) => s.done);

    const lastByEx = {};
    for (const ex of day.exercises) lastByEx[ex.id] = lastEntry(ex.id);

    const tools = `
      <div class="day-tools">
        <button class="link-btn" data-edit="${day.id}">&#9998; Edit exercises</button>
      </div>
      ${day.exercises.length ? "" : '<div class="card empty">No exercises in this day yet. Tap Edit exercises to add some.</div>'}`;

    app.innerHTML = tools + day.exercises.map((ex, idx) => {
      const last = lastByEx[ex.id];
      const sets = draft.entries[ex.id].sets;
      return `
        <section class="card ex-card ${isComplete(ex.id) ? "complete" : ""}" data-exercise="${ex.id}">
          <div class="ex-head">
            <div class="ex-info">
              <div class="ex-index">${idx + 1} of ${day.exercises.length}</div>
              <h2 class="ex-name">${esc(ex.name)}</h2>
              <div class="ex-target">Target ${ex.reps.join(" &middot; ")}${last ? ` <span class="dot">&bull;</span> Last ${fmtDate(last.date)}` : ""}</div>
              ${ex.note ? `<div class="ex-note">${esc(ex.note)}</div>` : ""}
            </div>
            <div class="ex-actions">
              <a class="link-btn yt" href="${esc(formVideoUrl(ex))}" target="_blank" rel="noopener">&#9654; Form</a>
              <button class="link-btn" data-history="${ex.id}">History</button>
            </div>
          </div>
          <div class="set-head">
            <span>Set</span><span>Previous</span><span>${unit}</span><span>Reps</span><span>&#10003;</span>
          </div>
          <div class="sets">${setRowsHtml(ex.id, sets, last)}</div>
          <div class="set-actions">
            <button class="link-btn ghost" data-action="add-set" data-ex="${ex.id}">+ Add set</button>
            <button class="link-btn ghost" data-action="remove-set" data-ex="${ex.id}">&minus; Remove set</button>
          </div>
        </section>`;
    }).join("") + `
      ${hasSavedDraft ? '<button class="btn danger" id="discardBtn">Discard this workout</button>' : ""}
    `;

    const bar = setBottomBar(`
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <button class="btn" id="finishBtn">Finish workout</button>`);
    const finishBtn = bar.querySelector("#finishBtn");
    const progressFill = bar.querySelector("#progressFill");
    finishBtn.addEventListener("click", () => finishWorkout(day, draft));

    function updateProgress() {
      let done = 0;
      let total = 0;
      for (const ex of day.exercises) {
        for (const s of draft.entries[ex.id].sets) {
          total++;
          if (s.done) done++;
        }
        const card = app.querySelector(`[data-exercise="${ex.id}"]`);
        if (card) card.classList.toggle("complete", isComplete(ex.id));
      }
      finishBtn.textContent = `Finish workout \u00b7 ${done}/${total} sets`;
      progressFill.style.width = total ? (done / total) * 100 + "%" : "0%";
    }
    updateProgress();

    const discardBtn = document.getElementById("discardBtn");
    if (discardBtn) {
      discardBtn.addEventListener("click", () => {
        if (confirm("Discard the sets you've entered for this workout?")) {
          discardDraft(day.id);
          route();
          toast("Workout discarded");
        }
      });
    }

    app.addEventListener("input", onInput);
    app.addEventListener("click", onClick);

    function onInput(e) {
      const input = e.target;
      const row = input.closest(".set-row");
      if (!row || !input.dataset.field) return;
      const set = draft.entries[row.dataset.ex].sets[Number(row.dataset.i)];
      set[input.dataset.field] = input.value === "" ? "" : Number(input.value);
      persistDraft(draft);
    }

    function onClick(e) {
      const histBtn = e.target.closest("[data-history]");
      if (histBtn) {
        location.hash = "#/ex/" + histBtn.dataset.history;
        return;
      }
      const editBtn = e.target.closest("[data-edit]");
      if (editBtn) {
        location.hash = "#/edit/" + editBtn.dataset.edit;
        return;
      }
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "toggle") {
        const row = btn.closest(".set-row");
        const set = draft.entries[row.dataset.ex].sets[Number(row.dataset.i)];
        set.done = !set.done;
        row.classList.toggle("done", set.done);
        persistDraft(draft);
        updateProgress();
        return;
      }

      const exId = btn.dataset.ex;
      const sets = draft.entries[exId].sets;
      if (action === "add-set") {
        const prev = sets[sets.length - 1] || { weight: "", reps: "" };
        sets.push({ weight: prev.weight, reps: prev.reps, done: false });
      } else if (action === "remove-set") {
        if (sets.length <= 1) return;
        sets.pop();
      }
      persistDraft(draft);
      const container = app.querySelector(`[data-exercise="${exId}"] .sets`);
      container.innerHTML = setRowsHtml(exId, sets, lastByEx[exId]);
      updateProgress();
    }

    cleanupDay = () => {
      app.removeEventListener("input", onInput);
      app.removeEventListener("click", onClick);
    };
  }

  let cleanupDay = null;

  function finishWorkout(day, draft) {
    const unit = getSettings().unit;
    const entries = [];
    for (const ex of day.exercises) {
      const sets = draft.entries[ex.id].sets
        .filter((s) => s.done && s.reps !== "" && Number(s.reps) > 0)
        .map((s) => ({ weight: s.weight === "" ? 0 : Number(s.weight), reps: Number(s.reps) }));
      if (sets.length) entries.push({ exerciseId: ex.id, sets });
    }

    if (!entries.length) {
      alert("Tick at least one set as done before finishing.");
      return;
    }

    const doneCount = entries.reduce((n, e) => n + e.sets.length, 0);
    if (!confirm(`Save this workout? (${doneCount} sets across ${entries.length} exercises)`)) return;

    const data = getData();
    data.sessions.push({
      id: uid(),
      dayId: day.id,
      date: new Date().toISOString(),
      unit,
      entries,
    });
    setData(data);
    discardDraft(day.id);
    toast("Workout saved");
    location.hash = "#/";
  }

  // ---------- Edit exercises ----------

  function parseReps(text) {
    const parts = String(text).split(/[\s,]+/).filter(Boolean);
    if (parts.length < 1 || parts.length > 10) return null;
    const reps = parts.map(Number);
    return reps.every((n) => Number.isInteger(n) && n >= 1 && n <= 100) ? reps : null;
  }

  function renderEdit(dayId, from) {
    const schedule = getSchedule();
    const day = schedule.find((d) => d.id === dayId);
    if (!day) { location.hash = "#/"; return; }
    const backHash = from === "settings" ? "#/settings" : "#/day/" + day.id;
    const original = {};
    for (const ex of day.exercises) original[ex.id] = ex;

    // Working copy; reps stay as text so partial typing like "12, 1" isn't lost.
    let rows = day.exercises.map((ex) => ({ id: ex.id, name: ex.name, repsText: ex.reps.join(", ") }));
    const startJson = JSON.stringify(rows);

    setHeader("Edit " + day.focus, backHash);
    backBtn.onclick = () => {
      if (JSON.stringify(rows) !== startJson && !confirm("Discard your changes?")) return;
      location.hash = backHash;
    };

    function rowHtml(r, i) {
      return `
        <section class="card edit-card" data-i="${i}">
          <div class="edit-top">
            <span class="ex-index">${i + 1}</span>
            <input class="edit-input" type="text" data-field="name" value="${esc(r.name)}"
                   placeholder="Exercise name" aria-label="Exercise name" autocomplete="off">
          </div>
          <div class="edit-bottom">
            <label class="edit-reps">
              <span>Target reps</span>
              <input class="edit-input" type="text" data-field="repsText" value="${esc(r.repsText)}"
                     placeholder="12, 10, 10, 8" aria-label="Target reps per set" autocomplete="off">
            </label>
            <div class="edit-tools">
              <button class="icon-btn small" data-action="up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>&#8593;</button>
              <button class="icon-btn small" data-action="down" aria-label="Move down" ${i === rows.length - 1 ? "disabled" : ""}>&#8595;</button>
              <button class="icon-btn small danger" data-action="delete" aria-label="Delete exercise">&#10005;</button>
            </div>
          </div>
        </section>`;
    }

    function renderRows() {
      app.innerHTML = `
        <p class="small edit-help">Separate target reps with commas. The number of values sets how many sets you do.</p>
        ${rows.length ? rows.map(rowHtml).join("") : '<div class="card empty">No exercises yet.</div>'}
        <button class="btn secondary" data-action="add">+ Add exercise</button>`;
    }

    renderRows();
    setBottomBar('<button class="btn" id="saveBtn">Save exercises</button>')
      .querySelector("#saveBtn").addEventListener("click", saveEdits);

    function onInput(e) {
      const input = e.target;
      const card = input.closest(".edit-card");
      if (!card || !input.dataset.field) return;
      rows[Number(card.dataset.i)][input.dataset.field] = input.value;
      input.classList.remove("invalid");
    }

    function onClick(e) {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "add") {
        rows.push({ id: null, name: "", repsText: "12, 12, 12, 12" });
        renderRows();
        const inputs = app.querySelectorAll('[data-field="name"]');
        inputs[inputs.length - 1].focus();
        return;
      }
      const i = Number(btn.closest(".edit-card").dataset.i);
      if (action === "up" && i > 0) {
        [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
      } else if (action === "down" && i < rows.length - 1) {
        [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
      } else if (action === "delete") {
        const label = rows[i].name.trim() || "this exercise";
        if (!confirm(`Delete ${label}? Its past history stays saved.`)) return;
        rows.splice(i, 1);
      } else {
        return;
      }
      renderRows();
    }

    function saveEdits() {
      let firstBad = null;
      const exercises = rows.map((r, i) => {
        const card = app.querySelector(`.edit-card[data-i="${i}"]`);
        const name = r.name.trim();
        const reps = parseReps(r.repsText);
        if (!name) {
          const el = card.querySelector('[data-field="name"]');
          el.classList.add("invalid");
          firstBad = firstBad || el;
        }
        if (!reps) {
          const el = card.querySelector('[data-field="repsText"]');
          el.classList.add("invalid");
          firstBad = firstBad || el;
        }
        const prev = r.id ? original[r.id] : null;
        const ex = prev ? Object.assign({}, prev) : { id: "custom-" + uid() };
        ex.name = name;
        ex.reps = reps;
        if (prev && prev.name !== name) delete ex.search;
        return ex;
      });

      if (firstBad) {
        firstBad.focus();
        alert("Every exercise needs a name, and target reps must be 1 to 10 whole numbers between 1 and 100.");
        return;
      }

      day.exercises = exercises;
      setSchedule(schedule);
      toast("Exercises saved");
      location.hash = backHash;
    }

    app.addEventListener("input", onInput);
    app.addEventListener("click", onClick);
    cleanupDay = () => {
      app.removeEventListener("input", onInput);
      app.removeEventListener("click", onClick);
    };
  }

  // ---------- Exercise history ----------

  function renderExercise(exId) {
    const ex = findExercise(exId);
    if (!ex) { location.hash = "#/"; return; }
    const unit = getSettings().unit;
    const back = getSchedule().find((d) => d.exercises.some((e) => e.id === exId));
    const backHash = sessionStorage.getItem("wt.lastDay")
      ? "#/day/" + sessionStorage.getItem("wt.lastDay")
      : "#/day/" + back.id;
    setHeader(ex.name, backHash);
    setBottomBar(null);

    // Oldest first, weights in current unit.
    const history = sortedSessions().reverse()
      .map((s) => {
        const entry = s.entries.find((e) => e.exerciseId === exId);
        if (!entry || !entry.sets.length) return null;
        return {
          date: s.date,
          sets: entry.sets.map((set) => ({
            weight: convert(set.weight, s.unit || "kg", unit),
            reps: set.reps,
          })),
        };
      })
      .filter(Boolean);

    const formLink = `<a class="btn secondary yt-btn" href="${esc(formVideoUrl(ex))}" target="_blank" rel="noopener">&#9654; Watch form</a>`;

    if (!history.length) {
      app.innerHTML = `
        <div class="card">
          <div class="ex-target">Target: ${ex.reps.join(" / ")}</div>
          <div class="empty">No sessions logged yet.</div>
        </div>
        ${formLink}`;
      return;
    }

    let best = null;
    let bestE1rm = 0;
    for (const h of history) {
      for (const s of h.sets) {
        if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s;
        const e1rm = s.weight * (1 + s.reps / 30);
        if (e1rm > bestE1rm) bestE1rm = e1rm;
      }
    }
    const latest = history[history.length - 1];
    const latestTop = Math.max(...latest.sets.map((s) => s.weight));
    const points = history.map((h) => ({
      date: h.date,
      value: Math.max(...h.sets.map((s) => s.weight)),
    }));

    app.innerHTML = `
      <div class="card">
        <div class="stats">
          <div class="stat highlight"><div class="label">Best set</div><div class="value">${fmtNum(best.weight)}${unit} x${best.reps}</div></div>
          <div class="stat"><div class="label">Last top weight</div><div class="value">${fmtNum(latestTop)}${unit}</div></div>
          <div class="stat"><div class="label">Est. 1 rep max</div><div class="value">${fmtNum(Math.round(bestE1rm * 10) / 10)}${unit}</div></div>
          <div class="stat"><div class="label">Sessions</div><div class="value">${history.length}</div></div>
        </div>
      </div>
      ${formLink}
      <div class="section-title">Top weight per session</div>
      <div class="card"><canvas class="chart" id="chart"></canvas></div>
      <div class="section-title">Sessions</div>
      <div class="card">
        ${history.slice().reverse().map((h) => `
          <div class="history-session">
            <div class="date">${fmtDate(h.date, true)} <span class="small">(${daysAgo(h.date)})</span></div>
            <div class="sets">${esc(setsSummary(h.sets, unit))}</div>
          </div>`).join("")}
      </div>`;

    drawChart(document.getElementById("chart"), points, unit);
  }

  function drawChart(canvas, points, unit) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const pad = { l: 40, r: 12, t: 22, b: 26 };
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 5; max += 5; }
    const range = max - min;
    min = Math.max(0, min - range * 0.1);
    max = max + range * 0.1;

    const x = (i) => points.length === 1
      ? pad.l + (w - pad.l - pad.r) / 2
      : pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillStyle = "#8d8d96";
    ctx.strokeStyle = "#2a2a30";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const v = min + ((max - min) * i) / 3;
      const yy = y(v);
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(w - pad.r, yy);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(fmtNum(Math.round(v * 10) / 10), pad.l - 6, yy);
    }

    ctx.textBaseline = "top";
    const last = points.length - 1;
    const labelIdx = last === 0 ? [0] : [0, last];
    for (const i of labelIdx) {
      ctx.textAlign = last === 0 ? "center" : i === 0 ? "left" : "right";
      const lx = last === 0 ? x(i) : i === 0 ? pad.l : w - pad.r;
      ctx.fillText(fmtDate(points[i].date), lx, h - pad.b + 8);
    }

    if (points.length > 1) {
      const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      grad.addColorStop(0, "rgba(212, 255, 0, 0.35)");
      grad.addColorStop(1, "rgba(212, 255, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x(0), h - pad.b);
      points.forEach((p, i) => ctx.lineTo(x(i), y(p.value)));
      ctx.lineTo(x(points.length - 1), h - pad.b);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "#d4ff00";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(212, 255, 0, 0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.value)) : ctx.moveTo(x(i), y(p.value))));
    ctx.stroke();
    ctx.shadowBlur = 0;

    points.forEach((p, i) => {
      ctx.fillStyle = "#0a0a0b";
      ctx.beginPath();
      ctx.arc(x(i), y(p.value), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d4ff00";
      ctx.beginPath();
      ctx.arc(x(i), y(p.value), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#8d8d96";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(unit, 4, 2);
  }

  // ---------- Settings ----------

  function renderSettings() {
    const settings = getSettings();
    const data = getData();
    const customised = !!load(KEYS.schedule, null);
    setHeader("Settings", "#/");
    setBottomBar(null);

    app.innerHTML = `
      <div class="card setting-row">
        <div>Weight unit</div>
        <div class="segmented">
          <button data-unit="kg" class="${settings.unit === "kg" ? "active" : ""}">kg</button>
          <button data-unit="lb" class="${settings.unit === "lb" ? "active" : ""}">lb</button>
        </div>
      </div>

      <div class="section-title">Routine</div>
      <div class="card routine-list">
        ${getSchedule().map((day) => `
          <div class="routine-row">
            <div>
              <div class="routine-name">${esc(day.focus)}</div>
              <div class="small">${esc(day.name)} &middot; ${day.exercises.length} exercises</div>
            </div>
            <button class="link-btn" data-edit-day="${day.id}">Edit</button>
          </div>`).join("")}
        ${customised ? '<button class="btn secondary" id="resetRoutineBtn">Reset to default routine</button>' : ""}
      </div>

      <div class="section-title">Backup</div>
      <div class="card">
        <p class="small" style="margin-top:0">
          ${data.sessions.length} workouts saved on this device. Export a backup now and then
          (save it to Files or iCloud Drive). Importing merges a backup with what's already here.
        </p>
        <button class="btn" id="exportBtn">Export backup</button>
        <button class="btn secondary" id="importBtn">Import backup</button>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
      </div>

      <div class="section-title">Danger zone</div>
      <div class="card">
        <button class="btn danger" id="clearBtn">Delete all workout data</button>
      </div>
    `;

    app.querySelectorAll("[data-unit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setSettings(Object.assign(getSettings(), { unit: btn.dataset.unit }));
        renderSettings();
      });
    });

    app.querySelectorAll("[data-edit-day]").forEach((btn) => {
      btn.addEventListener("click", () => { location.hash = "#/edit/" + btn.dataset.editDay + "/settings"; });
    });

    const resetBtn = document.getElementById("resetRoutineBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (!confirm("Reset all days to the default exercises? Your workout history stays saved.")) return;
        localStorage.removeItem(KEYS.schedule);
        toast("Routine reset");
        renderSettings();
      });
    }

    document.getElementById("exportBtn").addEventListener("click", exportData);
    const fileInput = document.getElementById("importFile");
    document.getElementById("importBtn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) importData(fileInput.files[0]);
      fileInput.value = "";
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
      if (!confirm("Delete ALL saved workouts on this device? This can't be undone.")) return;
      if (!confirm("Are you sure? Export a backup first if you might need it.")) return;
      localStorage.removeItem(KEYS.data);
      localStorage.removeItem(KEYS.drafts);
      toast("All data deleted");
      renderSettings();
    });
  }

  async function exportData() {
    const payload = {
      app: "workout-tracker",
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      schedule: load(KEYS.schedule, null),
      data: getData(),
    };
    const json = JSON.stringify(payload, null, 2);
    const name = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: "application/json" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Workout backup" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        alert("That file isn't valid JSON.");
        return;
      }
      const incoming = parsed && parsed.data && Array.isArray(parsed.data.sessions)
        ? parsed.data.sessions
        : null;
      if (!incoming) {
        alert("That file doesn't look like a workout backup.");
        return;
      }
      const valid = incoming.filter((s) => s && s.id && s.date && s.dayId && Array.isArray(s.entries));
      const data = getData();
      const existing = new Set(data.sessions.map((s) => s.id));
      const added = valid.filter((s) => !existing.has(s.id));
      data.sessions.push(...added);
      setData(data);

      const routine = parsed.schedule;
      const routineOk = Array.isArray(routine) && routine.length &&
        routine.every((d) => d && d.id && Array.isArray(d.exercises) &&
          d.exercises.every((ex) => ex && ex.id && ex.name && Array.isArray(ex.reps) && ex.reps.length));
      if (routineOk && confirm("Also restore the routine (exercise list) from this backup?")) {
        setSchedule(routine);
      }

      toast(`Imported ${added.length} workouts`);
      renderSettings();
    };
    reader.readAsText(file);
  }

  // ---------- Router ----------

  function route() {
    if (cleanupDay) { cleanupDay(); cleanupDay = null; }
    window.scrollTo(0, 0);
    const parts = (location.hash || "#/").slice(2).split("/");
    const [view, id, from] = parts;

    if (view === "day" && id) {
      sessionStorage.setItem("wt.lastDay", id);
      renderDay(id);
    } else if (view === "ex" && id) {
      renderExercise(decodeURIComponent(id));
    } else if (view === "edit" && id) {
      renderEdit(id, from);
    } else if (view === "settings") {
      renderSettings();
    } else {
      sessionStorage.removeItem("wt.lastDay");
      renderHome();
    }
  }

  // If icons/apple-touch-icon.png hasn't been generated, draw one so iOS still gets a proper home-screen icon.
  function ensureTouchIcon() {
    const link = document.querySelector('link[rel="apple-touch-icon"]');
    const probe = new Image();
    probe.onerror = () => {
      const size = 180;
      const s = size / 100;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#d4ff00";
      [[22, 46, 56, 8], [24, 28, 10, 44], [66, 28, 10, 44], [14, 36, 8, 28], [78, 36, 8, 28]]
        .forEach(([x, y, w, h]) => ctx.fillRect(x * s, y * s, w * s, h * s));
      link.href = canvas.toDataURL("image/png");
    };
    probe.src = link.getAttribute("href");
  }

  ensureTouchIcon();
  settingsBtn.addEventListener("click", () => { location.hash = "#/settings"; });
  window.addEventListener("hashchange", route);
  route();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
