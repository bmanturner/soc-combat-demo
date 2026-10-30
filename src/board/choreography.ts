// Renderer-neutral animation script: turns rules events into staging primitives.
// Both boards implement `Stage`; timings and wording live here so 2D and 3D stay in step.

import type { Vec } from '../rules/geometry';
import type { BattleState, GameEvent, UnitState } from '../rules/types';
import { COLORS } from './palette';
import { tileCenter, unitCenter, type Pt } from './view-model';

export type Ease = 'linear' | 'sine' | 'quad' | 'back';

/**
 * Staging primitives in tile space. Promise-returning primitives must reject when the
 * renderer cancels its animations. Durations are per leg (yoyo tweens take twice as long).
 */
export interface Stage {
  /** Fire-and-forget rising text. */
  float(at: Pt, text: string, color: string, big?: boolean): void;
  moveToken(id: string, to: Pt, ms: number, ease: Ease): Promise<void>;
  /** Lean toward `toward` and return. */
  lungeToken(id: string, toward: Pt, ms: number): Promise<void>;
  /** Scale up to `scale` and back. */
  pulseToken(id: string, scale: number, ms: number): Promise<void>;
  /** Hit flash: dim and recover twice. */
  blinkToken(id: string, ms: number): Promise<void>;
  fadeToken(id: string, alpha: number, ms: number): Promise<void>;
  paintToken(id: string, unit: UnitState, active: boolean): void;
  /** Flash tiles then fade them out over `ms`. */
  flashTiles(tiles: Vec[], color: string, alpha: number, ms: number): Promise<void>;
  shake(ms: number, intensity: number): void;
  wait(ms: number): Promise<void>;
  /**
   * Optional, for renderers with posed figures: `id` is about to perform the named attack or skill at `target`.
   * Called just before its lunge or pulse, whose leg lasts `ms`.
   */
  strikePose?(id: string, attack: string, target: Pt, ms: number): void;
  /** Optional: a delayed effect cast by `sourceId` lands now (`ms` is the impact flash). */
  effectLands?(sourceId: string, effect: string, ms: number): void;
}

const above = (p: Pt, dy: number): Pt => ({ x: p.x, y: p.y - dy });

function center(tiles: Vec[]): Pt {
  const xs = tiles.map((p) => p.x);
  const ys = tiles.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2 + 0.5, y: (Math.min(...ys) + Math.max(...ys)) / 2 + 0.5 };
}

/** Play `events` against a private copy of `before`. Rejections propagate to the caller. */
export async function choreograph(stage: Stage, events: GameEvent[], before: BattleState, after: BattleState, speed: number): Promise<void> {
  const k = 1 / Math.max(0.25, speed);
  const view = structuredClone(before);
  const strikeCounts = new Map<string, number>();
  const find = (id: string) => view.units.find((x) => x.id === id);
  for (const e of events) {
    switch (e.t) {
      case 'reload':
      case 'swapWeapon': {
        const u = find(e.unitId);
        if (u) stage.float(above(unitCenter(u), 0.3), e.t === 'reload' ? 'RELOADED' : `SWAP: ${e.newName}`, '#73baff');
        break;
      }
      case 'move': {
        const u = find(e.unitId);
        if (!u) break;
        for (let i = 1; i < e.path.length; i++) await stage.moveToken(e.unitId, unitCenter(u, e.path[i]!), 95 * k, 'sine');
        u.pos = e.path[e.path.length - 1]!;
        break;
      }
      case 'disengage': {
        const u = find(e.unitId);
        if (u) stage.float(above(unitCenter(u), 0.3), e.held ? 'HELD!' : 'slipped free', e.held ? '#ffb347' : '#cfe8ff');
        await stage.wait(e.held ? 380 * k : 160 * k);
        break;
      }
      case 'attack': {
        const u = find(e.attackerId);
        if (!u) break;
        const isAoe = after.effects.some((f) => !before.effects.some((g) => g.id === f.id));
        const from = unitCenter(u);
        const to = tileCenter(e.targetTile);
        if (u.footprint.length > 1 || isAoe) {
          stage.strikePose?.(e.attackerId, e.name, to, 120 * k);
          await stage.pulseToken(e.attackerId, 1.06, 120 * k);
        } else {
          // A third of the way toward the target, capped at an adjacent diagonal's lean so ranged attackers don't dash.
          const f = Math.min(0.32, 0.45 / Math.max(1e-6, Math.hypot(to.x - from.x, to.y - from.y)));
          stage.strikePose?.(e.attackerId, e.name, to, 90 * k);
          await stage.lungeToken(e.attackerId, { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f }, 90 * k);
        }
        break;
      }
      case 'strike': {
        const count = (strikeCounts.get(e.attackerId) ?? 0) + 1;
        strikeCounts.set(e.attackerId, count);
        const attacker = find(e.attackerId);
        if (count === 2 && attacker?.attack.pattern === 'dualArc') {
          stage.float(above(unitCenter(attacker), 0.5), 'SECOND STRIKE', '#ffd166');
          await stage.wait(200 * k);
        }
        const t = find(e.targetId);
        if (!t) break;
        const c = unitCenter(t);
        if (!e.hit) stage.float(above(c, 0.2), 'MISS', '#c9c9c9');
        else if (e.avoided) {
          stage.float(above(c, 0.2), e.avoided.toUpperCase(), '#8fd3ff');
          if (e.displacedTo) {
            t.pos = e.displacedTo;
            await stage.moveToken(e.targetId, unitCenter(t), 120 * k, 'linear');
          }
        } else {
          stage.float(above(c, 0.2), `-${e.damage}`, e.crit ? '#ffd166' : '#ff7a6b', !!e.crit);
          t.hp = e.hpAfter ?? t.hp;
          stage.paintToken(e.targetId, t, false);
          await stage.blinkToken(e.targetId, 70 * k);
        }
        await stage.wait(140 * k);
        break;
      }
      case 'ko': {
        const t = find(e.unitId);
        if (t) {
          t.ko = true;
          await stage.fadeToken(e.unitId, 0.22, 300 * k);
        }
        break;
      }
      case 'status': {
        const t = find(e.unitId);
        if (t && e.status !== 'recovered') {
          stage.float(above(unitCenter(t), 0.5), e.status === 'dazed' ? `DAZED +${e.pushback} AP` : 'PANICS', '#ffd166');
          await stage.wait(220 * k);
        }
        break;
      }
      case 'displace': {
        const t = find(e.unitId);
        if (t) {
          t.pos = e.to;
          await stage.moveToken(e.unitId, unitCenter(t), 140 * k, 'back');
        }
        break;
      }
      case 'effectCast': {
        stage.float(center(e.effect.tiles), `${e.effect.name}!`, '#ffdddd', true);
        await stage.flashTiles(e.effect.tiles, COLORS.danger, 0.7, 520 * k);
        break;
      }
      case 'effectResolve': {
        const big = e.tiles.length > 12;
        const source = view.effects.find((f) => f.id === e.effectId)?.sourceId;
        if (source) stage.effectLands?.(source, e.name, 520 * k);
        stage.shake(big ? 380 : 220, big ? 0.014 : 0.006);
        for (const h of e.hits) {
          const t = find(h.unitId);
          if (!t) continue;
          stage.float(above(unitCenter(t), 0.2), `-${h.damage}`, '#ff5a4a', true);
          t.hp = h.hpAfter;
          stage.paintToken(h.unitId, t, false);
        }
        await stage.flashTiles(e.tiles, '#ffe2b0', 0.85, 520 * k);
        break;
      }
      case 'turnStart': {
        const u = find(e.unitId);
        if (u) {
          stage.paintToken(e.unitId, u, true);
          await stage.pulseToken(e.unitId, 1.08, 90 * k);
        }
        break;
      }
      default:
        break;
    }
  }
}
