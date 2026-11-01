// What makes the page behave like the desktop. Without it everything is still there: the panels one
// under the other, every picture shown at once, the commands to be selected by hand.
(() => {
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (name, attrs) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const f = n => n.toFixed(1);

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

  // a picture comes in softly once it has arrived, instead of appearing line by line
  const soften = img => {
    if (img.complete && img.naturalWidth) return;
    img.classList.add("arriving");
    const done = () => img.classList.remove("arriving");
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  };
  $$("main img").forEach(soften);

  // side menus: one page at a time, the next picture already here when it's asked for
  $$(".switcher").forEach(sw => {
    const nav = $(".nav", sw), pages = $$("[data-page]", sw);
    if (!nav) return;
    nav.hidden = false;
    const buttons = $$("button", nav);
    // pictures of the same desktop: one screen, its wallpaper still, only the panel changing
    let screen = null;
    const shots = $$(".stage img", sw);
    if (shots.length) {
      screen = document.createElement("div");
      screen.className = "screen";
      const base = new Image();
      base.src = "/shots/island-desktop.webp"; base.alt = ""; base.width = 1216; base.height = 760;
      screen.append(base);
      shots.forEach(img => { img.classList.add("shot"); img.dataset.of = img.closest("[data-page]").dataset.page; img.src = img.dataset.cut; img.loading = "eager"; screen.append(img); });
      $(".panes", sw).prepend(screen);
    }
    const open = id => {
      buttons.forEach(b => b.setAttribute("aria-selected", String(b.dataset.for === id)));
      pages.forEach(p => { p.hidden = p.dataset.page !== id; });
      if (screen) shots.forEach(img => img.classList.toggle("on", img.dataset.of === id));
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
    new IntersectionObserver((es, o) => {
      if (!es.some(e => e.isIntersecting)) return;
      o.disconnect();
      shots.forEach(img => { img.loading = "eager"; });
    }, { rootMargin: "600px 0px" }).observe(sw);
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
})();
