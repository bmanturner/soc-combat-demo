// 3D board rendering and animation (three.js). Reads the store; never changes rules state.
// Draws the same view model and choreography as the 2D board; only presentation differs.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Vec } from '../rules/geometry';
import type { BattleState, GameEvent, UnitState } from '../rules/types';
import { controller, registerAnimator, unregisterAnimator, type Animator } from '../game/controller';
import { registerBoardProjector, unregisterBoardProjector } from '../game/board-anchor';
import { TOUCH_UI_QUERY, store, type GameStore } from '../game/store';
import { choreograph, type Ease, type Stage } from '../board/choreography';
import { COLORS } from '../board/palette';
import { boardView, boardViewChanged, unitCenter, type FillLayer, type LineLayer, type Pt } from '../board/view-model';
import { GroundShape, PAWN_HEIGHT, PX, applyOpacity, makeToken, overlayMaterial, paintToken, platePainted, sizePlate, type Token3D } from './meshes';
import { DRESSING, assetsReady, boardAssets, boardTexture, dressingReady, fittedProp, loadAssets, type Dressing } from './models';
import { makeProjectile } from './projectiles';
import type { Projectile } from './rig';
import { EASE, TweenClock, yoyo } from './tweens';

/** Reserved annotation lane above the board, as on the 2D board. */
const LANE = 140;
const UI_FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
const LAYER_HEIGHT: Record<FillLayer | LineLayer, number> = { zone: 0.012, telegraph: 0.016, overlay: 0.02, links: 0.024 };
const LAYER_ORDER: Record<FillLayer | LineLayer, number> = { zone: 1, telegraph: 2, overlay: 3, links: 4 };
/** Default camera direction: from the south (toward smaller y is "up"), 35° off vertical so pawns clear the walls. */
const HOME_DIRECTION = new THREE.Vector3(0, Math.cos((35 * Math.PI) / 180), Math.sin((35 * Math.PI) / 180));
const CLICK_SLOP = 5;
const TOUCH_SLOP = 10; // fingers jitter more than a mouse; still well under an orbit drag
const SUN = 2.1;
const SKY = 1.15;
/** Brazier flame: warm point light and additive glow, flickering per tile. */
const BRAZIER = { color: '#ff9a4a', intensity: 6, distance: 4.5, glow: 0.32 } as const;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

interface Flame {
  light: THREE.PointLight;
  glow: THREE.Sprite;
  seed: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LabelPlacement {
  el: HTMLElement;
  anchor: Pt;
  /** Leader to the anchor; only shown for labels that fell back to the top lane. */
  line: SVGLineElement;
  w: number;
  h: number;
  /** Last chosen candidate slot (-1 = lane), kept for frame-to-frame stability. */
  cand: number;
  transform: string;
}

/** Candidate sides around an anchor, nearest-preferred order: below, right, left, then diagonals and above. */
const LABEL_DIRS: [number, number][] = [[0, 1], [1, 0], [-1, 0], [1, 1], [-1, 1], [0, -1], [1, -1], [-1, -1]];

function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return a.x < b.x + b.w + margin && a.x + a.w + margin > b.x && a.y < b.y + b.h + margin && a.y + a.h + margin > b.y;
}

/** Fraction along p→q (0..1) at which the segment first enters any rectangle; 1 when it enters none. */
function firstEntry(p: { x: number; y: number }, q: { x: number; y: number }, rects: Rect[]): number {
  let best = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  for (const r of rects) {
    let t0 = 0;
    let t1 = 1;
    const clip = (d: number, lo: number, hi: number, origin: number): boolean => {
      if (d === 0) return origin >= lo && origin <= hi;
      let a = (lo - origin) / d;
      let b = (hi - origin) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      return t0 <= t1;
    };
    if (clip(dx, r.x - 2, r.x + r.w + 2, p.x) && clip(dy, r.y - 2, r.y + r.h + 2, p.y)) best = Math.min(best, t0);
  }
  return best;
}

interface FloatText {
  el: HTMLElement;
  at: THREE.Vector3;
  rise: number;
}

export class ThreeBoard implements Animator, Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  private readonly controls: OrbitControls;
  private readonly sun = new THREE.DirectionalLight('#ffe2b8', SUN);
  private readonly sky = new THREE.HemisphereLight('#c9b79a', '#1a120c', SKY);
  private readonly mapGroup = new THREE.Group();
  private readonly overlayGroup = new THREE.Group();
  private readonly fxGroup = new THREE.Group();
  private readonly tokenGroup = new THREE.Group();
  private readonly labelLayer: HTMLDivElement;
  private readonly leaders: SVGSVGElement;
  private readonly floatLayer: HTMLDivElement;
  private readonly chrome: HTMLDivElement;
  private readonly outlinesButton: HTMLButtonElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly clock = new TweenClock();

  private tokens = new Map<string, Token3D>();
  private labels: LabelPlacement[] = [];
  private floats = new Set<FloatText>();
  private telegraphMaterials: { material: THREE.Material; base: number }[] = [];
  private width = 1;
  private height = 1;
  private boardW = 1;
  private boardH = 1;
  private fitDistance = 20;
  private shakeLeft = 0;
  private shakeAmp = 0;
  private elapsed = 0;
  private last = performance.now();
  private frame = 0;
  private pressed: { x: number; y: number } | null = null;
  private downIds = new Set<number>();
  private animating = false;
  private animationJobs = new Set<() => void>();
  private animationEpoch = 0;
  private animationObjects = new Set<THREE.Object3D>();
  private layoutDirty = true;
  private layoutSig = '';
  private version = -1;
  private unsub: () => void;
  private destroyed = false;
  /** Team-colour figure outlines; built on first use, while the toggle is on. */
  private outline: { party: OutlinePass; enemy: OutlinePass } | null = null;
  private flames: Flame[] = [];
  /** Generated models finished loading; rebuild once nothing is animating. */
  private modelsArrived = false;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.className = 'board3d-canvas';
    host.append(canvas);

    this.leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.leaders.classList.add('board3d-leaders');
    this.labelLayer = el('div', 'board3d-labels');
    this.floatLayer = el('div', 'board3d-floats');
    this.chrome = el('div', 'board3d-chrome');
    const hint = el('span', 'board3d-hint');
    hint.textContent = matchMedia(TOUCH_UI_QUERY).matches ? 'Drag to orbit · pinch to zoom' : 'Drag to orbit · wheel to zoom';
    const reset = el('button', 'board3d-reset');
    reset.textContent = 'Reset view';
    reset.dataset.testid = 'board3d-reset';
    reset.addEventListener('click', () => this.resetView());
    this.outlinesButton = el('button', 'board3d-reset');
    this.outlinesButton.textContent = 'Outlines';
    this.outlinesButton.dataset.testid = 'board3d-outlines';
    this.outlinesButton.title = 'Team-colour outlines around figures';
    this.outlinesButton.addEventListener('click', () => controller.setBoardOutlines(!store.getState().boardOutlines));
    this.syncOutlinesButton();
    this.chrome.append(hint, this.outlinesButton, reset);
    host.append(this.leaders, this.labelLayer, this.floatLayer, this.chrome);

    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.Fog(COLORS.bg, 40, 90);
    this.scene.add(this.sky);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    const rim = new THREE.DirectionalLight('#7fa8ff', 0.35);
    rim.position.set(-10, 6, -12);
    this.scene.add(rim);
    this.overlayGroup.renderOrder = 1;
    this.scene.add(this.mapGroup, this.overlayGroup, this.tokenGroup, this.fxGroup);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = 1.2;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('contextmenu', this.onContextMenu);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    this.unsub = store.subscribe((s, prev) => {
      // Never let a rendering problem propagate into store.setState callers.
      try {
        this.onStore(s, prev);
      } catch (err) {
        console.error('3D board refresh failed', err);
      }
    });
    registerAnimator(this);
    registerBoardProjector(this.project);
    this.version = store.getState().boardVersion;

    // Test hooks shared with the 2D board: canvas-relative pixel center of a tile; label/unit boxes.
    const w = window as unknown as { __soc?: Record<string, unknown> };
    if (w.__soc) {
      w.__soc.tileCenter = this.tileCenterHook;
      w.__soc.labelBounds = this.labelBoundsHook;
    }

    this.resize();
    this.rebuild();
    this.frame = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancel();
    this.unsub();
    unregisterAnimator(this);
    unregisterBoardProjector(this.project);
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const w = window as unknown as { __soc?: Record<string, unknown> };
    if (w.__soc?.tileCenter === this.tileCenterHook) delete w.__soc.tileCenter;
    if (w.__soc?.labelBounds === this.labelBoundsHook) delete w.__soc.labelBounds;
    this.controls.dispose();
    disposeTree(this.scene);
    this.outline?.party.dispose();
    this.outline?.enemy.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.leaders.remove();
    this.labelLayer.remove();
    this.floatLayer.remove();
    this.chrome.remove();
  }

  // ---------------- Layout ----------------

  private battle(): BattleState | null {
    return store.getState().battle;
  }

  /** Tile-space point to world space. */
  private world(p: Pt, height = 0): THREE.Vector3 {
    return new THREE.Vector3(p.x - this.boardW / 2, height, p.y - this.boardH / 2);
  }

  /** World point to host-relative CSS pixels. */
  private screen(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  private project = (p: Pt) => this.screen(this.world(p));

  private tileCenterHook = (x: number, y: number) => this.screen(this.world({ x: x + 0.5, y: y + 0.5 }));

  private labelBoundsHook = () => {
    const origin = this.host.getBoundingClientRect();
    const box = (r: DOMRect) => ({ x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height });
    return {
      labels: this.labels.map((l) => ({ text: l.el.textContent ?? '', ...box(l.el.getBoundingClientRect()) })),
      units: this.tokenBounds().map((t) => ({
        id: t.id,
        x: t.box.x,
        y: t.box.y,
        width: t.box.w,
        height: t.box.h,
        body: t.body && { x: t.body.x, y: t.body.y, width: t.body.w, height: t.body.h },
        plate: { x: t.plate.x, y: t.plate.y, width: t.plate.w, height: t.plate.h },
      })),
    };
  };

  private resize(): void {
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.leaders.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.camera.aspect = this.width / this.height;
    this.applyViewOffset(0, 0);
    const pr = this.renderer.getPixelRatio();
    this.outline?.party.setSize(this.width * pr, this.height * pr);
    this.outline?.enemy.setSize(this.width * pr, this.height * pr);
    this.layoutDirty = true;
    const dir = this.camera.position.clone().sub(this.controls.target);
    this.fit(dir.lengthSq() > 0 ? dir.normalize() : HOME_DIRECTION);
    this.sizePlates();
    this.measureLabels();
  }

  /** Plates keep a constant CSS-pixel size: world units per pixel at unit depth for a size-unattenuated sprite. */
  private sizePlates(): void {
    const unitsPerPx = this.unitsPerPx();
    for (const t of this.tokens.values()) sizePlate(t, unitsPerPx);
  }

  private unitsPerPx(): number {
    return 2 / (this.camera.projectionMatrix.elements[5]! * this.height);
  }

  private addToken(u: UnitState): Token3D {
    const tok = makeToken(u);
    this.tokens.set(u.id, tok);
    this.tokenGroup.add(tok.root);
    sizePlate(tok, this.unitsPerPx());
    return tok;
  }

  /** Shift the image down by half the lane so the board centers in the space below it. */
  private applyViewOffset(dx: number, dy: number): void {
    this.camera.setViewOffset(this.width, this.height, dx, -Math.min(LANE, this.height * 0.3) / 2 + dy, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }

  /** Place the camera along `dir` at the closest distance that frames the whole board below the lane. */
  private fit(dir: THREE.Vector3): void {
    const hw = this.boardW / 2 + 0.3;
    const hh = this.boardH / 2 + 0.3;
    const corners = [-hw, hw].flatMap((x) => [-hh, hh].flatMap((z) => [0, 1.6].map((y) => new THREE.Vector3(x, y, z))));
    const lane = Math.min(LANE, this.height * 0.3);
    const top = 1 - (2 * (lane + 8)) / this.height;
    const fits = (d: number) => {
      this.camera.position.copy(dir).multiplyScalar(d);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld();
      return corners.every((c) => {
        const p = c.clone().project(this.camera);
        return p.z < 1 && Math.abs(p.x) <= 0.95 && p.y <= top && p.y >= -0.93;
      });
    };
    let lo = 1;
    let hi = 300;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    this.fitDistance = hi;
    this.camera.position.copy(dir).multiplyScalar(hi);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = hi * 0.35;
    this.controls.maxDistance = hi * 2.2;
    this.controls.update();
  }

  private resetView(): void {
    this.fit(HOME_DIRECTION.clone());
  }

  private rebuild(): void {
    const b = this.battle();
    disposeTree(this.tokenGroup);
    disposeTree(this.mapGroup);
    this.tokens.clear();
    this.flames = [];
    if (!b) return;
    const assets = boardAssets(store.getState().encounterId, b.units);
    if (!assetsReady(assets))
      loadAssets(assets).then(
        () => (this.modelsArrived = true),
        (err: unknown) => console.warn('3D models failed to load; keeping procedural figures and blocks', err),
      );
    const sizeChanged = b.map.width !== this.boardW || b.map.height !== this.boardH;
    this.boardW = b.map.width;
    this.boardH = b.map.height;
    this.buildMap(b);
    for (const u of b.units) this.addToken(u);
    const span = Math.max(this.boardW, this.boardH);
    this.sun.position.set(-span * 0.45, span * 0.9, span * 0.55);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -span * 0.8;
    cam.right = cam.top = span * 0.8;
    cam.near = 0.5;
    cam.far = span * 3;
    cam.updateProjectionMatrix();
    if (sizeChanged) this.resetView();
    this.refresh();
  }

  private onStore(s: GameStore, prev: GameStore): void {
    if (s.boardOutlines !== prev.boardOutlines) this.syncOutlinesButton();
    if (s.boardVersion !== this.version) {
      this.version = s.boardVersion;
      this.rebuild();
      return;
    }
    if (boardViewChanged(s, prev)) {
      this.refresh();
    }
  }

  private syncOutlinesButton(): void {
    const on = store.getState().boardOutlines;
    this.outlinesButton.setAttribute('aria-pressed', String(on));
    this.outlinesButton.classList.toggle('on', on);
  }

  // ---------------- Static map ----------------

  private buildMap(b: BattleState): void {
    const enc = store.getState().encounterId;
    const floor = new THREE.Color(COLORS.floor[enc as keyof typeof COLORS.floor] ?? COLORS.floor.default);
    const W = b.map.width;
    const H = b.map.height;

    const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.7, 0.5, H + 0.7, 3, 0.12), new THREE.MeshStandardMaterial({ color: '#1d1712', roughness: 0.95 }));
    slab.position.y = -0.33;
    slab.receiveShadow = true;
    const underfloor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#0f0c0a', roughness: 1 }));
    underfloor.rotation.x = -Math.PI / 2;
    underfloor.position.y = -0.6;
    underfloor.receiveShadow = true;
    this.mapGroup.add(slab, underfloor);

    const kinds = { floor: [] as Vec[], wall: [] as Vec[], cover: [] as Vec[] };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const terr = b.map.tiles[y * W + x];
        if (terr === 'wall') kinds.wall.push({ x, y });
        else {
          kinds.floor.push({ x, y });
          if (terr === 'cover') kinds.cover.push({ x, y });
        }
      }

    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const white = new THREE.Color('#ffffff');
    const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, tiles: Vec[], y: number, tint: (p: Vec) => THREE.Color) => {
      if (!tiles.length) return;
      const mesh = new THREE.InstancedMesh(geometry, material, tiles.length);
      tiles.forEach((p, i) => {
        m.makeTranslation(p.x + 0.5 - W / 2, y, p.y + 0.5 - H / 2);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, tint(p));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.mapGroup.add(mesh);
    };
    const dressing = DRESSING[enc];
    const dressed = dressing && dressingReady(dressing) ? dressing : null;
    const painted = dressed?.floor ? boardTexture(dressed.floor) : undefined;
    // Floor flagstones with grout gaps; same per-tile shade pattern as the 2D board. A painted floor keeps the gaps,
    // so the grid still reads, and each flagstone shows its own part of the painting.
    instanced(
      new RoundedBoxGeometry(0.95, 0.12, 0.95, 2, 0.03),
      painted ? paintedFloorMaterial(painted, W, H) : new THREE.MeshStandardMaterial({ roughness: 0.92 }),
      kinds.floor,
      -0.06,
      (p) => (painted ? color.setScalar(1 - ((p.x * 7 + p.y * 13) % 5) * 0.012) : color.copy(floor).lerp(white, ((p.x * 7 + p.y * 13) % 5) * 0.012)),
    );
    if (dressed) {
      this.dressMap(dressed, kinds.wall, kinds.cover, W, H);
    } else {
      const wall = new THREE.Color(COLORS.wall);
      // Waist-high walls: tall enough to read as walls, low enough that pawns behind them stay visible.
      instanced(new RoundedBoxGeometry(1, 0.42, 1, 2, 0.04), new THREE.MeshStandardMaterial({ roughness: 0.85 }), kinds.wall, 0.15, (p) =>
        color.copy(wall).lerp(white, ((p.x * 5 + p.y * 3) % 4) * 0.02),
      );
      instanced(new RoundedBoxGeometry(0.76, 0.36, 0.62, 3, 0.07), new THREE.MeshStandardMaterial({ roughness: 0.7 }), kinds.cover, 0.18, () => color.set(COLORS.cover));
      this.sun.intensity = SUN;
      this.sky.intensity = SKY;
    }
    const border = new GroundShape();
    border.frame(-0.06, -0.06, W + 0.12, H + 0.12, 0.05);
    const frame = border.mesh(overlayMaterial(COLORS.cover, 0.6), this.world({ x: 0, y: 0 }), 0.002);
    if (frame) this.mapGroup.add(frame);
  }

  /**
   * Generated walls, cover and lit braziers (models.ts). Edge walls stay a low rubble line and inner walls stop below
   * chest height, so units behind them stay visible; the scene dims so the brazier pools read.
   */
  private dressMap(d: Dressing, walls: Vec[], cover: Vec[], W: number, H: number): void {
    const wallAt = new Set(walls.map((p) => `${p.x},${p.y}`));
    const place = (o: THREE.Object3D, p: Vec, y = 0) => {
      o.position.set(p.x + 0.5 - W / 2, y, p.y + 0.5 - H / 2);
      // Quarter turns by tile, so repeated pieces never line up.
      o.rotation.y = ((p.x * 7 + p.y * 13) % 4) * (Math.PI / 2);
      this.mapGroup.add(o);
    };
    const glow = flameTexture();
    for (const p of walls) {
      if (p.x === 0 || p.y === 0 || p.x === W - 1 || p.y === H - 1) {
        place(fittedProp(d.edge, 1.05, 0.6), p);
        continue;
      }
      const pillar = fittedProp(d.inner, 0.62, 0.8);
      place(pillar, p);
      const free = NEIGHBOURS.every(([dx, dy]) => !wallAt.has(`${p.x + dx},${p.y + dy}`));
      if (!free) continue;
      const top: number = pillar.userData.height;
      const brazier = fittedProp(d.brazier, 0.36);
      place(brazier, p, top - 0.02);
      const flameY = top + brazier.userData.height;
      const light = new THREE.PointLight(BRAZIER.color, BRAZIER.intensity, BRAZIER.distance, 2);
      light.position.set(brazier.position.x, flameY + 0.25, brazier.position.z);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffb065', blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      sprite.position.set(brazier.position.x, flameY + 0.08, brazier.position.z);
      sprite.scale.setScalar(BRAZIER.glow);
      this.mapGroup.add(light, sprite);
      this.flames.push({ light, glow: sprite, seed: p.x * 3.1 + p.y * 1.7 });
    }
    for (const p of cover) place(fittedProp(d.cover, 0.8, 0.42), p);
    this.sun.intensity = d.sun;
    this.sky.intensity = d.sky;
  }

  // ---------------- Overlays ----------------

  refresh(): void {
    const s = store.getState();
    disposeTree(this.overlayGroup);
    this.telegraphMaterials = [];
    this.labelLayer.replaceChildren();
    this.leaders.replaceChildren();
    this.labels = [];
    if (!s.battle) return;
    const view = boardView(s);

    if (!this.animating) {
      for (const tv of view.tokens) {
        const tok = this.tokens.get(tv.unit.id) ?? this.addToken(tv.unit);
        tok.root.position.copy(this.world(unitCenter(tv.unit)));
        tok.root.scale.setScalar(1);
        tok.flash = 1;
        tok.badge = tv.badge;
        paintToken(tok, tv.unit, tv.active, tv.hovered);
        if (tok.figure) {
          tok.figure.settle();
          tok.figure.pending(s.battle.effects.filter((f) => f.sourceId === tv.unit.id).map((f) => f.name));
          const foe = tv.unit.ko ? null : nearestFoe(tv.unit, s.battle.units);
          const yaw = foe ? yawToward(tok.root.position, this.world(unitCenter(foe))) : null;
          if (yaw !== null) tok.figure.face(yaw);
        }
      }
    }

    const origin = this.world({ x: 0, y: 0 });
    const add = (shape: GroundShape, layer: FillLayer | LineLayer, color: string, alpha: number) => {
      const material = overlayMaterial(color, alpha);
      const mesh = shape.mesh(material, origin, LAYER_HEIGHT[layer]);
      if (!mesh) {
        material.dispose();
        return;
      }
      mesh.renderOrder = LAYER_ORDER[layer];
      this.overlayGroup.add(mesh);
      if (layer === 'telegraph') this.telegraphMaterials.push({ material, base: alpha });
    };
    for (const f of view.fills) {
      const shape = new GroundShape();
      shape.tiles(f.tiles);
      add(shape, f.layer, f.color, f.alpha);
      if (f.stroke) {
        const stroke = new GroundShape();
        stroke.tileStrokes(f.tiles, 2 * PX);
        add(stroke, f.layer, f.stroke, 0.9);
      }
    }
    for (const o of view.outlines) {
      const shape = new GroundShape();
      if (o.dashed) shape.dashedRect(o.x, o.y, o.w, o.h, o.width * PX);
      else shape.frame(o.x + PX, o.y + PX, o.w - 2 * PX, o.h - 2 * PX, o.width * PX);
      add(shape, o.layer, o.color, o.alpha);
    }
    for (const seg of view.segments) {
      const shape = new GroundShape();
      shape.ribbon(seg.from, seg.to, seg.width * PX * 1.5);
      add(shape, seg.layer, seg.color, seg.alpha);
    }

    for (const l of view.labels) {
      const label = el('span', 'board3d-label');
      label.textContent = l.text;
      label.style.color = l.color;
      label.style.fontSize = `${Math.max(12, Math.round(56 * l.size))}px`;
      if (l.bg) label.style.background = l.bg;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.labelLayer.append(label);
      this.leaders.append(line);
      this.labels.push({ el: label, anchor: l.anchor, line, w: 0, h: 0, cand: -1, transform: '' });
    }
    this.measureLabels();
  }

  /** Read label sizes once per layout change; placement then follows the camera. */
  private measureLabels(): void {
    for (const l of this.labels) {
      l.w = l.el.offsetWidth;
      l.h = l.el.offsetHeight;
    }
    this.layoutDirty = true;
    if (this.labels.length) this.layoutLabels();
  }

  /** Screen-space rectangles for one box's eight corners. */
  private boxRect(box: THREE.Box3): Rect {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const p = this.screen(v);
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Projected screen bounds of every token: the solid body and the floating plate, plus their union. */
  private tokenBounds(): { id: string; body: Rect | null; plate: Rect; parts: Rect[]; box: Rect }[] {
    this.camera.updateMatrixWorld();
    const pxPerUnit = (this.camera.projectionMatrix.elements[5]! * this.height) / 2;
    return [...this.tokens.values()].map((t) => {
      t.root.updateMatrixWorld(true);
      const box3 = new THREE.Box3();
      for (const p of t.pickables) box3.expandByObject(p);
      const body = box3.isEmpty() ? null : this.boxRect(box3);
      // Size-unattenuated sprite: its screen size is fixed; it draws around its anchor (`center`).
      const k = t.root.scale.x;
      const s = this.screen(t.plate.getWorldPosition(new THREE.Vector3()));
      const pw = t.plate.scale.x * k * pxPerUnit;
      const ph = t.plate.scale.y * k * pxPerUnit;
      const left = s.x - t.plate.center.x * pw;
      const top = s.y - (1 - t.plate.center.y) * ph;
      const f = platePainted(t);
      const plate = { x: left + f.x0 * pw, y: top + f.y0 * ph, w: (f.x1 - f.x0) * pw, h: (f.y1 - f.y0) * ph };
      const parts = body ? [body, plate] : [plate];
      const x0 = Math.min(...parts.map((r) => r.x));
      const y0 = Math.min(...parts.map((r) => r.y));
      const x1 = Math.max(...parts.map((r) => r.x + r.w));
      const y1 = Math.max(...parts.map((r) => r.y + r.h));
      return { id: t.unitId, body, plate, parts, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
    });
  }

  /**
   * Place every label beside its anchor tile where nothing is in the way (tokens, plates, other labels, the
   * chrome, the canvas edge); labels with no free spot go to the top lane with a leader clipped at the first token.
   */
  private layoutLabels(): void {
    if (!this.labels.length) return;
    const W = this.width;
    const H = this.height;
    const obstacles: Rect[] = this.tokenBounds().flatMap((t) => t.parts);
    const chrome = this.chrome.getBoundingClientRect();
    const origin = this.host.getBoundingClientRect();
    obstacles.push({ x: chrome.x - origin.x - 4, y: chrome.y - origin.y - 4, w: chrome.width + 8, h: chrome.height + 8 });
    const tokenRects = obstacles.slice(0, -1);
    const placed: Rect[] = [];
    const edge = 4;
    const free = (r: Rect) => r.x >= edge && r.y >= edge && r.x + r.w <= W - edge && r.y + r.h <= H - edge && !obstacles.some((o) => overlaps(r, o, 3)) && !placed.some((o) => overlaps(r, o, 3));
    const rings = (tile: number) => [6, tile * 0.5, tile, tile * 1.6];
    const lane: LabelPlacement[] = [];

    for (const l of this.labels) {
      const a = this.screen(this.world(l.anchor, 0.03));
      const tile = Math.max(24, Math.abs(this.screen(this.world({ x: l.anchor.x + 1, y: l.anchor.y }, 0.03)).x - a.x));
      const rs = rings(tile);
      const at = (i: number): Rect => {
        const [dx, dy] = LABEL_DIRS[i % LABEL_DIRS.length]!;
        const ring = rs[Math.floor(i / LABEL_DIRS.length)]!;
        const cx = a.x + dx * (l.w / 2 + ring);
        const cy = a.y + dy * (l.h / 2 + ring);
        return { x: cx - l.w / 2, y: cy - l.h / 2, w: l.w, h: l.h };
      };
      const total = rs.length * LABEL_DIRS.length;
      let pick = -1;
      // Keep last frame's side while it stays valid, so labels do not flip while orbiting.
      if (l.cand >= 0 && free(at(l.cand))) pick = l.cand;
      for (let i = 0; pick < 0 && i < total; i++) if (free(at(i))) pick = i;
      if (pick >= 0) {
        const r = at(pick);
        placed.push(r);
        l.cand = pick;
        l.line.style.display = 'none';
        this.moveLabel(l, r.x, r.y);
      } else {
        l.cand = -1;
        lane.push(l);
      }
    }

    for (const l of lane) {
      let x = 12;
      let y = 8;
      for (let guard = 0; guard < 300; guard++) {
        if (x + l.w > W - 12 && x > 12) {
          x = 12;
          y += l.h + 5;
          continue;
        }
        const r = { x, y, w: l.w, h: l.h };
        const blocker = [...obstacles, ...placed].find((o) => overlaps(r, o, 3));
        if (!blocker) break;
        x = Math.max(x + 1, blocker.x + blocker.w + 8);
      }
      placed.push({ x, y, w: l.w, h: l.h });
      this.moveLabel(l, x, y);
      const a = this.screen(this.world(l.anchor, 0.03));
      const from = { x: x + l.w / 2, y: y + l.h };
      const t = firstEntry(from, a, tokenRects);
      const ex = from.x + (a.x - from.x) * t;
      const ey = from.y + (a.y - from.y) * t;
      if (Math.hypot(ex - from.x, ey - from.y) < 4) {
        l.line.style.display = 'none';
      } else {
        l.line.style.display = '';
        l.line.setAttribute('x1', `${from.x}`);
        l.line.setAttribute('y1', `${from.y}`);
        l.line.setAttribute('x2', `${ex}`);
        l.line.setAttribute('y2', `${ey}`);
      }
    }
  }

  private moveLabel(l: LabelPlacement, x: number, y: number): void {
    const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (transform === l.transform) return;
    l.transform = transform;
    l.el.style.transform = transform;
  }

  // ---------------- Input ----------------

  private pickTile(e: PointerEvent): Vec | null {
    const b = this.battle();
    if (!b) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // A unit's body stands above its tiles: resolve picks on it to the footprint tile under the hit.
    const pickables = [...this.tokens.values()].flatMap((t) => t.pickables);
    const hit = this.raycaster.intersectObjects(pickables, false)[0];
    if (hit) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.unitId === undefined) o = o.parent;
      const id: unknown = o?.userData.unitId;
      const unit = b.units.find((u) => u.id === id);
      if (unit && !unit.ko) {
        const tx = Math.floor(hit.point.x + this.boardW / 2);
        const ty = Math.floor(hit.point.z + this.boardH / 2);
        const tiles = unit.footprint.map((f) => ({ x: unit.pos.x + f.x, y: unit.pos.y + f.y }));
        return tiles.reduce((best, t) => (Math.hypot(t.x - tx, t.y - ty) < Math.hypot(best.x - tx, best.y - ty) ? t : best));
      }
    }
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, point)) return null;
    const x = Math.floor(point.x + this.boardW / 2);
    const y = Math.floor(point.z + this.boardH / 2);
    if (x < 0 || y < 0 || x >= b.map.width || y >= b.map.height) return null;
    return { x, y };
  }

  private onPointerMove = (e: PointerEvent) => {
    // Touch has no hover: a finger drag orbits, and taps preview through controller.tapTile.
    if (e.pointerType === 'touch') return;
    controller.hover(this.pickTile(e));
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.isPrimary) this.downIds.clear();
    this.downIds.add(e.pointerId);
    if (e.button === 2) {
      controller.setMode({ kind: 'move' });
      return;
    }
    // A second finger turns the gesture into a pinch or orbit, never a tap.
    this.pressed = e.button === 0 && this.downIds.size === 1 ? { x: e.clientX, y: e.clientY } : null;
  };

  private onPointerUp = (e: PointerEvent) => {
    this.downIds.delete(e.pointerId);
    const start = this.pressed;
    this.pressed = null;
    const touch = e.pointerType === 'touch';
    // A drag orbits the camera; only a press-and-release in place commits (mouse) or previews/commits (touch) a tile.
    if (e.button !== 0 || !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > (touch ? TOUCH_SLOP : CLICK_SLOP)) return;
    const t = this.pickTile(e);
    if (!t) return;
    if (touch) controller.tapTile(t);
    else void controller.clickTile(t);
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.downIds.delete(e.pointerId);
    this.pressed = null;
  };

  private onPointerLeave = (e: PointerEvent) => {
    this.pressed = null;
    // Touch fires pointerleave after every lift; only a mouse leaving the board clears the preview.
    if (e.pointerType !== 'touch') controller.hover(null);
  };

  private onContextMenu = (e: Event) => e.preventDefault();

  // ---------------- Frame loop ----------------

  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(100, now - this.last);
    this.last = now;
    this.elapsed += dt;
    this.clock.tick(dt);
    if (this.modelsArrived && !this.animating) {
      this.modelsArrived = false;
      this.rebuild();
    }
    for (const t of this.tokens.values()) t.figure?.update(dt);
    for (const f of this.flames) {
      const t = this.elapsed / 1000 + f.seed;
      const k = 0.82 + 0.1 * Math.sin(t * 9.1) + 0.08 * Math.sin(t * 23.7 + 1.3);
      f.light.intensity = BRAZIER.intensity * k;
      f.glow.scale.setScalar(BRAZIER.glow * (0.9 + 0.12 * k));
    }

    // Telegraph pulse: 1 → 0.55 → 1 every 1.4 s, as on the 2D board.
    const pulse = 0.775 + 0.225 * Math.cos((this.elapsed / 700) * Math.PI);
    for (const t of this.telegraphMaterials) t.material.opacity = t.base * pulse;

    let dx = 0;
    let dy = 0;
    if (this.shakeLeft > 0) {
      this.shakeLeft -= dt;
      dx = (Math.random() * 2 - 1) * this.shakeAmp * this.width;
      dy = (Math.random() * 2 - 1) * this.shakeAmp * this.height;
    }
    this.applyViewOffset(dx, dy);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (store.getState().boardOutlines) {
      const o = this.outlinePasses();
      o.party.selectedObjects.length = 0;
      o.enemy.selectedObjects.length = 0;
      for (const u of this.battle()?.units ?? []) {
        const fig = this.tokens.get(u.id)?.figure;
        if (fig && !u.ko) (u.side === 'player' ? o.party : o.enemy).selectedObjects.push(fig.object);
      }
      // A null read buffer makes each pass blend its edges additively straight onto the rendered frame,
      // so the scene itself (tone mapping, untone-mapped overlays) renders exactly as without outlines.
      for (const p of [o.party, o.enemy]) if (p.selectedObjects.length) p.render(this.renderer, null as never, null as never, dt / 1000, false);
    }

    // Labels re-place only when the camera, canvas or board changed (or tokens are moving).
    const e = this.camera.matrixWorld.elements;
    const sig = `${this.width}x${this.height}|${e[0]!.toFixed(3)},${e[1]!.toFixed(3)},${e[2]!.toFixed(3)},${e[4]!.toFixed(3)},${e[5]!.toFixed(3)},${e[6]!.toFixed(3)},${e[12]!.toFixed(3)},${e[13]!.toFixed(3)},${e[14]!.toFixed(3)}`;
    if (this.layoutDirty || this.animating || sig !== this.layoutSig) {
      this.layoutSig = sig;
      this.layoutDirty = false;
      this.layoutLabels();
    }
    for (const f of this.floats) {
      const p = this.screen(f.at.clone().setY(f.at.y + f.rise));
      f.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    }
  };

  private outlinePasses(): { party: OutlinePass; enemy: OutlinePass } {
    if (this.outline) return this.outline;
    const pr = this.renderer.getPixelRatio();
    const pass = (color: string) => {
      const p = new OutlinePass(new THREE.Vector2(this.width * pr, this.height * pr), this.scene, this.camera);
      // The overlay shader writes straight to the sRGB canvas without conversion: give it sRGB components.
      p.visibleEdgeColor.setStyle(color, THREE.LinearSRGBColorSpace);
      p.hiddenEdgeColor.set('#000000'); // additive black: no outline through walls
      p.edgeStrength = 3;
      p.edgeThickness = 1;
      p.edgeGlow = 0;
      return p;
    };
    this.outline = { party: pass(COLORS.party), enemy: pass(COLORS.enemy) };
    return this.outline;
  }

  // ---------------- Animation ----------------

  cancel(): void {
    this.animationEpoch += 1;
    for (const cancel of [...this.animationJobs]) cancel();
    for (const object of this.animationObjects) {
      this.fxGroup.remove(object);
      disposeTree(object);
    }
    this.animationObjects.clear();
    for (const f of this.floats) f.el.remove();
    this.floats.clear();
    this.animating = false;
  }

  private animationJob(start: (done: () => void) => () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const cancel = () => {
        stop();
        this.animationJobs.delete(cancel);
        reject(new Error('Animation cancelled'));
      };
      const stop = start(() => {
        this.animationJobs.delete(cancel);
        resolve();
      });
      this.animationJobs.add(cancel);
    });
  }

  private tween(ms: number, update: (p: number) => void): Promise<void> {
    return this.animationJob((done) => this.clock.run(ms, update, done));
  }

  wait(ms: number): Promise<void> {
    return this.tween(ms, () => {});
  }

  float(at: Pt, text: string, color: string, big = false): void {
    const node = el('div', 'board3d-float');
    node.textContent = text;
    node.style.color = color;
    node.style.fontSize = `${Math.round(56 * (big ? 0.42 : 0.3))}px`;
    node.style.fontFamily = UI_FONT;
    this.floatLayer.append(node);
    // Rise from above the unit under the text: pawns are short, figures taller, the boss block tallest.
    const ground = this.world(at);
    let top = PAWN_HEIGHT;
    for (const t of this.tokens.values()) if (t.root.position.distanceTo(ground) < (t.big ? 1.2 : 0.6)) top = Math.max(top, t.top);
    const f: FloatText = { el: node, at: ground.setY(top + 0.2), rise: 0 };
    this.floats.add(f);
    this.clock.run(
      1100,
      (p) => {
        const k = EASE.cubic(p);
        f.rise = 0.7 * k;
        node.style.opacity = `${1 - k}`;
      },
      () => {
        node.remove();
        this.floats.delete(f);
      },
    );
  }

  async moveToken(id: string, to: Pt, ms: number, ease: Ease): Promise<void> {
    const tok = this.tokens.get(id);
    if (!tok) return;
    const from = tok.root.position.clone();
    const dest = this.world(to);
    const fn = EASE[ease];
    if (tok.figure) {
      // Sine moves are walking steps; the other eases are shoves, hooks and sidesteps, taken without turning.
      const yaw = ease === 'sine' ? yawToward(from, dest) : null;
      if (yaw !== null) tok.figure.face(yaw);
      if (ease === 'sine') tok.figure.walk(ms);
      else tok.figure.stagger(ms);
    }
    await this.tween(ms, (p) => {
      tok.root.position.lerpVectors(from, dest, fn(p));
      // Small hop per step so walking reads as movement, not sliding.
      tok.root.position.y = (tok.big ? 0.04 : 0.1) * 4 * p * (1 - p);
    });
  }

  async lungeToken(id: string, toward: Pt, ms: number): Promise<void> {
    const tok = this.tokens.get(id);
    if (!tok) return;
    const from = tok.root.position.clone();
    const dest = this.world(toward);
    await this.tween(ms * 2, (p) => tok.root.position.lerpVectors(from, dest, EASE.quad(yoyo(p, 2))));
  }

  strikePose(id: string, attack: string, target: Pt, ms: number): void {
    const tok = this.tokens.get(id);
    if (!tok?.figure) return;
    const from = tok.root.position.clone();
    // The unit on the named tile; a multi-tile target is faced and aimed at its nearest tile.
    const tile = { x: Math.floor(target.x), y: Math.floor(target.y) };
    const victim = this.battle()?.units.find((u) => !u.ko && u.footprint.some((f) => u.pos.x + f.x === tile.x && u.pos.y + f.y === tile.y));
    const aims = victim && victim.footprint.length > 1 ? victim.footprint.map((f) => this.world({ x: victim.pos.x + f.x + 0.5, y: victim.pos.y + f.y + 0.5 })) : [this.world(target)];
    const dest = aims.reduce((best, p) => (p.distanceTo(from) < best.distanceTo(from) ? p : best));
    const yaw = yawToward(from, dest);
    if (yaw !== null) tok.figure.face(yaw);
    const projectile = tok.figure.strike(Math.hypot(dest.x - from.x, dest.z - from.z), attack, ms);
    if (!projectile) return;
    // Released at the lunge peak, arriving as the lunge returns and the strike result shows.
    from.y += tok.top * 0.75;
    const struck = victim ? this.tokens.get(victim.id) : undefined;
    dest.y += struck ? Math.min(struck.top * 0.6, 1.2) : 0.25;
    this.fly(projectile, from, dest, ms, ms);
  }

  effectLands(sourceId: string, effect: string, ms: number): void {
    this.tokens.get(sourceId)?.figure?.land(effect, ms);
  }

  /** Fire-and-forget projectile flight from `from` to `to` after `delay`; cancel() disposes it mid-flight. */
  private fly(kind: Projectile, from: THREE.Vector3, to: THREE.Vector3, delay: number, ms: number): void {
    const { object, lift, spin } = makeProjectile(kind);
    object.visible = false;
    this.fxGroup.add(object);
    this.animationObjects.add(object);
    const arc = lift * from.distanceTo(to);
    const at = (p: number, out: THREE.Vector3) => out.lerpVectors(from, to, p).setY(from.y + (to.y - from.y) * p + arc * 4 * p * (1 - p));
    const ahead = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, 1);
    this.wait(delay)
      .then(() =>
        this.tween(ms, (p) => {
          object.visible = true;
          at(p, object.position);
          at(Math.min(1, p + 0.02), ahead);
          if (p < 0.98) object.quaternion.setFromUnitVectors(forward, ahead.sub(object.position).normalize());
          if (spin) object.rotateX(spin * p);
        }),
      )
      .then(
        () => {
          this.animationObjects.delete(object);
          this.fxGroup.remove(object);
          disposeTree(object);
        },
        // Cancelled: cancel() already disposed it with the other animation objects.
        () => {},
      );
  }

  async pulseToken(id: string, scale: number, ms: number): Promise<void> {
    const tok = this.tokens.get(id);
    if (tok) await this.tween(ms * 2, (p) => tok.root.scale.setScalar(1 + (scale - 1) * yoyo(p, 2)));
  }

  async blinkToken(id: string, ms: number): Promise<void> {
    const tok = this.tokens.get(id);
    if (!tok) return;
    tok.figure?.hit(ms * 4);
    await this.tween(ms * 4, (p) => {
      tok.flash = p >= 1 ? 1 : 0.35 + 0.65 * yoyo(p, 4);
      applyOpacity(tok);
    });
  }

  async spawnToken(unit: UnitState, ms: number): Promise<void> {
    const tok = this.tokens.get(unit.id) ?? this.addToken(unit);
    tok.root.position.copy(this.world(unitCenter(unit)));
    paintToken(tok, unit, false, false);
    tok.root.scale.setScalar(0.01);
    await this.tween(ms, (p) => tok.root.scale.setScalar(Math.max(0.01, EASE.back(p))));
  }

  async fadeToken(id: string, alpha: number, ms: number): Promise<void> {
    const tok = this.tokens.get(id);
    if (!tok) return;
    const from = tok.alpha;
    if (alpha < from) tok.figure?.fall(ms);
    await this.tween(ms, (p) => {
      tok.alpha = from + (alpha - from) * p;
      applyOpacity(tok);
    });
  }

  paintToken(id: string, unit: UnitState, active: boolean): void {
    const tok = this.tokens.get(id);
    if (tok) paintToken(tok, unit, active, false);
  }

  async flashTiles(tiles: Vec[], color: string, alpha: number, ms: number): Promise<void> {
    const shape = new GroundShape();
    shape.tiles(tiles);
    const material = overlayMaterial(color, alpha);
    const mesh = shape.mesh(material, this.world({ x: 0, y: 0 }), 0.03);
    if (!mesh) return;
    mesh.renderOrder = 10;
    this.fxGroup.add(mesh);
    this.animationObjects.add(mesh);
    await this.tween(ms, (p) => (material.opacity = alpha * (1 - p)));
    this.animationObjects.delete(mesh);
    this.fxGroup.remove(mesh);
    disposeTree(mesh);
  }

  shake(ms: number, intensity: number): void {
    this.shakeLeft = ms;
    this.shakeAmp = intensity;
  }

  async play(events: GameEvent[], before: BattleState, after: BattleState, speed: number): Promise<void> {
    if (this.destroyed) return;
    const epoch = this.animationEpoch;
    this.animating = true;
    try {
      await choreograph(this, events, before, after, speed);
    } catch (err) {
      if (epoch === this.animationEpoch) throw err;
    } finally {
      if (epoch === this.animationEpoch) this.animating = false;
    }
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Figure yaw (0 = facing +z) from one world point toward another; null when they coincide. */
function yawToward(from: THREE.Vector3, to: THREE.Vector3): number | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return dx * dx + dz * dz < 1e-6 ? null : Math.atan2(dx, dz);
}

/** Closest living opponent, which an idle figure faces. */
function nearestFoe(u: UnitState, units: readonly UnitState[]): UnitState | null {
  const c = unitCenter(u);
  let best: UnitState | null = null;
  let bestD = Infinity;
  for (const o of units) {
    if (o.side === u.side || o.ko) continue;
    const p = unitCenter(o);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/**
 * Flagstone material sampling one painting stretched over the whole board by world position, so each instanced
 * flagstone shows its own part of it. The board is centred on the origin, `W` by `H` tiles; image top is row 0.
 */
function paintedFloorMaterial(painting: THREE.Texture, W: number, H: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.boardPainting = { value: painting };
    shader.uniforms.boardSize = { value: new THREE.Vector2(W, H) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 boardSize;\nvarying vec2 vBoardUv;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vec4 boardPos = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
boardPos = instanceMatrix * boardPos;
#endif
boardPos = modelMatrix * boardPos;
vBoardUv = vec2(boardPos.x / boardSize.x + 0.5, 0.5 - boardPos.z / boardSize.y);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D boardPainting;\nvarying vec2 vBoardUv;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(boardPainting, vBoardUv).rgb;');
  };
  m.customProgramCacheKey = () => 'painted-floor';
  return m;
}

/** Soft round glow for brazier flames, drawn once per map build. */
function flameTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,240,200,1)');
  r.addColorStop(0.35, 'rgba(255,170,80,0.7)');
  r.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Dispose every geometry, material and texture under `root` and detach its children. */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) o.dispose();
    const mesh = o as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    // Generated models share geometry and textures with the model cache (models.ts); only per-unit copies go.
    if (o.userData.cachedModel) {
      for (const m of materials) if (m.userData.ownMaterial) m.dispose();
      return;
    }
    // Sprites share one module-level quad geometry; never dispose it.
    if (!(o instanceof THREE.Sprite)) mesh.geometry?.dispose();
    for (const m of materials) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
  root.clear();
}
