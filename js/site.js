// The home page's behaviour. All of it is extra: without this script the page reads the same, with the
// control center on the screen, the blue accent and the laptop as a still picture.
(() => {
"use strict";
const root = document.documentElement;
const light = matchMedia("(prefers-color-scheme: light)");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window: not remembered */ } },
};
// --- The accent: the system's (CSS AccentColor, where the browser has it), or one of the fourteen picked
function applyAccent() {
  const on = document.querySelector("#accent input:checked");
  if (on && on.value !== "system") {
    root.dataset.picked = "";
    root.style.setProperty("--accent", light.matches ? on.dataset.light : on.dataset.dark);
  } else {
    delete root.dataset.picked;
    root.style.removeProperty("--accent");
  }
  document.querySelectorAll("#accent label").forEach(l => {
    const i = document.getElementById(l.htmlFor);
    if (i.dataset.dark) l.style.setProperty("--c", light.matches ? i.dataset.light : i.dataset.dark);
  });
  // what the laptop listens for (js/laptop.js)
  dispatchEvent(new Event("vyntaris-accent"));
}
const accentSet = document.getElementById("accent");
if (accentSet) {
  const saved = store.get("accent"), pick = saved && document.getElementById("a-" + saved);
  if (pick) pick.checked = true;
  accentSet.addEventListener("change", e => { store.set("accent", e.target.value); applyAccent(); });
}

light.addEventListener("change", applyAccent);
applyAccent();

// --- The island: the panel picked opens on the screen, with a line on what it holds. On a wide screen the
// section holds the screen still while the page scrolls through the five in turn; a click scrolls to one
const notes = {
  control: "Wi-Fi, Bluetooth and the microphone as tiles, volume and brightness, the month and the weather where you are.",
  launcher: "Apps, settings, open windows and files as you type. Plain words work too: “volume 40”, “100 eur to rsd”.",
  nightlight: "Warmer colours in the evening: on now, or from sunset to sunrise, as warm as you like.",
  wallpapers: "Wallpapers in a row under the bar: ← and → to look, Enter to set. Vyntaris's own are drawn in your accent.",
  gamemode: "It starts with a game: notifications quiet, the performance profile on, the FPS and temperatures in the island.",
};
const index = document.querySelector(".index"), islandEl = document.getElementById("island");
const panelButtons = index ? [...index.querySelectorAll("button[data-panel]")] : [];
const pinned = matchMedia("(min-width: 900px)");
function showPanel(b) {
  if (b.getAttribute("aria-pressed") === "true") return;
  panelButtons.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  document.querySelectorAll(".stage img").forEach(img => { img.hidden = img.dataset.panel !== b.dataset.panel; });
  const note = document.getElementById("panel-note");
  if (note) note.textContent = notes[b.dataset.panel] || "";
}
// how far through the held stretch of the section the page is, 0 to 1
const through = () => {
  const r = islandEl.getBoundingClientRect(), run = r.height - innerHeight;
  return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
};
if (index) index.addEventListener("click", e => {
  const b = e.target.closest("button[data-panel]");
  if (!b) return;
  showPanel(b);
  if (pinned.matches && islandEl) {
    const i = panelButtons.indexOf(b), r = islandEl.getBoundingClientRect(), run = r.height - innerHeight;
    scrollTo({ top: scrollY + r.top + run * (i + 0.5) / panelButtons.length, behavior: still.matches ? "auto" : "smooth" });
  }
});
if (islandEl && panelButtons.length) addEventListener("scroll", () => {
  if (!pinned.matches) return;
  const i = Math.min(panelButtons.length - 1, Math.floor(through() * panelButtons.length));
  showPanel(panelButtons[i]);
}, { passive: true });

// --- One colour: the desktop worn in the accent picked (the system's shows Vyntaris's own blue)
const tinted = document.getElementById("tinted");
function tint() {
  if (!tinted) return;
  const on = document.querySelector("#accent input:checked");
  const name = on && on.value !== "system" ? on.value : "blue", src = `/shots/tint/${name}.webp`;
  if (tinted.getAttribute("src") === src) return;
  tinted.classList.add("loading");
  const next = new Image();
  next.onload = next.onerror = () => { tinted.src = src; tinted.classList.remove("loading"); };
  next.src = src;
}
if (accentSet) accentSet.addEventListener("change", tint);
tint();

// --- Safe updates: the boot side shows the step in the middle of the screen
const boot = document.querySelector(".boot");
if (boot && "IntersectionObserver" in window) {
  const steps = [...document.querySelectorAll(".updates .step")];
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    boot.dataset.state = e.target.dataset.state;
    steps.forEach(s => s.classList.toggle("on", s === e.target));
  }), { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach(s => io.observe(s));
  steps[0].classList.add("on");
}

// --- Copy the command
const status = document.getElementById("status");
document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => {
  const text = document.getElementById(b.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; status.textContent = "Command copied"; }
  catch (e) { b.textContent = "Select it"; }
  setTimeout(() => { b.textContent = "Copy"; }, 2000);
}));

// --- The laptop: three.js and its scene loaded only as it comes near; without WebGL, its picture and
// its labels as a list
const xp = document.getElementById("inside");
if (xp) {
  const gl = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
  const flat = () => {
    xp.classList.add("nogl");
    const lead = xp.querySelector(".xp-head .lead");
    if (lead) lead.textContent = "What you see on the screen, and what runs beneath it, layer by layer.";
  };
  if (!gl || !("IntersectionObserver" in window)) flat();
  else {
    const load = src => new Promise((ok, no) => { const el = document.createElement("script"); el.src = src; el.onload = ok; el.onerror = no; document.head.append(el); });
    const near = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      near.disconnect();
      load("/js/three.min.js").then(() => load("/js/laptop.js")).catch(flat);
    }, { rootMargin: "800px 0px" });
    near.observe(xp);
  }
}

// --- Where you are, in the island
if ("IntersectionObserver" in window) {
  const links = [...document.querySelectorAll(".nav a")];
  const seen = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.toggleAttribute("aria-current", a.hash === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(a => { const s = document.querySelector(a.hash); if (s) seen.observe(s); });

  // Each section's parts rise in as it arrives: heading, then text, then picture. Marked ready only here,
  // so without this script nothing is ever hidden
  if (!still.matches) {
    const parts = sec => sec.querySelectorAll(":scope h2, :scope .say, :scope .speed-head p, :scope .apps-head p, :scope .colour-say > p, :scope .accents, :scope .colour-screen, :scope .sheet, :scope .race, :scope .bento figure, :scope .answers > p, :scope .get-say > p, :scope .get-actions, :scope .needs li, :scope .boot");
    const rise = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      rise.unobserve(e.target);
      parts(e.target).forEach((el, i) => { el.style.transitionDelay = Math.min(i, 8) * 40 + "ms"; el.classList.add("risen"); });
    }), { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll("main section:not(.hero):not(.xp):not(.island)").forEach(sec => {
      const p = parts(sec);
      if (!p.length) return;
      const r = sec.getBoundingClientRect();
      if (r.top < innerHeight) return;           // already in view: left as it is
      p.forEach(el => el.classList.add("rise"));
      rise.observe(sec);
    });
  }
}
})();
