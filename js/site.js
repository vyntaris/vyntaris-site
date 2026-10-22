// The home page's behaviour. All of it is extra: without this script the page reads the same, with the
// control center on the screen, the blue accent, the Store's tab and the laptop as a still picture.
(() => {
"use strict";
const root = document.documentElement;
const light = matchMedia("(prefers-color-scheme: light)");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window: not remembered */ } },
};
const flavour = () => light.matches
  ? { crust: "#dce0e8", mantle: "#e6e9ef", base: "#eff1f5", text: "#4c4f69", dark: false }
  : { crust: "#11111b", mantle: "#181825", base: "#1e1e2e", text: "#cdd6f4", dark: true };

// --- The accent: the system's (CSS AccentColor, where the browser has it), or one of the fourteen picked.
// Whatever it is comes back as rgb() from an element painted in it, which is what the wallpaper draws with
const probe = document.createElement("span");
probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;color:var(--accent)";
document.body.append(probe);
const accentNow = () => getComputedStyle(probe).color || "rgb(137, 180, 250)";
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
  // what the laptop listens for (js/laptop.js), and the wallpaper
  dispatchEvent(new Event("vyntaris-accent"));
  wallpaper.paint();
}
const accentSet = document.getElementById("accent");
if (accentSet) {
  const saved = store.get("accent"), pick = saved && document.getElementById("a-" + saved);
  if (pick) pick.checked = true;
  accentSet.addEventListener("change", e => { store.set("accent", e.target.value); applyAccent(); });
}

// --- The wallpaper on the screen: Vyntaris's own Terrain (WallpaperArt.js in the desktop), the contour lines
// of a land that isn't anywhere, every fifth in the accent. Its lines are worked out once; a new accent
// only draws them again in its colour
const wallpaper = (() => {
  const canvas = document.querySelector(".stage .wall");
  if (!canvas || !canvas.getContext) return { paint() {} };
  const g = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, levels = 40;
  let lines = null;

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function build() {
    const r = rng(20261021), lattice = [];
    for (let i = 0; i < 4096; i++) lattice.push(r());
    const at = (ix, iy) => lattice[((ix * 73856093) ^ (iy * 19349663)) & 4095];
    const noise = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = at(ix, iy), b = at(ix + 1, iy), d = at(ix, iy + 1), e = at(ix + 1, iy + 1);
      return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
    };
    const layers = (x, y, n) => {
      let sum = 0, amp = 1, norm = 0;
      for (let k = 0; k < n; k++) { sum += amp * noise(x, y); norm += amp; amp *= 0.42; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; }
      return sum / norm;
    };
    const land = (x, y) => {
      const qx = layers(x * 0.8 + 3.2, y * 0.8 + 1.7, 2), qy = layers(x * 0.8 + 8.4, y * 0.8 + 5.3, 2);
      return layers(x * 0.95 + 1.1 * qx, y * 0.95 + 1.1 * qy, 4);
    };
    const cell = 7, cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1, z = [];
    let lo = 1, hi = 0;
    for (let y = 0; y < rows; y++) {
      const row = new Float32Array(cols);
      for (let x = 0; x < cols; x++) { const v = land(x * cell / H, y * cell / H); row[x] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
      z.push(row);
    }
    const paths = Array.from({ length: levels }, () => new Path2D());
    const cross = (ax, ay, za, bx, by, zb, t) => { const k = (t - za) / (zb - za); return [ax + (bx - ax) * k, ay + (by - ay) * k]; };
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const a = (z[y][x] - lo) / (hi - lo), b = (z[y][x + 1] - lo) / (hi - lo);
        const e = (z[y + 1][x + 1] - lo) / (hi - lo), d = (z[y + 1][x] - lo) / (hi - lo);
        const mn = Math.min(a, b, e, d), mx = Math.max(a, b, e, d);
        const x0 = x * cell, y0 = y * cell, x1 = x0 + cell, y1 = y0 + cell;
        for (let l = Math.ceil(mn * levels); l <= Math.floor(mx * levels) && l < levels; l++) {
          const t = l / levels;
          if (t <= mn || t >= mx) continue;
          const p = [];
          if ((a < t) !== (b < t)) p.push(cross(x0, y0, a, x1, y0, b, t));
          if ((b < t) !== (e < t)) p.push(cross(x1, y0, b, x1, y1, e, t));
          if ((e < t) !== (d < t)) p.push(cross(x1, y1, e, x0, y1, d, t));
          if ((d < t) !== (a < t)) p.push(cross(x0, y1, d, x0, y0, a, t));
          const seg = (u, v) => { paths[l].moveTo(u[0], u[1]); paths[l].lineTo(v[0], v[1]); };
          if (p.length === 2) seg(p[0], p[1]);
          else if (p.length === 4) {
            const centre = (a + b + e + d) / 4;
            if ((centre < t) === (a < t)) { seg(p[0], p[1]); seg(p[2], p[3]); } else { seg(p[0], p[3]); seg(p[1], p[2]); }
          }
        }
      }
    }
    lines = paths;
  }
  function mix(c1, c2, k) {
    const p = s => s.startsWith("#") ? [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)) : s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const a = p(c1), b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
  }
  function paint() {
    if (!lines) return;
    // the screen is the desktop's, dark as in its pictures, whatever the page's own scheme
    const c = { crust: "#11111b", mantle: "#181825", base: "#1e1e2e", text: "#cdd6f4", dark: true };
    // the accent as the dark desktop has it: the one picked in its dark form, or the system's
    const on = document.querySelector("#accent input:checked");
    const accent = on && on.dataset.dark ? on.dataset.dark : (light.matches ? accentNow() : accentNow()), dark = true;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, mix(c.base, accent, dark ? 0.04 : 0.03));
    bg.addColorStop(0.55, c.mantle);
    bg.addColorStop(1, dark ? c.crust : c.mantle);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = (x, y, r, col, o) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, mix(c.mantle, col, o)); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 1; g.fillStyle = rg; g.fillRect(0, 0, W, H);
    };
    glow(0.27 * W, 0.32 * H, 0.5 * H, accent, dark ? 0.12 : 0.08);
    g.lineCap = "round";
    g.strokeStyle = mix(c.text, accent, 0.45); g.lineWidth = 0.9;
    for (let l = 1; l < levels; l++) {
      if (l % 5 === 0) continue;
      g.globalAlpha = (dark ? 0.1 : 0.14) + 0.14 * l / levels; g.stroke(lines[l]);
    }
    g.strokeStyle = accent; g.lineWidth = 1.6;
    for (let l = 5; l < levels; l += 5) { g.globalAlpha = (dark ? 0.5 : 0.6) + 0.4 * l / levels; g.stroke(lines[l]); }
    g.globalAlpha = 1;
    canvas.closest(".stage").classList.add("drawn");
  }
  const start = () => { build(); paint(); };
  ("requestIdleCallback" in window) ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 200);
  return { paint };
})();
light.addEventListener("change", applyAccent);
applyAccent();

// --- The island: the panel picked opens on the screen, with a line on what it holds
const notes = {
  control: "Wi-Fi, Bluetooth and the microphone as tiles, volume and brightness, the month and the weather where you are.",
  launcher: "Apps, settings, open windows and files as you type. Plain words work too: “volume 40”, “100 eur to rsd”.",
  sound: "Speakers, headphones, HDMI and Bluetooth in one list, and noise suppression for the microphone.",
  wallpapers: "Wallpapers in a row under the bar: ← and → to look, Enter to set. Vyntaris's own are drawn in your accent.",
  gamemode: "It starts with a game: notifications quiet, the performance profile on, the FPS and temperatures in the island.",
};
const index = document.querySelector(".index");
if (index) index.addEventListener("click", e => {
  const b = e.target.closest("button[data-panel]");
  if (!b) return;
  index.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  document.querySelectorAll(".stage .panel").forEach(img => { img.hidden = img.dataset.panel !== b.dataset.panel; });
  const note = document.getElementById("panel-note");
  if (note) note.textContent = notes[b.dataset.panel] || "";
});

// --- The apps: tabs, the arrow keys moving between them
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function showApp(tab, focus) {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  document.querySelectorAll(".plate img").forEach(img => { img.hidden = img.dataset.app !== tab.dataset.app; });
  if (focus) tab.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => showApp(t));
  t.addEventListener("keydown", e => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (d) { e.preventDefault(); showApp(tabs[(i + d + tabs.length) % tabs.length], true); }
  });
});

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

// --- The name across the screen's lower edge: where it lies over the screen, its letters in the screen's
// own light ink (a light page would otherwise put dark letters on the dark screen)
const nameOn = document.querySelector(".name-on"), stageEl = document.getElementById("stage");
function clipName() {
  if (!nameOn || !stageEl) return;
  const n = nameOn.parentElement.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
  const right = Math.max(0, n.right - s.right), bottom = Math.max(0, n.bottom - s.bottom);
  const left = Math.max(0, s.left - n.left), top = Math.max(0, s.top - n.top);
  nameOn.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
}
addEventListener("resize", clipName);
addEventListener("scroll", clipName, { passive: true });
document.fonts?.ready.then(clipName);
clipName();

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
    const parts = sec => sec.querySelectorAll(":scope h2, :scope .say, :scope > p, :scope .index, :scope .accents, :scope .sheet, :scope .mosaic > *, :scope .plate, :scope .tabs, :scope .app-copy, :scope .cells, :scope .answers > p, :scope .get-actions, :scope .boot");
    const rise = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      rise.unobserve(e.target);
      parts(e.target).forEach((el, i) => { el.style.transitionDelay = Math.min(i, 8) * 40 + "ms"; el.classList.add("risen"); });
    }), { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll("main section:not(.hero):not(.xp)").forEach(sec => {
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
