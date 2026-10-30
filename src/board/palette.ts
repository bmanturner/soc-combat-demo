// Shared colors for board and HUD. Readability first: party teal, enemies crimson, danger red, aim amber.

export const COLORS = {
  bg: '#14110e',
  wall: '#231d18',
  cover: '#6d5536',
  floor: {
    granary: '#6b5a3e',
    wolves: '#7a6a48',
    cultists: '#57493f',
    nephilim: '#4b4a51',
    default: '#5e5040',
  },
  party: '#57c4bf',
  partyDark: '#1f3d3c',
  enemy: '#d0573f',
  enemyDark: '#3f1e18',
  boss: '#5a2a22',
  gold: '#f2c14e',
  danger: '#d63b2f',
  amber: '#ffae42',
  move: '#4fa3ff',
  aim: '#ffb347',
  engage: '#ff8a65',
  ready: '#7bc47f',
  caught: '#ffb3a6',
} as const;

export function hex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}
