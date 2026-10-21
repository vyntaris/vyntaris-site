// The laptop that comes apart (index.html's #inside), loaded only near it: see the page's loader.
// Take it apart, in WebGL: a laptop whose screen is the desktop's real screenshots, as textures at their
// full size (mipmapped, filtered for the angle), so they stay sharp however it turns. The section is tall
// and its view pinned; how far it has scrolled, followed smoothly, opens the lid and takes the laptop apart
// three times, the labels following what they speak of: the screen into its layers, the base into its parts
// (the keys, the board, the disk, Wi-Fi, the fans, the speakers, the battery), then the system's snapshots
// coming out of it, back in time. Then it comes up close. What happens on the screen (unlocking, each app
// opening) plays out in time, not with the scroll.
(() => {
const THREE = window.THREE;
const sec = document.getElementById("inside");
const fail = err => {
  console.error(err);
  sec.classList.remove("live");
  sec.classList.add("nogl");
  const say = sec.querySelector(".xp-status");
  if (say) say.textContent = "The 3D view couldn't start here: " + (err?.message || err);
};
if (sec) try {
  if (!THREE) throw new Error("three.js didn't load");
  main();
} catch (err) { fail(err); }

// A box rounded in plan (its corners, r), as tall as h: the deck, the lid, the keys
function RoundedBoxGeometry(w, h, d, _segments, r) {
  r = Math.min(r * 4, w / 2, d / 2);
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  g.computeVertexNormals();
  return g;
}

function main() {
  const pin = sec.querySelector(".xp-pin"), host = sec.querySelector(".xp-scene"), lines = sec.querySelector(".xp-lines");
  const head = sec.querySelector(".xp-head");
  const labels = [...sec.querySelectorAll(".xp-labels li")], caps = [...sec.querySelectorAll(".xp-cap div")];
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    if (!renderer.getContext()) throw new Error("no WebGL");
  } catch (e) {
    fail(e);
    return;
  }
  renderer.domElement.addEventListener("webglcontextlost", ev => { ev.preventDefault(); running = false; fail("the graphics card's context was lost"); });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const clamp = v => Math.min(1, Math.max(0, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const out = t => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // what the metal reflects: a light studio, bright above and dark below, with two soft lights
  {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d"), sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#f4f6ff"); sky.addColorStop(.45, "#8a8fa8"); sky.addColorStop(.55, "#3a3c4e"); sky.addColorStop(1, "#0c0c12");
    g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
    for (const [x, y, rad] of [[150, 60, 60], [380, 80, 45]]) {
      const l = g.createRadialGradient(x, y, 0, x, y, rad);
      l.addColorStop(0, "rgba(255,255,255,1)"); l.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = l; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.environment = pmrem.fromEquirectangular(t).texture;
    t.dispose();
  }
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 6, 5);
  scene.add(key, new THREE.HemisphereLight(0xc8d0ff, 0x101018, .5));

  // --- textures: sharp at any angle --------------------------------------------------------------------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const sharp = t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    return t;
  };
  // (a copy of the page may carry the pictures in itself, window.__xpImg: no request WebGL could refuse)
  const image = url => sharp(loader.load(window.__xpImg?.[url] || url, () => { dirty = true; }));
  const canvas = (w, h, draw) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    return sharp(new THREE.CanvasTexture(c));
  };
  // a rounded rectangle's shape as an alpha map (r: the corners' share of the width; top: round the top too)
  const rounded = (aspect, r, top = true) => {
    const t = canvas(512, Math.round(512 / aspect), (g, w, h) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff";
      const rr = r * w;
      g.beginPath();
      g.roundRect(0, 0, w, h, top ? rr : [0, 0, rr, rr]);
      g.fill();
    });
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };

  // --- the laptop ----------------------------------------------------------------------------------------
  // in its own units: 3.2 wide; the screen 16:9 inside a bezel; the base as deep as the lid is tall
  const W = 3.2, BZ = .06, SW = W - 2 * BZ, SH = SW * 9 / 16, LH = SH + 2 * BZ + .04, D = LH, GAP = .028, LT = .035;
  const laptop = new THREE.Group();
  scene.add(laptop);
  const body = new THREE.MeshStandardMaterial({ metalness: .65, roughness: .34 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15151d, metalness: .2, roughness: .75 });
  const padMat = new THREE.MeshStandardMaterial({ metalness: .5, roughness: .22 });
  // the deck's own: see-through while the base is apart, so what's under it shows
  const deckMat = new THREE.MeshStandardMaterial({ metalness: .65, roughness: .34 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x15151d, metalness: .2, roughness: .75 });
  const accentGlow = new THREE.MeshBasicMaterial({ toneMapped: false });
  const outlineMat = () => new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const outlines = [];
  const outline = (w, h, rot) => {
    const g = new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * w / 2, y * h / 2, 0)));
    const l = new THREE.LineLoop(g, outlineMat());
    if (rot) l.rotation.x = rot;
    outlines.push(l);
    return l;
  };

  // the base: the deck (keys and trackpad), the board, the case; each comes apart from the others
  const parts = {};
  const plate = (k, h, y, inset, top) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new RoundedBoxGeometry(W * inset, h, D * inset, 4, Math.min(.03, h * .45)), k === "board" ? dark : k === "deck" ? deckMat : body);
    m.position.y = -h / 2;
    g.add(m);
    if (top) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(W * inset * .97, D * inset * .96), top);
      t.rotation.x = -Math.PI / 2; t.position.y = .0012;
      g.add(t);
    }
    const o = outline(W * inset, D * inset, -Math.PI / 2);
    o.position.y = .002;
    g.add(o);
    g.position.y = y;
    g.userData = { y, h, inset };
    laptop.add(g);
    parts[k] = g;
    return g;
  };
  const boardTop = new THREE.MeshStandardMaterial({ metalness: .3, roughness: .55 });
  const caseTop = new THREE.MeshStandardMaterial({ metalness: .3, roughness: .6 });
  plate("case", .045, -.055, 1, caseTop);
  plate("board", .02, -.035, .96, boardTop);
  const deck = plate("deck", .035, 0, 1, null);
  // keys: five rows of fourteen, the bottom one ctrl, fn, SUPER, alt, space, alt, ctrl and the arrows
  {
    const span = W * .86, gap = .018, cols = 14, kw = (span - gap * (cols - 1)) / cols, kh = kw * .92;
    const keyGeo = new RoundedBoxGeometry(1, .02, 1, 2, .006);
    const rows = [[...Array(14)].map(() => 1), [...Array(14)].map(() => 1), [...Array(14)].map(() => 1), [...Array(14)].map(() => 1), [1, 1, 1, 1, 6, 1, 1, 1, 1]];
    const all = [];
    rows.forEach((row, r) => {
      let c = 0;
      row.forEach((n, i) => {
        all.push({ x: -span / 2 + c * (kw + gap) + (n * kw + (n - 1) * gap) / 2, z: -D / 2 + .16 + r * (kh + gap) + kh / 2, w: n * kw + (n - 1) * gap, super: r === 4 && i === 2 });
        c += n;
      });
    });
    const keys = new THREE.InstancedMesh(keyGeo, keyMat, all.length);
    const m = new THREE.Matrix4();
    all.forEach((k, i) => keys.setMatrixAt(i, m.compose(new THREE.Vector3(k.x, .01, k.z), new THREE.Quaternion(), new THREE.Vector3(k.w, 1, kh))));
    deck.add(keys);
    const s = all.find(k => k.super);
    const sk = new THREE.Mesh(keyGeo, accentGlow);
    sk.position.set(s.x, .0105, s.z); sk.scale.set(s.w, 1, kh);
    deck.add(sk);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(W * .36, .004, D * .27, 2, .002), padMat);
    pad.position.set(0, .001, D / 2 - .12 - D * .135);
    deck.add(pad);
  }

  // what's inside: on the board the disk, the Wi-Fi card and the fans; on the case the speakers and the
  // battery. Each rises from where it sits as the base comes apart; at: where its label points (its own units)
  const comps = {};
  const faces = [];
  const face = (w, d, draw) => {
    const m = new THREE.MeshStandardMaterial({ metalness: .25, roughness: .55 });
    faces.push([m, (a, light) => canvas(1024, Math.max(64, Math.round(1024 * d / w)), (g, cw, ch) => draw(g, cw, ch, a, light))]);
    return m;
  };
  const comp = (k, on, x, z, w, h, d, top, at, mat = dark) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(.01, h * .4)), mat);
    m.position.y = h / 2;
    g.add(m);
    if (top) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(w * .94, d * .9), top);
      t.rotation.x = -Math.PI / 2; t.position.y = h + .0012;
      g.add(t);
    }
    g.position.set(x, 0, z);
    g.userData = { at: new THREE.Vector3(...at), base: new THREE.Vector3(x, 0, z) };
    on.add(g);
    comps[k] = g;
    return g;
  };
  const label = (g, text, sub, a, light, x, y, size = 96) => {
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = a; g.font = `700 ${size}px "JetBrains Mono", monospace`; g.fillText(text, x, y);
    if (sub) { g.fillStyle = light ? "#4c4f69" : "#a6adc8"; g.font = `600 ${size * .55}px "JetBrains Mono", monospace`; g.fillText(sub, x, y + size * .95); }
  };
  comp("ssd", parts.board, .86, .3, .66, .014, .17, face(.66, .17, (g, w, h, a, light) => {
    g.fillStyle = "#1b1b26"; g.fillRect(0, 0, w, h);
    g.fillStyle = a; g.fillRect(0, 0, 18, h);
    for (let i = 0; i < 3; i++) { g.fillStyle = "#2b2c3c"; g.fillRect(w * .52 + i * w * .155, h * .18, w * .13, h * .64); }
    label(g, "NVMe", "Btrfs · zstd", a, false, w * .25, h * .38, 70);
  }), [.33, .014, 0]);
  comp("wifi", parts.board, -.92, .34, .26, .01, .2, face(.26, .2, (g, w, h, a) => {
    g.fillStyle = "#16261e"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#c9cdd8"; g.fillRect(w * .2, h * .22, w * .6, h * .36);
    label(g, "Wi-Fi 6E", "· Bluetooth ·", a, false, w / 2, h * .74, 70);
  }), [-.13, .01, .1]);
  // the fans: a housing and blades that turn while they're out
  const blades = [];
  for (const side of [-1, 1]) {
    const k = side < 0 ? "fanL" : "fans";
    const g = comp(k, parts.board, side * .78, -.43, .58, .03, .58, null, [side * .29, .03, -.1]);
    g.children[0].visible = false;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .03, 48, 1, true), dark);
    housing.position.y = .015;
    g.add(housing);
    const bladeMat = face(.54, .54, (c, w, h, a) => {
      c.clearRect(0, 0, w, h);
      c.translate(w / 2, h / 2);
      c.strokeStyle = a; c.lineWidth = 10; c.beginPath(); c.arc(0, 0, w * .48, 0, 7); c.stroke();
      c.fillStyle = "#3a3c52";
      for (let i = 0; i < 11; i++) {
        c.rotate(Math.PI * 2 / 11);
        c.beginPath(); c.moveTo(w * .08, 0); c.quadraticCurveTo(w * .3, -w * .12, w * .45, -w * .02); c.quadraticCurveTo(w * .3, w * .05, w * .08, w * .04); c.fill();
      }
      c.fillStyle = "#24253a"; c.beginPath(); c.arc(0, 0, w * .1, 0, 7); c.fill();
      c.fillStyle = a; c.beginPath(); c.arc(0, 0, w * .04, 0, 7); c.fill();
    });
    bladeMat.transparent = true;
    const b = new THREE.Mesh(new THREE.CircleGeometry(.265, 48), bladeMat);
    b.rotation.x = -Math.PI / 2; b.position.y = .02;
    g.add(b);
    blades.push(b);
  }
  const grille = (w, d) => face(w, d, (g, cw, ch) => {
    g.fillStyle = "#1b1b26"; g.fillRect(0, 0, cw, ch);
    g.fillStyle = "#4a4c62";
    for (let y = 20; y < ch - 10; y += 26) for (let x = 20; x < cw - 10; x += 26) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
  });
  for (const side of [-1, 1]) comp(side < 0 ? "spkL" : "speakers", parts.case, side * 1.36, .02, .2, .03, .95, grille(.2, .95), [side * .1, .03, -.3]);
  comp("battery", parts.case, 0, .36, 2.2, .03, .62, face(2.2, .62, (g, w, h, a, light) => {
    g.fillStyle = "#1d1e2c"; g.fillRect(0, 0, w, h);
    g.strokeStyle = a; g.lineWidth = 5;
    for (let i = 0; i < 4; i++) { g.fillStyle = "#26283a"; g.beginPath(); g.roundRect(30 + i * (w - 60) / 4 + 8, 30, (w - 60) / 4 - 16, h - 60, 18); g.fill(); g.stroke(); }
    label(g, "BATTERY", "charge limit 80 %", a, light, w / 2, h * .42, 64);
  }), [-1.1, .03, .2]);

  // the snapshots: the system as it was, copies coming out of it back in time
  const ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const ghostEdge = new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const ghosts = [1, 2, 3].map(i => {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, .1, D), ghostMat);
    slab.position.y = -.05;
    const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), ghostEdge);
    slabEdge.position.y = -.05;
    const hinge = new THREE.Group();
    hinge.position.set(0, 0, -D / 2);
    hinge.rotation.x = -THREE.MathUtils.degToRad(104);
    const lidBox = new THREE.BoxGeometry(W, LT, LH);
    const gl = new THREE.Mesh(lidBox, ghostMat), ge = new THREE.LineSegments(new THREE.EdgesGeometry(lidBox), ghostEdge);
    gl.position.set(0, GAP + LT / 2, LH / 2); ge.position.copy(gl.position);
    hinge.add(gl, ge);
    g.add(slab, slabEdge, hinge);
    g.userData = { i, top: new THREE.Vector3(0, GAP + LT, LH), hinge };
    g.visible = false;
    laptop.add(g);
    return g;
  });

  // the lid, hinged at the back of the deck: its body and the logo on its back; the screen on its face
  const lid = new THREE.Group();
  lid.position.set(0, 0, -D / 2);
  laptop.add(lid);
  const lidBody = new THREE.Mesh(new RoundedBoxGeometry(W, LT, LH, 4, LT * .45), body);
  lidBody.position.set(0, GAP + LT / 2, LH / 2);
  lid.add(lidBody);
  const logoMat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), logoMat);
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, GAP + LT + .0015, LH / 2);
  lid.add(logo);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(W - .03, LH - .03), new THREE.MeshStandardMaterial({ color: 0x07070b, metalness: .1, roughness: .35 }));
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, GAP - .0006, LH / 2);
  lid.add(bezel);
  // the screen: its local +z is out of the glass, +y up the lid
  const screen = new THREE.Group();
  screen.rotation.x = Math.PI / 2;
  screen.position.set(0, GAP - .0012, .04 + BZ + SH / 2 - .01);
  lid.add(screen);

  // a picture on the screen at its place in the 1920x1080 screenshot
  const shot = (url, [x, y, w, h], alpha, order) => {
    const mat = new THREE.MeshBasicMaterial({ map: image(url), transparent: true, toneMapped: false, alphaMap: alpha || null });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w / 1920 * SW, h / 1080 * SH), mat);
    m.position.set(((x + w / 2) / 1920 - .5) * SW, (.5 - (y + h / 2) / 1080) * SH, 0);
    m.renderOrder = order;
    return m;
  };
  const layers = {};
  const layer = (k, order, ...shots) => {
    const g = new THREE.Group();
    shots.forEach(s => g.add(s));
    g.add(outline(SW, SH));
    g.userData.order = order;
    screen.add(g);
    layers[k] = g;
  };
  const FULL = [0, 0, 1920, 1080];
  const win = rounded(948 / 1026, .012);
  layer("wall", 1, shot("/shots/xp-wall.webp", FULL, null, 1));
  layer("win", 2, shot("/shots/xp-term.webp", [8, 47, 948, 1026], win, 2), shot("/shots/xp-doc.webp", [965, 47, 948, 1026], win, 2));
  layer("bar", 3, shot("/shots/xp-bar.webp", [0, 0, 1920, 30], null, 3));
  layer("island", 4, shot("/shots/xp-island.webp", [719, 0, 483, 749], rounded(483 / 749, .062, false), 4));
  // what covers the layers: the lock screen as the lid opens, then the apps, each over the one before
  const lock = shot("/shots/xp-lock.webp", FULL, null, 10);
  screen.add(lock);
  const apps = ["doctor", "store", "office", "settings"].map((n, i) => {
    const m = shot(`/shots/xp-${n}.webp`, FULL, null, 11 + i);
    m.material.opacity = 0; m.visible = false;
    screen.add(m);
    return m;
  });
  // a soft shadow under it all
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.9, D * 1.9), new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    map: canvas(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, "rgba(0,0,0,.55)"); r.addColorStop(.55, "rgba(0,0,0,.25)"); r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }),
  }));
  shadow.rotation.x = -Math.PI / 2;
  laptop.add(shadow);

  // --- the colours, from the page's palette (light or dark, the accent) --------------------------------------
  const logoPath = document.querySelector(".brand svg path")?.getAttribute("d") || "";
  let accent = "";
  function paint() {
    const a = css("--accent") || "#89b4fa", light = css("color-scheme") === "light" || css("--crust").toLowerCase() === "#dce0e8";
    const sig = a + light;
    if (sig === accent) return;
    accent = sig;
    body.color.set(light ? 0xc9cdd8 : 0x3b3d52);
    deckMat.color.copy(body.color);
    padMat.color.set(light ? 0xb3b7c4 : 0x2f3145);
    accentGlow.color.set(a);
    outlines.forEach(l => l.material.color.set(a));
    ghostMat.color.set(a); ghostEdge.color.set(a);
    shadow.material.opacity = light ? .45 : .9;
    logoMat.map?.dispose();
    logoMat.map = canvas(512, 512, (g, w) => {
      g.translate(w * .14, w * .14); g.scale(w * .72 / 24, w * .72 / 24);
      g.shadowColor = a; g.shadowBlur = 14; g.fillStyle = a;
      g.fill(new Path2D(logoPath), "evenodd");
      g.shadowBlur = 0; g.fill(new Path2D(logoPath), "evenodd");
    });
    logoMat.needsUpdate = true;
    // the board: traces, and the chips of what runs underneath
    boardTop.map?.dispose();
    boardTop.map = canvas(2048, Math.round(2048 * D / W), (g, w, h) => {
      g.fillStyle = "#12121a"; g.fillRect(0, 0, w, h);
      g.strokeStyle = a; g.globalAlpha = .16; g.lineWidth = 3;
      for (let x = 40; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 40; y < h; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.globalAlpha = 1;
      const chips = [["linux", 520, 300, 1], ["systemd", 380, 170], ["pacman", 380, 170], ["PipeWire", 380, 170], ["NetworkManager", 520, 170], ["BlueZ", 300, 170], ["Mesa", 300, 170], ["fwupd", 300, 170]];
      let x = 150, y = 170, rowH = 0;
      g.textAlign = "center"; g.textBaseline = "middle";
      for (const [name, cw, ch, main] of chips) {
        if (x + cw > w - 150) { x = 150; y += rowH + 60; rowH = 0; }
        g.fillStyle = "#1e1e2e"; g.strokeStyle = a; g.lineWidth = main ? 6 : 4;
        g.beginPath(); g.roundRect(x, y, cw, ch, 18); g.fill(); g.stroke();
        g.fillStyle = main ? a : "#cdd6f4";
        g.font = `600 ${main ? 92 : 62}px "JetBrains Mono", monospace`;
        g.fillText(name, x + cw / 2, y + ch / 2);
        x += cw + 60; rowH = Math.max(rowH, ch);
      }
    });
    boardTop.needsUpdate = true;
    // the case: its screws and its name
    caseTop.map?.dispose();
    caseTop.map = canvas(2048, Math.round(2048 * D / W), (g, w, h) => {
      g.fillStyle = light ? "#b9bdca" : "#202131"; g.fillRect(0, 0, w, h);
      g.fillStyle = light ? "#8d91a0" : "#3a3c52";
      for (const [x, y] of [[90, 90], [w - 90, 90], [90, h - 90], [w - 90, h - 90], [w / 2, 90], [w / 2, h - 90]]) { g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill(); }
      g.fillStyle = light ? "#4c4f69" : "#6c7086"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `600 64px "JetBrains Mono", monospace`;
      g.fillText("V Y N T A R I S", w / 2, h / 2);
    });
    caseTop.needsUpdate = true;
    // the parts' faces
    for (const [m, draw] of faces) {
      m.map?.dispose();
      m.map = draw(a, light);
      m.needsUpdate = true;
    }
    dirty = true;
  }

  // --- labels: each points at a spot of its layer ---------------------------------------------------------
  // (a share of the layer's width and height from its top left; the base's parts: their front left corner)
  const point = { island: [.62, .3], bar: [.985, .014], win: [.985, .6], wall: [.995, .93] };
  const anchor = k => {
    if (point[k]) {
      const [fx, fy] = point[k];
      return layers[k].localToWorld(new THREE.Vector3((fx - .5) * SW, (.5 - fy) * SH, 0));
    }
    if (comps[k]) return comps[k].localToWorld(comps[k].userData.at.clone());
    if (/^g\d$/.test(k)) { const g = ghosts[+k[1] - 1]; return g.userData.hinge.localToWorld(new THREE.Vector3(0, GAP + LT, LH)); }
    // the snapshots' label: the nearest copy's front right; update-guard's: the laptop's own lid, top left
    if (k === "snap") return ghosts[0].localToWorld(new THREE.Vector3(W / 2, 0, D / 2));
    if (k === "guard") return lid.localToWorld(new THREE.Vector3(-W / 2, GAP + LT, LH));
    const g = parts[k];
    return g.localToWorld(new THREE.Vector3(-W * g.userData.inset * .47, .002, D * g.userData.inset * .45));
  };
  const ns = "http://www.w3.org/2000/svg";
  const marks = labels.map((li, i) => {
    li.style.setProperty("--i", i);
    const g = document.createElementNS(ns, "g"), path = document.createElementNS(ns, "path"), dot = document.createElementNS(ns, "circle");
    dot.setAttribute("r", "3"); g.append(path, dot); lines.appendChild(g);
    return { g, path, dot };
  });

  // --- what plays out in time: unlocking, each app opening ------------------------------------------------
  const tween = v => ({ v, from: v, to: v, start: 0 });
  const unlocked = tween(0), shown = apps.map(() => tween(0));
  const DUR = { unlock: 700, app: 650 };
  const aim = (t, to, now) => { if (t.to !== to) { t.from = t.v; t.to = to; t.start = now; } };
  const step = (t, now, dur) => {
    const k = still.matches ? 1 : clamp((now - t.start) / dur);
    t.v = lerp(t.from, t.to, out(k));
    return k < 1;
  };

  // --- sizes ----------------------------------------------------------------------------------------------
  let vw = 1, vh = 1, narrow = false, dirty = true, headBottom = 0, labelRoom = 0, pillRoom = 0, capRoom = 0;
  function size() {
    sec.classList.toggle("still", still.matches);
    vw = pin.clientWidth; vh = pin.clientHeight;
    narrow = vw < 1080;
    sec.classList.toggle("narrow", narrow);
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.fov = narrow ? 34 : 30;
    camera.updateProjectionMatrix();
    lines.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    // where the section's title ends: while it shows, the laptop keeps below it
    headBottom = head.offsetTop + head.offsetHeight + 16;
    // narrow: the room the label at the bottom takes (the tallest of them), kept free of the laptop
    // the apps' words at the bottom, up close: the room they take (the tallest), kept free of the laptop
    capRoom = Math.max(0, ...caps.map(c => c.offsetHeight)) + 28 + 20;
    // narrow: the snapshots' dates, stacked over their copies, take some room at the top
    const pill = labels.find(li => li.classList.contains("pill"));
    pillRoom = narrow && pill ? 3 * (pill.offsetHeight + 6) + 12 : 0;
    labelRoom = narrow ? Math.max(0, ...labels.filter(li => !li.classList.contains("pill")).map(li => li.offsetHeight)) + 32 : 0;
    dirty = true;
  }
  // how far the camera stands for a w-by-h box to take the share fw of the width and fh of the height
  const fit = (w, h, fw, fh) => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return Math.max(w / (2 * t * camera.aspect * fw), h / (2 * t * fh));
  };

  // --- each frame -----------------------------------------------------------------------------------------
  let p = still.matches ? .45 : 0, last = performance.now(), running = false;
  const target = () => {
    if (still.matches) return .45;
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    return clamp((top - sec.getBoundingClientRect().top) / Math.max(1, sec.offsetHeight - pin.offsetHeight));
  };
  const tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    try {
      draw(now);
    } catch (err) {
      running = false;
      fail(err);
    }
  }
  function draw(now) {
    const dt = Math.min(.1, (now - last) / 1000);
    last = now;
    const goal = target();
    const before = p;
    // followed smoothly: a wheel's steps become one motion
    p = still.matches ? goal : p + (goal - p) * (1 - Math.exp(-dt * 7));
    if (Math.abs(goal - p) < 1e-4) p = goal;
    const moving = p !== before;

    // open; apart three times (the screen, the base, the snapshots), each back together before the next;
    // up close, and which app (-1: none yet)
    const span = (a, up, b, down) => ease(clamp((p - a) / up)) * (1 - ease(clamp((p - b) / down)));
    const o = ease(clamp(p / .08));
    const eS = span(.11, .08, .30, .05), eB = span(.33, .08, .52, .05), eT = span(.55, .08, .72, .05);
    const e = Math.max(eS, eB, eT);
    const z = ease(clamp((p - .77) / .05));
    const app = p < .82 ? -1 : Math.min(apps.length - 1, Math.floor((p - .82) / .18 * apps.length));
    aim(unlocked, p >= .095 ? 1 : 0, now);
    shown.forEach((t, i) => aim(t, i <= app ? 1 : 0, now));
    let playing = step(unlocked, now, DUR.unlock) || eB > .01;
    shown.forEach(t => { playing = step(t, now, DUR.app) || playing; });
    if (!moving && !playing && !dirty) return;
    dirty = false;

    const headShown = 1 - clamp((p - .1) / .04);
    head.style.opacity = headShown;
    // the title's room at the top, while it shows: the view below it, the laptop fitted to what's left
    const room = Math.min(headBottom, vh * .55) * headShown + pillRoom * eT;
    const below = Math.max(Math.min(labelRoom, vh * .45) * Math.max(eS, eB, eT), Math.min(capRoom, vh * .45) * z);
    lid.rotation.x = -THREE.MathUtils.degToRad(lerp(0, 104, o));
    // the layers apart along the screen's depth; the base's parts up and down
    const spread = { wall: 0, win: .36, bar: .62, island: .88 };
    for (const k in spread) layers[k].position.z = .0008 * layers[k].userData.order + spread[k] * eS;
    parts.deck.position.set(0, parts.deck.userData.y + 1.05 * eB, .25 * eB);
    // the lid goes up with the deck it's hinged to: nothing passes through the screen
    lid.position.set(0, 1.05 * eB, -D / 2 + .25 * eB);
    parts.board.position.y = parts.board.userData.y - .1 * eB;
    parts.case.position.y = parts.case.userData.y - .8 * eB;
    shadow.position.y = parts.case.position.y - .05;
    // the parts rise from where they sit; the speakers out to the sides; the fans turn
    for (const m of [deckMat, keyMat, padMat]) {
      m.transparent = eB > .001;
      m.opacity = 1 - .68 * eB;
      m.depthWrite = eB < .5;
    }
    const rise = { ssd: .48, wifi: .44, fans: .58, fanL: .58, speakers: .36, spkL: .36, battery: .36 };
    for (const k in rise) {
      const g = comps[k], b = g.userData.base;
      g.position.set(b.x + (k === "speakers" ? .5 : k === "spkL" ? -.5 : 0) * eB, rise[k] * eB, b.z);
    }
    blades.forEach((b, i) => { b.rotation.z += dt * (i ? 5 : -5) * eB; });
    for (const k in layers) layers[k].children.find(c => c.isLineLoop).material.opacity = eS * .75;
    for (const k in parts) parts[k].children.find(c => c.isLineLoop).material.opacity = eB * .75;
    // the snapshots out of the laptop, each further back in time, fainter
    ghosts.forEach(g => {
      const i = g.userData.i;
      g.visible = eT > .01;
      g.position.set(-1.45 * i * eT, .06 * i * eT, -1.3 * i * eT);
    });
    ghostMat.opacity = .14 * eT; ghostEdge.opacity = .6 * eT;
    // unlocking: the lock screen fades as the desktop's layers settle in from a little smaller
    lock.material.opacity = 1 - unlocked.v;
    lock.visible = unlocked.v < 1;
    lock.position.z = .012;
    for (const k of ["win", "bar", "island"]) layers[k].scale.setScalar(lerp(.94, 1, unlocked.v));
    // each app opening over the one before: in from a little smaller and lower
    apps.forEach((m, i) => {
      const v = shown[i].v, covered = i < app && shown[i + 1].v >= 1;
      m.visible = v > 0 && !covered;
      m.material.opacity = v;
      m.scale.setScalar(.9 + .1 * v);
      m.position.y = -.08 * (1 - v);
      m.position.z = .016 + .002 * i;
    });
    caps.forEach((c, i) => c.classList.toggle("on", i === app));

    // the camera: from above, turning to the side as it comes apart, then in front, close
    const el = lerp(lerp(44, 16, o) + 10 * eS + 14 * eB + 4 * eT, 4, z), az = (lerp(-8, 0, o) + 34 * eS + 24 * eB + 30 * eT) * (1 - z);
    laptop.updateMatrixWorld(true);
    const screenAt = screen.getWorldPosition(tmp.set(0, 0, 0)).clone();
    tgt.set((narrow ? -.12 : -.42) * eS - .1 * eB - 2.1 * eT, lerp(0, LH * .4, o) - .22 * eS + .42 * eB + .1 * eT, lerp(.2, 0, o) + .1 * eB - 1.7 * eT);
    tgt.lerp(screenAt.add(new THREE.Vector3(0, -.12, 0)), z);
    const far = fit(W * (1 + .35 * eS + .3 * eB + 1.25 * eT), lerp(D * .9, LH * 1.35, o) + .7 * eS + 2.1 * eB + .4 * eT, narrow ? .9 : .4, (narrow ? .74 : .66) * (vh - room - below) / vh);
    const near = fit(W * 1.12, LH * 1.4, narrow ? .9 : .5, .86 * (vh - Math.min(capRoom, vh * .45)) / vh);
    const dist = lerp(far, near, z);
    const elr = THREE.MathUtils.degToRad(el), azr = THREE.MathUtils.degToRad(az);
    camera.position.set(tgt.x + dist * Math.cos(elr) * Math.sin(azr), tgt.y + dist * Math.sin(elr), tgt.z + dist * Math.cos(elr) * Math.cos(azr));
    camera.lookAt(tgt);
    if (room > 1 || below > 1) camera.setViewOffset(vw, vh, 0, (below - room) / 2, vw, vh); else camera.clearViewOffset();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    // drawn: the laptop takes the picture's place (and the fallback's, had it come first)
    if (!window.__xpReady) { window.__xpReady = true; sec.classList.remove("nogl"); sec.classList.add("live"); }
    place(p, { s: eS, b: eB, t: eT });
  }

  // the labels of the part taken apart: beside what they speak of (wide), or one at a time at the bottom
  // with it outlined (narrow); a snapshot's date as a pill on it
  const WINDOW = { s: [.19, .30], b: [.41, .52], t: [.63, .72] };
  function place(p, ph) {
    const active = ["s", "b", "t"].find(k => ph[k] > .9) || null;
    const group = labels.filter(li => li.dataset.phase === active);
    const cards = group.filter(li => !li.classList.contains("pill"));
    const [w0, w1] = WINDOW[active] || [0, 1];
    const stepNo = Math.min(cards.length - 1, Math.floor(clamp((p - w0) / (w1 - w0)) * cards.length));
    labels.forEach((li, i) => {
      if (li.dataset.phase !== active) { li.classList.remove("on"); marks[i].g.classList.remove("on"); }
    });
    if (!active) return;
    const spots = group.map(li => {
      const v = anchor(li.dataset.k).project(camera);
      return { li, k: li.dataset.k, x: (v.x + 1) / 2 * vw, y: (1 - v.y) / 2 * vh, side: li.dataset.side, pill: li.classList.contains("pill") };
    });
    if (!narrow) {
      for (const side of ["r", "l"]) {
        const col = spots.filter(s => !s.pill && s.side === side).sort((a, b) => a.y - b.y);
        if (!col.length) continue;
        let end = -Infinity;
        for (const s of col) { s.ly = Math.max(s.y - 40, end + 12, 16); end = s.ly + s.li.offsetHeight; }
        const over = end - (vh - 16);
        if (over > 0) col.forEach(s => s.ly -= over);
        const xs = col.map(s => s.x);
        const lx = side === "r" ? Math.min(vw - 266, Math.max(...xs) + 56) : Math.max(16, Math.min(...xs) - 56 - 250);
        col.forEach(s => s.lx = lx);
      }
    }
    // the snapshots' dates over their copies, moved apart where they'd overlap, and kept on the screen
    const pills = spots.filter(s => s.pill).sort((a, b) => b.y - a.y);
    let floor = Infinity;
    for (const s of pills) {
      const h = s.li.offsetHeight, w = s.li.offsetWidth;
      s.py = Math.min(s.y - h - 12, floor - h - 6);
      s.px = Math.max(8, Math.min(vw - w - 8, s.x - w / 2));
      floor = s.py;
    }
    // the highest one on the screen still: the stack comes down as a whole
    const top = pills.length ? Math.min(...pills.map(s => s.py)) : 0;
    if (top < 8) pills.forEach(s => s.py += 8 - top);
    spots.forEach(s => {
      const i = labels.indexOf(s.li), m = marks[i];
      if (s.pill) {
        s.li.classList.add("on");
        s.li.style.transform = `translate(${s.px}px, ${s.py}px)`;
        return;
      }
      const lit = narrow ? cards.indexOf(s.li) === stepNo : true;
      s.li.classList.toggle("on", lit);
      m.g.classList.toggle("on", !narrow && lit);
      if (!narrow) {
        s.li.style.transform = `translate(${s.lx}px, ${s.ly}px)`;
        const ex = s.side === "r" ? s.lx : s.lx + 250, ey = s.ly + 22;
        m.path.setAttribute("d", `M${s.x},${s.y} L${(s.x + ex) / 2},${ey} L${ex},${ey}`);
        m.dot.setAttribute("cx", s.x); m.dot.setAttribute("cy", s.y);
      } else {
        s.li.style.transform = "";
      }
    });
    // narrow: what the label speaks of, outlined brighter
    if (narrow) {
      const k = cards[stepNo]?.dataset.k;
      for (const [n, g] of Object.entries(active === "s" ? layers : active === "b" ? parts : {})) {
        const l = g.children.find(c => c.isLineLoop);
        if (l) l.material.opacity = n === k ? 1 : .35;
      }
    }
  }

  // runs only while the section is on the screen
  const go = () => { if (!running) { running = true; last = performance.now(); dirty = true; requestAnimationFrame(frame); } };
  new IntersectionObserver(([en]) => { if (en.isIntersecting) go(); else running = false; }).observe(sec);
  addEventListener("resize", size);
  still.addEventListener("change", () => { size(); dirty = true; });
  const themed = () => { paint(); dirty = true; };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themed);
  addEventListener("vyntaris-accent", themed);
  new MutationObserver(themed).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  size();
  paint();
  // the chips' and the case's words wait for the font
  document.fonts?.load('600 64px "JetBrains Mono"').then(() => { accent = ""; paint(); });
}
})();
