(function () {
  "use strict";

  const KEYS = {
    data: "wt.data",
    drafts: "wt.drafts",
    settings: "wt.settings",
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
    return SCHEDULE.find((d) => d.id === dayId);
  }

  function findExercise(exId) {
    for (const day of SCHEDULE) {
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
    const latest = sortedSessions()[0];
    if (!latest) return SCHEDULE[0].id;
    const idx = SCHEDULE.findIndex((d) => d.id === latest.dayId);
    return SCHEDULE[(idx + 1) % SCHEDULE.length].id;
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

  function renderHome() {
    setHeader("Workout", null);
    setBottomBar(null);
    const next = nextDayId();
    const drafts = getDrafts();

    app.innerHTML = SCHEDULE.map((day) => {
      const last = lastDoneDate(day.id);
      const isNext = day.id === next;
      return `
        <button class="card day-card ${isNext ? "next" : ""}" data-day="${day.id}">
          <div class="day-name">${esc(day.name)}
            ${isNext ? '<span class="badge">Next</span>' : ""}
            ${drafts[day.id] ? '<span class="badge draft">In progress</span>' : ""}
          </div>
          <div class="focus">${esc(day.focus)}</div>
          <div class="meta">
            <span>${day.exercises.length} exercises</span>
            <span>${last ? "Last: " + fmtDate(last) + " (" + daysAgo(last) + ")" : "Not done yet"}</span>
          </div>
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

  function setRowHtml(exId, i, set, unit) {
    return `
      <div class="set-row ${set.done ? "done" : ""}" data-ex="${exId}" data-i="${i}">
        <div class="set-num">${i + 1}</div>
        <label>
          <input type="number" inputmode="decimal" step="any" min="0" data-field="weight"
                 value="${set.weight === "" ? "" : esc(set.weight)}" placeholder="0" aria-label="Weight">
          <span>${unit}</span>
        </label>
        <label>
          <input type="number" inputmode="numeric" pattern="[0-9]*" min="0" data-field="reps"
                 value="${set.reps === "" ? "" : esc(set.reps)}" placeholder="0" aria-label="Reps">
          <span>reps</span>
        </label>
        <button class="check" data-action="toggle" aria-label="Mark set done">&#10003;</button>
      </div>`;
  }

  function renderDay(dayId) {
    const day = findDay(dayId);
    if (!day) { location.hash = "#/"; return; }
    const unit = getSettings().unit;
    const draft = getDraft(day);
    const hasSavedDraft = !!getDrafts()[day.id];

    setHeader(`${day.name} - ${day.focus}`, "#/");

    app.innerHTML = day.exercises.map((ex) => {
      const last = lastEntry(ex.id);
      const sets = draft.entries[ex.id].sets;
      return `
        <section class="card" data-exercise="${ex.id}">
          <div class="ex-head">
            <div>
              <h2 class="ex-name">${esc(ex.name)}</h2>
              <div class="ex-target">Target: ${ex.reps.join(" / ")}</div>
              ${ex.note ? `<div class="ex-note">${esc(ex.note)}</div>` : ""}
            </div>
            <button class="link-btn" data-history="${ex.id}">History</button>
          </div>
          <div class="ex-last">${last
            ? `Last (${fmtDate(last.date)}): <b>${esc(setsSummary(last.sets, unit))}</b>`
            : "No previous record"}</div>
          <div class="sets">${sets.map((s, i) => setRowHtml(ex.id, i, s, unit)).join("")}</div>
          <div class="set-actions">
            <button class="link-btn" data-action="add-set" data-ex="${ex.id}">+ Add set</button>
            <button class="link-btn" data-action="remove-set" data-ex="${ex.id}">- Remove set</button>
          </div>
        </section>`;
    }).join("") + `
      ${hasSavedDraft ? '<button class="btn danger" id="discardBtn">Discard this workout</button>' : ""}
    `;

    const bar = setBottomBar('<button class="btn" id="finishBtn">Finish workout</button>');
    bar.querySelector("#finishBtn").addEventListener("click", () => finishWorkout(day, draft));

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
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "toggle") {
        const row = btn.closest(".set-row");
        const set = draft.entries[row.dataset.ex].sets[Number(row.dataset.i)];
        set.done = !set.done;
        row.classList.toggle("done", set.done);
        persistDraft(draft);
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
      container.innerHTML = sets.map((s, i) => setRowHtml(exId, i, s, unit)).join("");
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

  // ---------- Exercise history ----------

  function renderExercise(exId) {
    const ex = findExercise(exId);
    if (!ex) { location.hash = "#/"; return; }
    const unit = getSettings().unit;
    const back = SCHEDULE.find((d) => d.exercises.some((e) => e.id === exId));
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

    if (!history.length) {
      app.innerHTML = `
        <div class="card">
          <div class="ex-target">Target: ${ex.reps.join(" / ")}</div>
          <div class="empty">No sessions logged yet.</div>
        </div>`;
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
          <div class="stat"><div class="label">Best set</div><div class="value">${fmtNum(best.weight)}${unit} x${best.reps}</div></div>
          <div class="stat"><div class="label">Last top weight</div><div class="value">${fmtNum(latestTop)}${unit}</div></div>
          <div class="stat"><div class="label">Est. 1 rep max</div><div class="value">${fmtNum(Math.round(bestE1rm * 10) / 10)}${unit}</div></div>
          <div class="stat"><div class="label">Sessions</div><div class="value">${history.length}</div></div>
        </div>
      </div>
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

    const pad = { l: 40, r: 12, t: 12, b: 26 };
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
    ctx.fillStyle = "#9aa3b2";
    ctx.strokeStyle = "#2c3140";
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

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelIdx = points.length <= 2 ? points.map((_, i) => i) : [0, points.length - 1];
    for (const i of labelIdx) {
      ctx.fillText(fmtDate(points[i].date), x(i), h - pad.b + 8);
    }

    ctx.strokeStyle = "#4f8cff";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.value)) : ctx.moveTo(x(i), y(p.value))));
    ctx.stroke();

    ctx.fillStyle = "#4f8cff";
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(p.value), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#9aa3b2";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(unit, 4, 2);
  }

  // ---------- Settings ----------

  function renderSettings() {
    const settings = getSettings();
    const data = getData();
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
    const [view, id] = parts;

    if (view === "day" && id) {
      sessionStorage.setItem("wt.lastDay", id);
      renderDay(id);
    } else if (view === "ex" && id) {
      renderExercise(decodeURIComponent(id));
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
      ctx.fillStyle = "#0f1115";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#4f8cff";
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
