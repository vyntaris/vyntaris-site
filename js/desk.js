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
  $$("main img").filter(img => !img.closest(".stage")).forEach(soften);

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
      screen.className = "screen waiting";
      const base = new Image();
      base.src = "/shots/island-desktop.webp"; base.alt = ""; base.width = 1216; base.height = 760;
      screen.append(base);
      shots.forEach(img => { img.classList.add("shot"); img.dataset.of = img.closest("[data-page]").dataset.page; img.src = img.dataset.cut; img.loading = "eager"; screen.append(img); });
      $(".panes", sw).prepend(screen);
    }
    let wanted = null, entered = !screen;
    // a panel only ever moves once its picture is ready to draw
    const show = id => {
      const img = shots.find(i => i.dataset.of === id);
      const go = () => { if (wanted === id && entered) shots.forEach(i => i.classList.toggle("on", i === img)); };
      if (img) img.decode().then(go, go); else go();
    };
    const open = id => {
      wanted = id;
      buttons.forEach(b => b.setAttribute("aria-selected", String(b.dataset.for === id)));
      pages.forEach(p => { p.hidden = p.dataset.page !== id; });
      if (screen) show(id);
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
    if (screen) {
      // first the wallpaper; the panel comes out of the island once you're looking at it
      const base = screen.firstElementChild;
      const wallpaper = base.decode().catch(() => {});
      wallpaper.then(() => screen.classList.remove("waiting"));
      new IntersectionObserver((es, o) => {
        if (!es.some(e => e.isIntersecting)) return;
        o.disconnect();
        wallpaper.then(() => { entered = true; show(wanted); });
      }, { threshold: .45 }).observe(screen);
    }
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

  // the wiki: Contents follow where you are, closed on a phone; the search looks through every section
  const tocLinks = $$(".toc a");
  if (tocLinks.length) {
    const toc = $(".toc");
    if (matchMedia("(max-width: 860px)").matches) toc.open = false;
    tocLinks[0].setAttribute("aria-current", "");
    const here = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      tocLinks.forEach(a => {
        const on = a.hash === "#" + e.target.id;
        a.toggleAttribute("aria-current", on);
        if (on) { const side = $(".side"), r = a.getBoundingClientRect(), b = side.getBoundingClientRect(); if (r.top < b.top + 60 || r.bottom > b.bottom - 20) side.scrollTop += r.top - b.top - b.height / 2; }
      });
    }), { rootMargin: "-20% 0px -75% 0px" });
    tocLinks.forEach(a => { const s = document.getElementById(a.hash.slice(1)); if (s) here.observe(s); });

    const sections = $$(".doc h2, .doc h3").map(h => {
      const parts = [];
      for (let n = h.nextElementSibling; n && !/^H[23]$/.test(n.tagName); n = n.nextElementSibling) parts.push(n.textContent);
      return { id: h.id, title: h.textContent.replace(/^[\d.]+/, "").trim(), text: parts.join(" ").replace(/\s+/g, " ") };
    });
    const faq = $$(".doc details").map((d, i) => { d.id ||= "q" + (i + 1); return { id: d.id, title: $("summary", d).textContent, text: d.textContent.replace(/\s+/g, " "), details: d }; });
    const pool = [...faq, ...sections];
    const input = $("#wiki-search"), hits = $("#wiki-hits"), count = $("#wiki-count");
    let shown = [], picked = 0;
    const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const mark = (s, words) => words.reduce((out, w) => out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), m => `<mark>${m}</mark>`), esc(s));
    const go = hit => {
      if (hit.details) hit.details.open = true;
      input.value = ""; list();
      if (matchMedia("(max-width: 860px)").matches) toc.open = false;
      location.hash = hit.id;
    };
    function list() {
      const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const asking = words.length > 0;
      hits.hidden = !asking; toc.hidden = asking; count.hidden = !asking;
      if (!asking) return;
      shown = pool.filter(p => words.every(w => (p.title + " " + p.text).toLowerCase().includes(w)))
        .map(p => ({ ...p, score: words.filter(w => p.title.toLowerCase().includes(w)).length })).sort((a, b) => b.score - a.score).slice(0, 8);
      picked = Math.min(picked, Math.max(0, shown.length - 1));
      count.textContent = shown.length;
      if (!shown.length) { hits.innerHTML = "<p>No pages found</p>"; return; }
      hits.replaceChildren(...shown.map((p, i) => {
        const a = document.createElement("a");
        a.href = "#" + p.id;
        a.toggleAttribute("data-on", i === picked);
        const at = Math.max(0, p.text.toLowerCase().indexOf(words[0]) - 24);
        a.innerHTML = mark(p.title, words) + `<small>${mark(p.text.slice(at, at + 90), words)}</small>`;
        a.addEventListener("click", e => { e.preventDefault(); go(p); });
        return a;
      }));
    }
    input.addEventListener("input", () => { picked = 0; list(); });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { picked = (picked + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length; list(); } }
      else if (e.key === "Enter") { e.preventDefault(); if (shown[picked]) go(shown[picked]); }
      else if (e.key === "Escape") { input.value = ""; list(); }
    });
    const openHash = () => { const t = location.hash && document.getElementById(location.hash.slice(1)); if (t && t.tagName === "DETAILS") t.open = true; };
    addEventListener("hashchange", openHash); openHash();
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
