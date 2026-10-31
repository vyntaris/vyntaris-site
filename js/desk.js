// What makes the page behave like the desktop. Without it everything is still there: the panels'
// pages one under the other, the page dark and mauve, the commands to be selected by hand.
(() => {
  const root = document.documentElement, $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const svgEl = (name, attrs) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // the shell's own shape: the sides lean in as they come down (components/Slant.js)
  const lean = h => Math.min(h * 1.2, 26 + h * .05);
  const f = n => n.toFixed(1);
  function corners(pts, r) {
    let d = "";
    pts.forEach(([x, y, k], i) => {
      const [px, py] = pts[(i + pts.length - 1) % pts.length], [nx, ny] = pts[(i + 1) % pts.length];
      const dp = Math.hypot(px - x, py - y) || 1, dn = Math.hypot(nx - x, ny - y) || 1, c = Math.min(k ?? r, dp / 2, dn / 2);
      d += `${i ? "L" : "M"}${f(x + (px - x) / dp * c)} ${f(y + (py - y) / dp * c)}Q${f(x)} ${f(y)} ${f(x + (nx - x) / dn * c)} ${f(y + (ny - y) / dn * c)}`;
    });
    return d + "Z";
  }
  function shape(el) {
    const svg = svgEl("svg", { class: "shape", "aria-hidden": "true" }), path = svgEl("path", { class: "fill" });
    svg.append(path); el.prepend(svg);
    const draw = () => {
      const w = el.offsetWidth, h = el.offsetHeight, l = lean(h);
      path.setAttribute("d", corners([[0, -2, 0], [w, -2, 0], [w - l, h, 24], [l, h, 24]], 24));
      el.classList.add("shaped");
    };
    new ResizeObserver(draw).observe(el);
    draw();
  }
  $$(".hang").forEach(shape);

  // the bar's line, dipping under the island
  const bar = $(".bar"), island = $(".island");
  const edge = svgEl("svg", { class: "edge", "aria-hidden": "true" }), edgeFill = svgEl("path", { class: "fill" }), edgeLine = svgEl("path", { class: "line" });
  edge.append(edgeFill, edgeLine); bar.prepend(edge);
  const drawEdge = () => {
    const b = bar.getBoundingClientRect(), r = island.getBoundingClientRect(), y = b.height - .5, d = 11, s = 14;
    const a = r.left - b.left, z = r.right - b.left;
    const dip = `L${f(a - s)} ${y}Q${f(a - s / 2)} ${y} ${f(a)} ${y + d / 2}Q${f(a + s / 2)} ${y + d} ${f(a + s)} ${y + d}L${f(z - s)} ${y + d}Q${f(z - s / 2)} ${y + d} ${f(z)} ${y + d / 2}Q${f(z + s / 2)} ${y} ${f(z + s)} ${y}`;
    edgeLine.setAttribute("d", `M0 ${y}${dip}L${b.width} ${y}`);
    edgeFill.setAttribute("d", `M${f(a - s)} 0L${f(a - s)} ${y}${dip.slice(dip.indexOf("Q"))}L${f(z + s)} 0Z`);
    bar.classList.add("edged");
  };
  new ResizeObserver(drawEdge).observe(bar);
  document.fonts && document.fonts.ready.then(drawEdge);

  // the clock, the visitor's own
  const clock = $("#clock");
  const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const tick = () => {
    const d = new Date();
    clock.dateTime = d.toISOString();
    clock.textContent = `${fmt.format(d).replace(",", "")}  ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    setTimeout(tick, (60 - d.getSeconds()) * 1000);
  };
  tick();
  // light or dark, and the night light: real, on this page
  function scheme(v, keep) {
    root.dataset.scheme = v;
    if (keep) store.set("scheme", v);
  }
  const toggleLight = () => scheme(root.dataset.scheme === "light" ? "dark" : "light", true);
  const toggleNight = () => {
    const on = !("night" in root.dataset);
    root.toggleAttribute("data-night", on);
  };

  // side menus: one page at a time
  $$(".switcher").forEach(sw => {
    const nav = $(".nav", sw), pages = $$("[data-page]", sw);
    if (!nav) return;
    nav.hidden = false;
    const buttons = $$("button", nav);
    const open = id => {
      buttons.forEach(b => b.setAttribute("aria-selected", String(b.dataset.for === id)));
      pages.forEach(p => { p.hidden = p.dataset.page !== id; });
    };
    nav.addEventListener("click", e => { const b = e.target.closest("button"); if (b) open(b.dataset.for); });
    nav.addEventListener("keydown", e => {
      const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const i = buttons.indexOf(document.activeElement), b = buttons[(i + step + buttons.length) % buttons.length];
      b.focus(); open(b.dataset.for);
    });
    open(buttons[0].dataset.for);
  });

  // the copy buttons
  const status = $("#status");
  $$("[data-copy]").forEach(b => {
    b.hidden = false;
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("#" + b.dataset.copy).textContent); b.textContent = "Copied"; status.textContent = "Command copied"; }
      catch (e) { b.textContent = "Select it"; }
      setTimeout(() => { b.textContent = "Copy"; }, 2000);
    });
  });

  // the workspaces are the sections, and the title is the one you're in
  const links = $$(".ws a"), title = $(".title");
  const seen = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => {
      const here = a.hash === "#" + e.target.id;
      a.toggleAttribute("aria-current", here);
      if (here) title.textContent = a.title;
    });
  }), { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(a => { const s = $(a.hash); if (s) seen.observe(s); });

  // the wiki's side menu follows where you are
  const sideLinks = $$(".side a");
  if (sideLinks.length) {
    sideLinks[0].setAttribute("aria-current", "");
    const here = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      sideLinks.forEach(a => a.toggleAttribute("aria-current", a.hash === "#" + e.target.id));
    }), { rootMargin: "-20% 0px -75% 0px" });
    sideLinks.forEach(a => { const s = $(a.hash); if (s) here.observe(s); });
  }

  // the laptop: three.js and its scene loaded only as it comes near; without WebGL, its picture and labels
  const xp = $("#inside");
  if (xp) {
    const gl = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
    const still = () => {
      xp.classList.add("nogl");
      const lead = $(".xp-head .lead", xp);
      if (lead) lead.textContent = "Everything on the screen, and what runs under it.";
    };
    if (!gl) still();
    else {
      const load = src => new Promise((ok, no) => { const el = document.createElement("script"); el.src = src; el.onload = ok; el.onerror = no; document.head.append(el); });
      const near = new IntersectionObserver(es => {
        if (!es.some(e => e.isIntersecting)) return;
        near.disconnect();
        load("/js/three.min.js").then(() => load("/js/laptop.js")).catch(still);
      }, { rootMargin: "800px 0px" });
      near.observe(xp);
    }
  }

  // the launcher: as on the desktop, typing anywhere opens it and the first letter isn't lost
  const launcher = $("#launcher"), input = $("#search"), hits = $("#hits");
  const entries = [
    ...links.map(a => ({ name: a.title, kind: "Section", go: a.hash, words: a.title })),
    { name: "Download the ISO", kind: "About 1.6 GB", go: "https://dl.vyntarisos.com/vyntaris-x86_64.iso", words: "download iso install usb" },
    { name: "How to install", kind: "Wiki", go: "/wiki/#install", words: "install usb setup windows secure boot" },
    { name: "Questions", kind: "Wiki", go: "/wiki/#faq", words: "faq free nvidia games language" },
    { name: "When something's wrong", kind: "Wiki", go: "/wiki/#trouble", words: "problem trouble help black screen" },
    { name: "The first minutes", kind: "Wiki", go: "/wiki/#first", words: "keys shortcuts super" },
    { name: "Dr. Help", kind: "Wiki", go: "/wiki/#apps", words: "doctor health check" },
    { name: "Store", kind: "Wiki", go: "/wiki/#apps", words: "apps install aur" },
    { name: "Privacy policy", kind: "Page", go: "/policy/", words: "data google drive" },
    { name: "Terms of service", kind: "Page", go: "/tos/", words: "license legal" },
    { name: "All the numbers", kind: "Wiki", go: "/wiki/#numbers", words: "speed benchmark measured" },
    { name: "GitHub", kind: "Source code", go: "https://github.com/vyntaris/vyntaris", words: "git repository" },
    { name: "Light mode", kind: "Do it", run: toggleLight, words: "dark theme light" },
    { name: "Night light", kind: "Do it", run: toggleNight, words: "warm evening" },
  ];
  let shown = [], picked = 0;
  function close() {
    launcher.hidden = true;
    input.value = "";
    if (last && last.focus) last.focus();
  }
  function act(entry) {
    if (!entry) return;
    close();
    if (entry.run) entry.run();
    else location.href = entry.go;
  }
  function list() {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    shown = entries.filter(e => words.every(w => (e.name + " " + e.words).toLowerCase().includes(w))).slice(0, 9);
    picked = Math.min(picked, Math.max(0, shown.length - 1));
    hits.replaceChildren(...shown.map((e, i) => {
      const row = document.createElement("button");
      row.type = "button"; row.setAttribute("role", "option"); row.setAttribute("aria-selected", String(i === picked));
      const b = document.createElement("b"), s = document.createElement("small");
      b.textContent = e.name; s.textContent = e.kind;
      row.append(b, s);
      row.addEventListener("click", () => act(e));
      return row;
    }));
    if (!shown.length) { const n = document.createElement("p"); n.className = "nothing"; n.textContent = "No matches"; hits.append(n); }
  }
  let last = null;
  function open(text) {
    last = document.activeElement;
    launcher.hidden = false;
    input.value = text || "";
    picked = 0;
    list();
    input.focus();
  }
  island.addEventListener("click", () => (launcher.hidden ? open("") : close()));
  input.addEventListener("input", () => { picked = 0; list(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length) { picked = (picked + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length; list(); }
    } else if (e.key === "Enter") { e.preventDefault(); act(shown[picked]); }
  });
  addEventListener("keydown", e => {
    if (e.key === "Escape" && !launcher.hidden) { e.preventDefault(); close(); return; }
    if (!launcher.hidden || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.key === " ") return;
    const t = e.target;
    if (t.closest && t.closest("input, textarea, select, video, [contenteditable]")) return;
    e.preventDefault();
    open(e.key);
  });
  addEventListener("click", e => { if (!launcher.hidden && !launcher.contains(e.target) && !island.contains(e.target)) close(); });
  shape(launcher);

  // dark, as the system starts, until light is picked
  scheme(store.get("scheme") || "dark");
})();
