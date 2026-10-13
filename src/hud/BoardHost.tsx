import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { BoardScene } from '../board/BoardScene';
import { COLORS } from '../board/palette';

/** Hosts the Phaser canvas. One game instance per mount; destroyed on unmount (StrictMode-safe). */
export function BoardHost() {
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
