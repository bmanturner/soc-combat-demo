// Board rendering and animation (Phaser 4). Reads the store; never changes rules state.

import Phaser from 'phaser';
import { patternTiles } from '../rules/patterns';
import { SKILLS } from '../content/gear';
import { attackModes } from '../rules/equipment';
import { breakFreeAt } from '../rules/engine';
import { eq, key, type Vec } from '../rules/geometry';
import { attackOptions, bossSweepThreat, engagedPairs, pathSafety, previewAttack, previewSkill, reachable, skillOptions, type AttackPreview } from '../rules/queries';
import { alive, isFlanked, tilesOf, unitById } from '../rules/state';
import type { BattleState, GameEvent, UnitState } from '../rules/types';
import { controller, registerAnimator, unregisterAnimator, type Animator } from '../game/controller';
import { pendingFor } from '../game/preview';
import { store, type GameStore } from '../game/store';
import { COLORS, hex } from './palette';

interface Token {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  glyph: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Text;
  w: number;
  h: number;
}

const FONT = 'Georgia, "Times New Roman", serif';
const UI_FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

export class BoardScene extends Phaser.Scene implements Animator {
  private tile = 56;
  private ox = 0;
  private oy = 0;
  private mapGfx!: Phaser.GameObjects.Graphics;
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private telegraph!: Phaser.GameObjects.Graphics;
  private links!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
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
    this.zoneGfx = this.add.graphics().setDepth(1);
    this.telegraph = this.add.graphics().setDepth(2);
    this.overlay = this.add.graphics().setDepth(3);
    this.links = this.add.graphics().setDepth(4);
    this.tweens.add({ targets: this.telegraph, alpha: { from: 1, to: 0.55 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
      w.__soc.tileCenter = (x: number, y: number) => ({ x: this.cx(x), y: this.cy(y) });
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

  private cx(x: number): number {
    return this.ox + x * this.tile + this.tile / 2;
  }

  private cy(y: number): number {
    return this.oy + y * this.tile + this.tile / 2;
  }

  /** Center of a unit's footprint in pixels. */
  private unitCenter(u: UnitState, pos: Vec = u.pos): { x: number; y: number } {
    const tiles = u.footprint.map((o) => ({ x: pos.x + o.x, y: pos.y + o.y }));
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    return { x: this.cx((Math.min(...xs) + Math.max(...xs)) / 2), y: this.cy((Math.min(...ys) + Math.max(...ys)) / 2) };
  }

  private layout(b: BattleState): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.tile = Math.max(28, Math.floor(Math.min((w - 24) / b.map.width, (h - 164) / b.map.height)));
    this.tile = Math.min(this.tile, 84);
    this.ox = Math.floor((w - this.tile * b.map.width) / 2);
    this.oy = 140 + Math.floor((h - 140 - this.tile * b.map.height) / 2);
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
    const xs = u.footprint.map((o) => o.x);
    const ys = u.footprint.map((o) => o.y);
    const w = big ? (Math.max(...xs) - Math.min(...xs) + 1) * this.tile : this.tile;
    const h = big ? (Math.max(...ys) - Math.min(...ys) + 1) * this.tile : this.tile;
    const c = this.unitCenter(u);
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
    this.paintToken(tok, u, false, false);
    return tok;
  }

  private paintToken(tok: Token, u: UnitState, active: boolean, hovered: boolean): void {
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

  private statusBadge(b: BattleState, u: UnitState): string {
    const tags: string[] = [];
    if (u.dazed) tags.push('DAZED');
    if (u.feared) tags.push('FEARED');
    if (!u.ko && isFlanked(b, u)) tags.push('FLANKED');
    return tags.join(' · ');
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

  private label(x: number, y: number, text: string, color = '#ffffff', size = 0.22, bg?: string): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: UI_FONT, fontSize: `${Math.max(10, Math.round(this.tile * size))}px`, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 };
    if (bg) Object.assign(style, { backgroundColor: bg, padding: { x: 4, y: 2 } });
    const txt = this.add.text(0, 0, text, style).setOrigin(0).setDepth(20);
    // Reserved annotation lane above the board: no token, HP or badge can
    // intersect it. Wrap labels, with leaders identifying the original tile.
    txt.setWordWrapWidth(this.scale.width - 24);
    const previous = this.labels.at(-1);
    let lx = previous ? previous.x + previous.width + 12 : 12;
    let ly = previous?.y ?? 8;
    if (lx + txt.width > this.scale.width - 12) { lx = 12; ly += (previous?.height ?? 20) + 5; }
    txt.setPosition(lx, ly);
    this.links.lineStyle(1, 0xffffff, 0.25);
    this.links.lineBetween(lx + txt.width / 2, ly + txt.height, x, y);
    this.labels.push(txt);
    return txt;
  }

  refresh(): void {
    const s = store.getState();
    const b = s.battle;
    this.overlay.clear();
    this.telegraph.clear();
    this.zoneGfx.clear();
    this.links.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];
    if (!b) return;

    // Tokens
    if (!this.animating) {
      for (const u of b.units) {
        const tok = this.tokens.get(u.id);
        if (!tok) continue;
        const c = this.unitCenter(u);
        tok.root.setPosition(c.x, c.y);
        this.paintToken(tok, u, b.active?.unitId === u.id, s.hoverUnitId === u.id);
        tok.badge.setText(this.statusBadge(b, u));
        tok.badge.setScale(Math.min(1, (tok.w - 4) / Math.max(1, tok.badge.width)));
      }
    }

    // Boss sweep zone: always visible so the danger area is learnable.
    const threat = bossSweepThreat(b);
    if (threat && threat.tiles.length) {
      this.fillTiles(this.zoneGfx, threat.tiles, hex(COLORS.amber), 0.09);
      const xs = threat.tiles.map((p) => p.x);
      const ys = threat.tiles.map((p) => p.y);
      const x0 = this.ox + Math.min(...xs) * this.tile;
      const y0 = this.oy + Math.min(...ys) * this.tile;
      const w = (Math.max(...xs) - Math.min(...xs) + 1) * this.tile;
      const h = (Math.max(...ys) - Math.min(...ys) + 1) * this.tile;
      this.zoneGfx.lineStyle(2, hex(COLORS.amber), 0.55);
      this.zoneGfx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
      this.label(x0 + w - this.tile * 0.9, y0 + h - this.tile * 0.18, 'SWEEP ZONE', '#ffb347', 0.15);
    }

    // Telegraphed effects
    for (const e of b.effects) {
      this.fillTiles(this.telegraph, e.tiles, hex(COLORS.danger), 0.42, hex(COLORS.danger));
      const xs = e.tiles.map((p) => p.x);
      const ys = e.tiles.map((p) => p.y);
      const lx = this.cx((Math.min(...xs) + Math.max(...xs)) / 2);
      const ly = this.cy(Math.min(...ys)) - this.tile * 0.25;
      this.label(lx, ly, `${e.name} · ${Math.round(e.resolveAt - b.clock)} AP`, '#ffffff', 0.22, 'rgba(120,20,20,0.85)');
    }

    // Engagement links
    for (const [a, c] of engagedPairs(b)) {
      const ua = unitById(b, a);
      const uc = unitById(b, c);
      const pa = this.unitCenter(ua);
      const pc = this.unitCenter(uc);
      this.links.lineStyle(2, hex(COLORS.engage), 0.55);
      this.links.lineBetween(pa.x, pa.y, pc.x, pc.y);
    }

    const u = b.active && b.outcome === 'ongoing' ? unitById(b, b.active.unitId) : null;
    if (!u || u.side !== 'player' || s.busy || s.botParty) return;
    const a = b.active!;

    if (s.mode.kind === 'move') {
      const reach = reachable(b, u.id);
      const tiles = [...reach.values()].map((r) => r.path[r.path.length - 1]!).filter((p) => !eq(p, u.pos));
      this.fillTiles(this.overlay, tiles, hex(COLORS.move), 0.22);
      // Attackable enemies from here (click them to attack).
      if (!a.acted) for (const opt of attackOptions(b, u)) this.markTargets(opt, 0.25);
      const hov = s.hoverTile;
      const r = hov ? reach.get(key(hov)) : undefined;
      if (hov && r && !eq(hov, u.pos)) {
        const safety = pathSafety(r);
        this.overlay.lineStyle(4, safety < 1 ? hex(COLORS.amber) : 0xffffff, 0.9);
        for (let i = 1; i < r.path.length; i++) {
          const p0 = r.path[i - 1]!;
          const p1 = r.path[i]!;
          this.overlay.lineBetween(this.cx(p0.x), this.cy(p0.y), this.cx(p1.x), this.cy(p1.y));
        }
        for (const risk of r.risks) {
          const p = r.path[risk.index]!;
          this.label(this.cx(p.x), this.cy(p.y) - this.tile * 0.3, `held ${Math.round(risk.chance * 100)}%`, '#ffcf66', 0.18);
        }
        const pending = pendingFor({ battle: b, hoverTile: hov, mode: { kind: 'move' }, busy: false });
        const color = pending?.danger === 'hit' ? '#ff6b5b' : pending?.danger === 'risk' ? '#ffb347' : '#ffffff';
        const note = pending?.danger === 'hit' ? ' ⚠ no escape' : pending?.danger === 'risk' ? ' ⚠ escape risk' : '';
        this.label(this.cx(hov.x), this.cy(hov.y) + this.tile * 0.05, `${pending?.extra ?? r.cost} AP${note}`, color, 0.2);
      } else if (hov && !a.acted) {
        const p = previewAttack(b, u, hov);
        if (p) this.drawAttackPreview(p);
      }
    } else if (s.mode.kind === 'attack' || s.mode.kind === 'skill') {
      const skillId = s.mode.kind === 'skill' ? s.mode.skillId : null;
      const modeId = s.mode.kind === 'attack' ? s.mode.modeId : undefined;
      const selected = attackModes(b, u).find(m => m.id === modeId);
      if (!skillId && selected?.pattern === 'ring8') {
        this.fillTiles(this.overlay, patternTiles('ring8', u.pos, 0).map(p => p.tile).filter(p => p.x >= 0 && p.y >= 0 && p.x < b.map.width && p.y < b.map.height), hex(COLORS.aim), 0.25, hex(COLORS.aim));
        this.label(this.cx(u.pos.x), this.cy(u.pos.y), `${selected.name} · ${selected.apCost} AP · click self or ring to commit`, '#ffd166', 0.2);
      }
      const opts = skillId ? skillOptions(b, u, skillId) : attackOptions(b, u).filter(o => o.modeId === (modeId ?? attackModes(b,u)[0]!.id));
      for (const opt of opts) this.markTargets(opt, 0.3);
      if (!skillId && u.attack.pattern !== 'ranged') {
        // Show the aimable directions.
        const dirs = opts.map((o) => o.anchor);
        this.fillTiles(this.overlay, dirs, hex(COLORS.aim), 0.18);
      }
      const hov = s.hoverTile;
      if (hov) {
        const p = skillId ? previewSkill(b, u, skillId, hov) : previewAttack(b, u, hov, u.pos, modeId);
        if (p) this.drawAttackPreview(p);
      }
    }
  }

  private markTargets(p: AttackPreview, alpha: number): void {
    const b = this.battle()!;
    for (const t of p.targets) {
      const tu = unitById(b, t.unitId);
      if (tu.side === 'player') continue;
      this.fillTiles(this.overlay, tilesOf(tu), hex(COLORS.aim), alpha);
    }
  }

  private drawAttackPreview(p: AttackPreview): void {
    const b = this.battle()!;
    const guaranteedTiles = p.candidates ? p.targets.flatMap(t => tilesOf(unitById(b,t.unitId))) : p.tiles;
    this.fillTiles(this.overlay, guaranteedTiles, hex(COLORS.aim), 0.45, hex(COLORS.aim));
    for (const t of p.targets) {
      const tu = unitById(b, t.unitId);
      if (!alive(tu)) continue;
      const c = this.unitCenter(tu);
      const txt = p.kind === 'skill' && p.area ? '' : `${tu.name}: ${p.candidates ? 'Primary ' : ''}${Math.round(t.landChance * 100)}% · ${t.damageIfLands} dmg${t.kills ? ' ☠' : ''}`;
      if (txt) this.label(c.x, c.y - this.tile * 0.55, txt, t.kills ? '#ffd166' : '#ffffff', 0.21, 'rgba(0,0,0,0.75)');
    }
    const u = b.active ? unitById(b, b.active.unitId) : null;
    if (u && u.attack.pattern === 'ranged' && p.kind === 'attack') {
      const tgt = p.targets[0];
      if (tgt) {
        const tu = unitById(b, tgt.unitId);
        this.overlay.lineStyle(2, hex(COLORS.aim), 0.8);
        this.overlay.lineBetween(this.cx(u.pos.x), this.cy(u.pos.y), this.unitCenter(tu).x, this.unitCenter(tu).y);
      }
    }
    if (p.candidates && u) this.label(this.cx(u.pos.x),this.cy(u.pos.y)+this.tile*.85,'Dashed: one random', '#ffd166',.20,'rgba(0,0,0,0.85)');
    for (const candidate of p.candidates ?? []) {
      const tu = unitById(b,candidate.unitId), c = this.unitCenter(tu), size = this.tile * .8;
      this.overlay.lineStyle(2, hex(COLORS.aim), 1);
      for (let d = 0; d < size; d += 10) {
        const end = Math.min(d+5,size), x = c.x-size/2, y = c.y-size/2;
        this.overlay.lineBetween(x+d,y,x+end,y); this.overlay.lineBetween(x+d,y+size,x+end,y+size);
        this.overlay.lineBetween(x,y+d,x,y+end); this.overlay.lineBetween(x+size,y+d,x+size,y+end);
      }
      this.label(c.x,c.y+this.tile*.48,`${tu.name}: ${Math.round(candidate.probability*100)}% secondary`, '#ffd166',.20,'rgba(0,0,0,0.85)');
    }
    if (p.note && !p.candidates) {
      const a = p.tiles[0]!;
      this.label(this.cx(a.x), this.cy(a.y) + this.tile * 0.42, p.candidates ? 'One random secondary' : p.note, '#ffd166', 0.17);
    }
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

  private wait(ms: number): Promise<void> {
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

  private float(x: number, y: number, text: string, color: string, big = false): void {
    const t = this.add
      .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${Math.round(this.tile * (big ? 0.42 : 0.3))}px`, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(30);
    this.animationObjects.add(t);
    this.tweens.add({ targets: t, y: y - this.tile * 0.7, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => { this.animationObjects.delete(t); t.destroy(); } });
  }

  async play(events: GameEvent[], before: BattleState, after: BattleState, speed: number): Promise<void> {
    if (!this.sys.isActive()) return;
    const epoch = this.animationEpoch;
    this.animating = true;
    const k = 1 / Math.max(0.25, speed);
    const view = structuredClone(before);
    const strikeCounts = new Map<string,number>();
    const find = (id: string) => view.units.find((x) => x.id === id);
    try {
      for (const e of events) {
        switch (e.t) {
          case 'reload':
          case 'swapWeapon': {
            const u = find(e.unitId);
            if (u) this.float(this.unitCenter(u).x,this.unitCenter(u).y-this.tile*.3,e.t === 'reload' ? 'RELOADED' : `SWAP: ${e.newName}`,'#73baff');
            break;
          }
          case 'move': {
            const u = find(e.unitId);
            const tok = this.tokens.get(e.unitId);
            if (!u || !tok) break;
            for (let i = 1; i < e.path.length; i++) {
              const p = e.path[i]!;
              const c = this.unitCenter(u, p);
              await this.tween({ targets: tok.root, x: c.x, y: c.y, duration: 95 * k, ease: 'Sine.easeInOut' });
            }
            u.pos = e.path[e.path.length - 1]!;
            break;
          }
          case 'disengage': {
            const u = find(e.unitId);
            if (u) this.float(this.unitCenter(u).x, this.unitCenter(u).y - this.tile * 0.3, e.held ? 'HELD!' : 'slipped free', e.held ? '#ffb347' : '#cfe8ff');
            await this.wait(e.held ? 380 * k : 160 * k);
            break;
          }
          case 'attack': {
            const u = find(e.attackerId);
            const tok = this.tokens.get(e.attackerId);
            if (!u || !tok) break;
            const from = this.unitCenter(u);
            const tx = this.cx(e.targetTile.x);
            const ty = this.cy(e.targetTile.y);
            const isAoe = after.effects.some((f) => !before.effects.some((g) => g.id === f.id));
            if (u.footprint.length > 1 || isAoe) {
              await this.tween({ targets: tok.root, scale: { from: 1, to: 1.06 }, duration: 120 * k, yoyo: true });
            } else {
              const dx = (tx - from.x) * 0.32;
              const dy = (ty - from.y) * 0.32;
              await this.tween({ targets: tok.root, x: from.x + dx, y: from.y + dy, duration: 90 * k, yoyo: true, ease: 'Quad.easeOut' });
            }
            break;
          }
          case 'strike': {
            const count = (strikeCounts.get(e.attackerId) ?? 0)+1;
            strikeCounts.set(e.attackerId,count);
            const attacker = find(e.attackerId);
            if (count === 2 && attacker?.attack.pattern === 'dualArc') {
              this.float(this.unitCenter(attacker).x,this.unitCenter(attacker).y-this.tile*.5,'SECOND STRIKE','#ffd166');
              await this.wait(200*k);
            }
            const t = find(e.targetId);
            const tok = this.tokens.get(e.targetId);
            if (!t || !tok) break;
            const c = this.unitCenter(t);
            if (!e.hit) this.float(c.x, c.y - this.tile * 0.2, 'MISS', '#c9c9c9');
            else if (e.avoided) {
              this.float(c.x, c.y - this.tile * 0.2, e.avoided.toUpperCase(), '#8fd3ff');
              if (e.displacedTo) {
                const d = this.unitCenter(t, e.displacedTo);
                t.pos = e.displacedTo;
                await this.tween({ targets: tok.root, x: d.x, y: d.y, duration: 120 * k });
              }
            } else {
              this.float(c.x, c.y - this.tile * 0.2, `-${e.damage}`, e.crit ? '#ffd166' : '#ff7a6b', !!e.crit);
              t.hp = e.hpAfter ?? t.hp;
              this.paintToken(tok, t, false, false);
              await this.tween({ targets: tok.root, alpha: { from: 0.35, to: 1 }, duration: 70 * k, yoyo: true, repeat: 1 });
            }
            await this.wait(140 * k);
            break;
          }
          case 'ko': {
            const t = find(e.unitId);
            const tok = this.tokens.get(e.unitId);
            if (t && tok) {
              t.ko = true;
              await this.tween({ targets: tok.root, alpha: 0.22, duration: 300 * k });
            }
            break;
          }
          case 'status': {
            const t = find(e.unitId);
            if (t && e.status !== 'recovered') {
              const c = this.unitCenter(t);
              this.float(c.x, c.y - this.tile * 0.5, e.status === 'dazed' ? `DAZED +${e.pushback} AP` : 'PANICS', '#ffd166');
              await this.wait(220 * k);
            }
            break;
          }
          case 'displace': {
            const t = find(e.unitId);
            const tok = this.tokens.get(e.unitId);
            if (t && tok) {
              const d = this.unitCenter(t, e.to);
              t.pos = e.to;
              await this.tween({ targets: tok.root, x: d.x, y: d.y, duration: 140 * k, ease: 'Back.easeOut' });
            }
            break;
          }
          case 'effectCast': {
            const g = this.add.graphics().setDepth(15);
            this.animationObjects.add(g);
            this.fillTiles(g, e.effect.tiles, hex(COLORS.danger), 0.7);
            const xs = e.effect.tiles.map((p) => p.x);
            const ys = e.effect.tiles.map((p) => p.y);
            this.float(this.cx((Math.min(...xs) + Math.max(...xs)) / 2), this.cy((Math.min(...ys) + Math.max(...ys)) / 2), `${e.effect.name}!`, '#ffdddd', true);
            await this.tween({ targets: g, alpha: { from: 1, to: 0 }, duration: 520 * k });
            this.animationObjects.delete(g);
            g.destroy();
            break;
          }
          case 'effectResolve': {
            const g = this.add.graphics().setDepth(15);
            this.animationObjects.add(g);
            this.fillTiles(g, e.tiles, 0xffe2b0, 0.85);
            const big = e.tiles.length > 12;
            this.cameras.main.shake(big ? 380 : 220, big ? 0.014 : 0.006);
            for (const h of e.hits) {
              const t = find(h.unitId);
              const tok = this.tokens.get(h.unitId);
              if (!t || !tok) continue;
              const c = this.unitCenter(t);
              this.float(c.x, c.y - this.tile * 0.2, `-${h.damage}`, '#ff5a4a', true);
              t.hp = h.hpAfter;
              this.paintToken(tok, t, false, false);
            }
            await this.tween({ targets: g, alpha: { from: 1, to: 0 }, duration: 520 * k });
            this.animationObjects.delete(g);
            g.destroy();
            break;
          }
          case 'turnStart': {
            const tok = this.tokens.get(e.unitId);
            const u = find(e.unitId);
            if (tok && u) {
              this.paintToken(tok, u, true, false);
              await this.tween({ targets: tok.root, scale: { from: 1, to: 1.08 }, duration: 90 * k, yoyo: true });
            }
            break;
          }
          default:
            break;
        }
      }
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
