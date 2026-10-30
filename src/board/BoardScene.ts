// 2D board rendering and animation (Phaser 4). Reads the store; never changes rules state.
// What to draw comes from view-model.ts and how events animate from choreography.ts.

import Phaser from 'phaser';
import { SKILLS } from '../content/gear';
import { breakFreeAt } from '../rules/engine';
import type { Vec } from '../rules/geometry';
import type { BattleState, GameEvent, UnitState } from '../rules/types';
import { controller, registerAnimator, unregisterAnimator, type Animator } from '../game/controller';
import { store, type GameStore } from '../game/store';
import { choreograph, type Ease, type Stage } from './choreography';
import { COLORS, hex } from './palette';
import { boardView, footprintSize, unitCenter, type FillLayer, type LineLayer, type Pt } from './view-model';

interface Token {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  glyph: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Text;
  w: number;
  h: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FONT = 'Georgia, "Times New Roman", serif';
const UI_FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
const EASES: Record<Ease, string> = { linear: 'Linear', sine: 'Sine.easeInOut', quad: 'Quad.easeOut', back: 'Back.easeOut' };

/** Fraction along p→q (0..1) at which the segment first enters any rectangle; 1 when it enters none. */
function firstEntry(p: Pt, q: Pt, rects: Rect[]): number {
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

export class BoardScene extends Phaser.Scene implements Animator, Stage {
  private tile = 56;
  private ox = 0;
  private oy = 0;
  private mapGfx!: Phaser.GameObjects.Graphics;
  private layers!: Record<FillLayer | LineLayer, Phaser.GameObjects.Graphics>;
  private labels: Phaser.GameObjects.Text[] = [];
  private laneLabels: Phaser.GameObjects.Text[] = [];
  private occupied: Rect[] = [];
  private tokens = new Map<string, Token>();
  private animating = false;
  private animationJobs = new Set<() => void>();
  private animationEpoch = 0;
  private animationObjects = new Set<Phaser.GameObjects.GameObject>();
  private version = -1;
  private unsub: (() => void) | null = null;

  constructor() {
    super('board');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.mapGfx = this.add.graphics().setDepth(0);
    this.layers = {
      zone: this.add.graphics().setDepth(1),
      telegraph: this.add.graphics().setDepth(2),
      overlay: this.add.graphics().setDepth(3),
      links: this.add.graphics().setDepth(4),
    };
    this.tweens.add({ targets: this.layers.telegraph, alpha: { from: 1, to: 0.55 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => controller.hover(this.tileAt(p.x, p.y)));
    this.input.on('gameout', () => controller.hover(null));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        controller.setMode({ kind: 'move' });
        return;
      }
      const t = this.tileAt(p.x, p.y);
      if (t) void controller.clickTile(t);
    });
    this.scale.on('resize', () => this.rebuild());
    this.unsub = store.subscribe((s, prev) => {
      // Never let a rendering problem propagate into store.setState callers.
      try {
        if (this.sys.isActive()) this.onStore(s, prev);
      } catch (err) {
        console.error('board refresh failed', err);
      }
    });
    registerAnimator(this);
    const cleanup = () => {
      this.cancel();
      this.unsub?.();
      this.unsub = null;
      unregisterAnimator(this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.version = store.getState().boardVersion;
    // Test hook: canvas-relative pixel center of a tile.
    const w = window as unknown as { __soc?: Record<string, unknown> };
    if (w.__soc) {
      w.__soc.tileCenter = (x: number, y: number) => this.px({ x: x + 0.5, y: y + 0.5 });
      w.__soc.labelBounds = () => ({
        labels: this.labels.map(t => ({ text: t.text, ...t.getBounds() })),
        units: [...this.tokens.entries()].map(([id, t]) => ({ id, ...t.root.getBounds() })),
      });
    }
    this.rebuild();
  }

  // ---------------- Layout ----------------

  private battle(): BattleState | null {
    return store.getState().battle;
  }

  private tileAt(px: number, py: number): Vec | null {
    const b = this.battle();
    if (!b) return null;
    const x = Math.floor((px - this.ox) / this.tile);
    const y = Math.floor((py - this.oy) / this.tile);
    if (x < 0 || y < 0 || x >= b.map.width || y >= b.map.height) return null;
    return { x, y };
  }

  /** Tile-space point to canvas pixels. */
  private px(p: Pt): { x: number; y: number } {
    return { x: this.ox + p.x * this.tile, y: this.oy + p.y * this.tile };
  }

  private layout(b: BattleState): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // Labels sit beside their tiles; the top strip is only an overflow lane.
    const lane = 48;
    this.tile = Math.max(28, Math.floor(Math.min((w - 24) / b.map.width, (h - lane - 12) / b.map.height)));
    this.tile = Math.min(this.tile, 132);
    this.ox = Math.floor((w - this.tile * b.map.width) / 2);
    this.oy = lane + Math.max(0, Math.floor((h - lane - 12 - this.tile * b.map.height) / 2));
  }

  private rebuild(): void {
    const b = this.battle();
    for (const t of this.tokens.values()) t.root.destroy();
    this.tokens.clear();
    this.mapGfx.clear();
    if (!b) return;
    this.layout(b);
    this.drawMap(b);
    for (const u of b.units) this.tokens.set(u.id, this.makeToken(u));
    this.refresh();
  }

  private onStore(s: GameStore, prev: GameStore): void {
    if (s.boardVersion !== this.version) {
      this.version = s.boardVersion;
      this.rebuild();
      return;
    }
    if (s.battle !== prev.battle || s.hoverTile !== prev.hoverTile || s.hoverUnitId !== prev.hoverUnitId || s.mode !== prev.mode || s.busy !== prev.busy) {
      this.refresh();
    }
  }

  // ---------------- Static map ----------------

  private drawMap(b: BattleState): void {
    const g = this.mapGfx;
    const t = this.tile;
    const enc = store.getState().encounterId;
    const floor = hex(COLORS.floor[enc as keyof typeof COLORS.floor] ?? COLORS.floor.default);
    for (let y = 0; y < b.map.height; y++)
      for (let x = 0; x < b.map.width; x++) {
        const terr = b.map.tiles[y * b.map.width + x];
        const px = this.ox + x * t;
        const py = this.oy + y * t;
        const shade = ((x * 7 + y * 13) % 5) * 0.012;
        if (terr === 'wall') {
          g.fillStyle(hex(COLORS.wall), 1);
          g.fillRect(px, py, t, t);
          g.fillStyle(0x000000, 0.25);
          g.fillRect(px, py + t * 0.8, t, t * 0.2);
          continue;
        }
        g.fillStyle(floor, 1);
        g.fillRect(px, py, t, t);
        g.fillStyle(0xffffff, shade);
        g.fillRect(px, py, t, t);
        g.lineStyle(1, 0x000000, 0.18);
        g.strokeRect(px + 0.5, py + 0.5, t - 1, t - 1);
        if (terr === 'cover') {
          g.fillStyle(hex(COLORS.cover), 1);
          g.fillRoundedRect(px + t * 0.12, py + t * 0.2, t * 0.76, t * 0.62, t * 0.12);
          g.fillStyle(0xffffff, 0.12);
          g.fillRoundedRect(px + t * 0.16, py + t * 0.22, t * 0.68, t * 0.16, t * 0.08);
          g.lineStyle(2, 0x000000, 0.35);
          g.strokeRoundedRect(px + t * 0.12, py + t * 0.2, t * 0.76, t * 0.62, t * 0.12);
        }
      }
  }

  // ---------------- Tokens ----------------

  private makeToken(u: UnitState): Token {
    const big = u.footprint.length > 1;
    const size = footprintSize(u);
    const w = big ? size.w * this.tile : this.tile;
    const h = big ? size.h * this.tile : this.tile;
    const c = this.px(unitCenter(u));
    const root = this.add.container(c.x, c.y).setDepth(big ? 5 : 6);
    const body = this.add.graphics();
    const glyph = this.add
      .text(0, big ? -h * 0.08 : -1, u.glyph, { fontFamily: FONT, fontSize: `${Math.round((big ? 0.5 : 0.36) * this.tile)}px`, color: '#f3e9d2', fontStyle: 'bold' })
      .setOrigin(0.5);
    const hp = this.add.graphics();
    // Status badge sits on the token's own top edge so it never covers the tile above.
    const badgeY = big ? -h / 2 + 4 : -this.tile * 0.48;
    const badge = this.add.text(0, badgeY, '', { fontFamily: UI_FONT, fontSize: `${Math.max(9, Math.round(this.tile * 0.15))}px`, color: '#ffd166', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0);
    root.add([body, glyph, hp, badge]);
    if (big) {
      const name = this.add.text(0, h * 0.18, u.name.toUpperCase(), { fontFamily: FONT, fontSize: `${Math.round(this.tile * 0.2)}px`, color: '#e8c9a0' }).setOrigin(0.5);
      root.add(name);
    }
    const tok: Token = { root, body, glyph, hp, badge, w, h };
    this.paint(tok, u, false, false);
    return tok;
  }

  private paint(tok: Token, u: UnitState, active: boolean, hovered: boolean): void {
    const g = tok.body;
    g.clear();
    const side = u.side === 'player' ? COLORS.party : COLORS.enemy;
    const r = this.tile * 0.30;
    if (u.footprint.length > 1) {
      const w = tok.w - 8;
      const h = tok.h - 8;
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 18);
      g.fillStyle(hex(COLORS.boss), 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
      g.fillStyle(0xffffff, 0.06);
      g.fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h * 0.3, 12);
      g.lineStyle(active ? 4 : 2, active ? hex(COLORS.gold) : hovered ? 0xffffff : hex(side), 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    } else {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(0, r * 0.95, r * 1.7, r * 0.55);
      g.fillStyle(hex(u.side === 'player' ? COLORS.partyDark : COLORS.enemyDark), 1);
      g.fillCircle(0, 0, r);
      g.lineStyle(active ? 4 : 3, active ? hex(COLORS.gold) : hex(side), 1);
      g.strokeCircle(0, 0, r);
      if (hovered) {
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeCircle(0, 0, r + 4);
      }
    }
    // HP bar
    const hp = tok.hp;
    hp.clear();
    const bw = u.footprint.length > 1 ? tok.w * 0.6 : this.tile * 0.74;
    const by = u.footprint.length > 1 ? tok.h * 0.32 : this.tile * 0.34;
    const frac = Math.max(0, u.hp / u.maxHp);
    hp.fillStyle(0x000000, 0.7);
    hp.fillRect(-bw / 2 - 1, by - 1, bw + 2, 7);
    hp.fillStyle(frac > 0.5 ? 0x6fbf73 : frac > 0.25 ? 0xe0b13a : 0xd9534f, 1);
    hp.fillRect(-bw / 2, by, bw * frac, 5);
    tok.root.setAlpha(u.ko ? 0.22 : 1);
  }

  // ---------------- Overlays ----------------

  private fillTiles(g: Phaser.GameObjects.Graphics, tiles: Vec[], color: number, alpha: number, stroke?: number): void {
    const t = this.tile;
    for (const p of tiles) {
      g.fillStyle(color, alpha);
      g.fillRect(this.ox + p.x * t + 2, this.oy + p.y * t + 2, t - 4, t - 4);
      if (stroke !== undefined) {
        g.lineStyle(2, stroke, 0.9);
        g.strokeRect(this.ox + p.x * t + 2, this.oy + p.y * t + 2, t - 4, t - 4);
      }
    }
  }

  /**
   * Place a label beside its anchor tile, clear of tokens, other labels and the canvas edge.
   * Only when no nearby spot exists does it go to the top lane, with a leader line to the anchor.
   */
  private label(anchor: Pt, text: string, color: string, size: number, bg?: string): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: UI_FONT, fontSize: `${Math.max(10, Math.round(this.tile * size))}px`, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 };
    if (bg) Object.assign(style, { backgroundColor: bg, padding: { x: 4, y: 2 } });
    const txt = this.add.text(0, 0, text, style).setOrigin(0).setDepth(20);
    txt.setWordWrapWidth(Math.min(this.scale.width - 24, this.tile * 7));
    const a = this.px(anchor);
    const W = this.scale.width;
    const H = this.scale.height;
    const gap = 3;
    const clear = (r: Rect) =>
      r.x >= 4 && r.y >= 4 && r.x + r.w <= W - 4 && r.y + r.h <= H - 4 &&
      !this.occupied.some((o) => r.x < o.x + o.w + gap && r.x + r.w + gap > o.x && r.y < o.y + o.h + gap && r.y + r.h + gap > o.y);
    const step = this.tile / 4;
    const reach = this.tile * 1.5;
    const spanX = this.tile * 2 + txt.width / 2;
    const spanY = this.tile * 2 + txt.height / 2;
    let best: Rect | null = null;
    let bestScore = Infinity;
    for (let dy = -spanY; dy <= spanY; dy += step) {
      for (let dx = -spanX; dx <= spanX; dx += step) {
        const r = { x: a.x + dx - txt.width / 2, y: a.y + dy - txt.height / 2, w: txt.width, h: txt.height };
        // Distance from the anchor point to the nearest point of the label rectangle.
        const nx = Math.max(r.x, Math.min(a.x, r.x + r.w)) - a.x;
        const ny = Math.max(r.y, Math.min(a.y, r.y + r.h)) - a.y;
        if (Math.hypot(nx, ny) > reach) continue;
        const score = Math.hypot(dx, dy);
        if (score >= bestScore || !clear(r)) continue;
        best = r;
        bestScore = score;
      }
    }
    if (best) {
      txt.setPosition(best.x, best.y);
      this.occupied.push(best);
    } else {
      const previous = this.laneLabels.at(-1);
      let lx = previous ? previous.x + previous.width + 12 : 12;
      let ly = previous?.y ?? 4;
      if (lx + txt.width > W - 12) { lx = 12; ly += (previous?.height ?? 20) + 5; }
      txt.setPosition(lx, ly);
      this.laneLabels.push(txt);
      const from = { x: lx + txt.width / 2, y: ly + txt.height };
      const t = firstEntry(from, a, this.occupied);
      this.occupied.push({ x: lx, y: ly, w: txt.width, h: txt.height });
      if (Math.hypot((a.x - from.x) * t, (a.y - from.y) * t) >= 4) {
        this.layers.links.lineStyle(1, 0xffffff, 0.25);
        this.layers.links.lineBetween(from.x, from.y, from.x + (a.x - from.x) * t, from.y + (a.y - from.y) * t);
      }
    }
    this.labels.push(txt);
  }

  refresh(): void {
    const s = store.getState();
    for (const g of Object.values(this.layers)) g.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];
    this.laneLabels = [];
    this.occupied = [];
    if (!s.battle) return;
    const view = boardView(s);

    if (!this.animating) {
      for (const tv of view.tokens) {
        const tok = this.tokens.get(tv.unit.id);
        if (!tok) continue;
        const c = this.px(unitCenter(tv.unit));
        tok.root.setPosition(c.x, c.y);
        this.paint(tok, tv.unit, tv.active, tv.hovered);
        tok.badge.setText(tv.badge);
        tok.badge.setScale(Math.min(1, (tok.w - 4) / Math.max(1, tok.badge.width)));
      }
    }

    for (const f of view.fills) this.fillTiles(this.layers[f.layer], f.tiles, hex(f.color), f.alpha, f.stroke === undefined ? undefined : hex(f.stroke));
    for (const o of view.outlines) {
      const g = this.layers[o.layer];
      const p = this.px(o);
      const w = o.w * this.tile;
      const h = o.h * this.tile;
      g.lineStyle(o.width, hex(o.color), o.alpha);
      if (!o.dashed) {
        g.strokeRect(p.x + 1, p.y + 1, w - 2, h - 2);
        continue;
      }
      for (let d = 0; d < w; d += 10) {
        const end = Math.min(d + 5, w);
        g.lineBetween(p.x + d, p.y, p.x + end, p.y);
        g.lineBetween(p.x + d, p.y + h, p.x + end, p.y + h);
        g.lineBetween(p.x, p.y + d, p.x, p.y + end);
        g.lineBetween(p.x + w, p.y + d, p.x + w, p.y + end);
      }
    }
    for (const seg of view.segments) {
      const a = this.px(seg.from);
      const c = this.px(seg.to);
      this.layers[seg.layer].lineStyle(seg.width, hex(seg.color), seg.alpha);
      this.layers[seg.layer].lineBetween(a.x, a.y, c.x, c.y);
    }
    // Token bounds (body, HP bar, badge, name) that labels must not cover.
    this.occupied = [...this.tokens.values()].map((t) => ({ x: t.root.x - t.w / 2, y: t.root.y - t.h / 2, w: t.w, h: t.h }));
    for (const l of view.labels) this.label(l.anchor, l.text, l.color, l.size, l.bg);
  }

  // ---------------- Animation ----------------

  cancel(): void {
    this.animationEpoch += 1;
    for (const cancel of [...this.animationJobs]) cancel();
    for (const object of this.animationObjects) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.animationObjects.clear();
    this.animating = false;
  }

  private animationJob(start: (done: () => void) => () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const cancel = () => {
        stop();
        this.animationJobs.delete(cancel);
        reject(new Error('Animation cancelled'));
      };
      const stop = start(() => { this.animationJobs.delete(cancel); resolve(); });
      this.animationJobs.add(cancel);
    });
  }

  wait(ms: number): Promise<void> {
    return this.animationJob(done => {
      const timer = this.time.delayedCall(ms, done);
      return () => timer.remove(false);
    });
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return this.animationJob(done => {
      const tween = this.tweens.add({ ...cfg, onComplete: done });
      return () => tween.stop();
    });
  }

  private tokenRoot(id: string): Phaser.GameObjects.Container | null {
    return this.tokens.get(id)?.root ?? null;
  }

  float(at: Pt, text: string, color: string, big = false): void {
    const { x, y } = this.px(at);
    const t = this.add
      .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${Math.round(this.tile * (big ? 0.42 : 0.3))}px`, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(30);
    this.animationObjects.add(t);
    this.tweens.add({ targets: t, y: y - this.tile * 0.7, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => { this.animationObjects.delete(t); t.destroy(); } });
  }

  async moveToken(id: string, to: Pt, ms: number, ease: Ease): Promise<void> {
    const root = this.tokenRoot(id);
    if (root) await this.tween({ targets: root, ...this.px(to), duration: ms, ease: EASES[ease] });
  }

  async lungeToken(id: string, toward: Pt, ms: number): Promise<void> {
    const root = this.tokenRoot(id);
    if (root) await this.tween({ targets: root, ...this.px(toward), duration: ms, yoyo: true, ease: EASES.quad });
  }

  async pulseToken(id: string, scale: number, ms: number): Promise<void> {
    const root = this.tokenRoot(id);
    if (root) await this.tween({ targets: root, scale: { from: 1, to: scale }, duration: ms, yoyo: true });
  }

  async blinkToken(id: string, ms: number): Promise<void> {
    const root = this.tokenRoot(id);
    if (root) await this.tween({ targets: root, alpha: { from: 0.35, to: 1 }, duration: ms, yoyo: true, repeat: 1 });
  }

  async fadeToken(id: string, alpha: number, ms: number): Promise<void> {
    const root = this.tokenRoot(id);
    if (root) await this.tween({ targets: root, alpha, duration: ms });
  }

  paintToken(id: string, unit: UnitState, active: boolean): void {
    const tok = this.tokens.get(id);
    if (tok) this.paint(tok, unit, active, false);
  }

  async flashTiles(tiles: Vec[], color: string, alpha: number, ms: number): Promise<void> {
    const g = this.add.graphics().setDepth(15);
    this.animationObjects.add(g);
    this.fillTiles(g, tiles, hex(color), alpha);
    await this.tween({ targets: g, alpha: { from: 1, to: 0 }, duration: ms });
    this.animationObjects.delete(g);
    g.destroy();
  }

  shake(ms: number, intensity: number): void {
    this.cameras.main.shake(ms, intensity);
  }

  async play(events: GameEvent[], before: BattleState, after: BattleState, speed: number): Promise<void> {
    if (!this.sys.isActive()) return;
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

export function breakFreeIn(b: BattleState): number | null {
  const at = breakFreeAt(b);
  return at === null ? null : at - b.clock;
}

export function skillName(id: string): string {
  return SKILLS[id]?.name ?? id;
}
