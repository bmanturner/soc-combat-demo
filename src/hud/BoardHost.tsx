import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { BoardScene } from '../board/BoardScene';
import { COLORS } from '../board/palette';
import { controller } from '../game/controller';
import { showToast } from '../game/store';
import { useGame } from './hooks';

/** Hosts the selected board renderer; switching remounts, and the outgoing board cancels its animation. */
export function BoardHost() {
  const view = useGame((s) => s.boardView);
  return view === '3d' ? <ThreeBoardHost key="3d" /> : <PhaserBoardHost key="2d" />;
}

/** Hosts the Phaser canvas. One game instance per mount; destroyed on unmount (StrictMode-safe). */
function PhaserBoardHost() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current,
      backgroundColor: COLORS.bg,
      scale: { mode: Phaser.Scale.RESIZE, width: ref.current.clientWidth || 800, height: ref.current.clientHeight || 600 },
      render: { antialias: true },
      scene: [BoardScene],
      banner: false,
    });
    return () => game.destroy(true);
  }, []);
  return <div className="board" ref={ref} data-testid="board" />;
}

/** Hosts the three.js board, loaded on demand so 2D players never download it. */
function ThreeBoardHost() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let board: { destroy(): void } | null = null;
    let disposed = false;
    import('../board3d/ThreeBoard')
      .then(({ ThreeBoard }) => {
        if (!disposed) board = new ThreeBoard(host);
      })
      .catch((err: unknown) => {
        console.error('3D board unavailable', err);
        if (disposed) return;
        showToast('3D board unavailable here (WebGL failed); switched to 2D.');
        controller.setBoardView('2d');
      });
    return () => {
      disposed = true;
      board?.destroy();
    };
  }, []);
  return <div className="board board-3d" ref={ref} data-testid="board" />;
}
