// The accent picker (the page in the accent picked, remembered here) and the copy button. The page works
// without this: the accent stays blue, the command can be selected by hand.
(() => {
  const root = document.documentElement, light = matchMedia("(prefers-color-scheme: light)");
  const store = { get() { try { return localStorage.getItem("accent"); } catch (e) { return null; } },
                  set(v) { try { localStorage.setItem("accent", v); } catch (e) {} } };
  const apply = () => {
    const on = document.querySelector('#accent input:checked');
    // System: the stylesheet's own (the system's accent); one of the fourteen: that one, as dark or light
    if (on && on.value !== "system") {
      root.dataset.picked = "";
      root.style.setProperty("--accent", light.matches ? on.dataset.light : on.dataset.dark);
    } else {
      delete root.dataset.picked;
      root.style.removeProperty("--accent");
    }
    document.querySelectorAll('#accent label').forEach(l => {
      const i = document.getElementById(l.htmlFor);
      if (i.dataset.dark) l.style.setProperty("--c", light.matches ? i.dataset.light : i.dataset.dark);
    });
  };
  const saved = store.get(), pick = saved && document.getElementById("a-" + saved);
  if (pick) pick.checked = true;
  document.getElementById("accent").addEventListener("change", e => { store.set(e.target.value); apply(); });
  light.addEventListener("change", apply);
  apply();

  const status = document.getElementById("status");
  document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => {
    const text = document.getElementById(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; status.textContent = "Command copied"; }
    catch (e) { b.textContent = "Select it"; }
    setTimeout(() => { b.textContent = "Copy"; }, 2000);
  }));

  // the hero's island: the panel picked shown, the others hidden (without this, the control center alone)
  const picker = document.querySelector(".island-pick");
  if (picker) {
    picker.hidden = false;
    picker.addEventListener("click", e => {
      const b = e.target.closest("button[data-panel]");
      if (!b) return;
      picker.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      document.querySelectorAll(".stage-shot").forEach(img => { img.hidden = img.dataset.panel !== b.dataset.panel; });
    });
  }

  // the laptop: three.js and its scene loaded only as it comes near (with less motion asked for, it stands
  // still, open); without WebGL, its picture and its labels as a list instead
  const xp = document.getElementById("inside");
  if (xp) {
    const gl = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
    const still = () => {
      xp.classList.add("nogl");
      const lead = xp.querySelector(".xp-head .lead");
      if (lead) lead.textContent = "What you see on the screen, and what runs beneath it, layer by layer.";
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

  // the header's line dipping under the sections, as the bar's dips under the island: flat out to a
  // curve, down 11 px, along under the links, and back up the same way
  const top = document.querySelector(".top"), nav = top && top.querySelector(".nav");
  if (nav) {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    const fill = document.createElementNS(NS, "path"), line = document.createElementNS(NS, "path");
    svg.setAttribute("class", "edge"); svg.setAttribute("aria-hidden", "true");
    fill.setAttribute("class", "fill"); line.setAttribute("class", "line");
    svg.append(fill, line); top.append(svg);
    const draw = () => {
      if (getComputedStyle(nav).position !== "absolute") { svg.style.display = "none"; top.classList.remove("edged"); return; }
      svg.style.display = "";
      const t = top.getBoundingClientRect(), r = nav.getBoundingClientRect(), W = t.width;
      const c = 22, d = 11.5, y = 0.5;          // on the half pixel: a 1 px line drawn sharp
      const x2 = r.left - t.left, x3 = r.right - t.left, x1 = x2 - c, x4 = x3 + c;
      const notch = `C${x1 + c / 2} ${y} ${x2 - c / 2} ${d} ${x2} ${d}H${x3}C${x3 + c / 2} ${d} ${x4 - c / 2} ${y} ${x4} ${y}`;
      line.setAttribute("d", `M0 ${y}H${x1}${notch}H${W}`);
      fill.setAttribute("d", `M${x1} -1V${y}${notch}V-1Z`);
      svg.setAttribute("width", W); svg.setAttribute("height", d + 2);
      svg.setAttribute("viewBox", `0 -1 ${W} ${d + 2}`);
      top.classList.add("edged");
    };
    draw();
    addEventListener("resize", draw);
    document.fonts && document.fonts.ready.then(draw);
  }

  // where you are, in the header
  const links = [...document.querySelectorAll(".nav a")];
  const seen = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.toggleAttribute("aria-current", a.hash === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(a => { const s = document.querySelector(a.hash); if (s) seen.observe(s); });
})();
