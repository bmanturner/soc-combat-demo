// Lets HUD surfaces point at board tiles without knowing which renderer (2D or 3D) is mounted.

/** Tile-space point (tile centers at x + 0.5) to CSS pixels relative to the board element. */
export type BoardProjector = (p: { x: number; y: number }) => { x: number; y: number };

let projector: BoardProjector | null = null;

export function registerBoardProjector(p: BoardProjector): void {
  projector = p;
}

/** Clear the projector only if it is still `p` (a newer board may have replaced it). */
export function unregisterBoardProjector(p: BoardProjector): void {
  if (projector === p) projector = null;
}

/** Viewport rectangle enclosing a tile-space rectangle on the mounted board, or null when no board is ready. */
export function boardRect(x0: number, y0: number, x1: number, y1: number): DOMRect | null {
  const board = document.querySelector('[data-testid=board]');
  if (!projector || !board) return null;
  const origin = board.getBoundingClientRect();
  const corners = [
    projector({ x: x0, y: y0 }),
    projector({ x: x1, y: y0 }),
    projector({ x: x0, y: y1 }),
    projector({ x: x1, y: y1 }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return new DOMRect(origin.x + left, origin.y + top, Math.max(...xs) - left, Math.max(...ys) - top);
}
