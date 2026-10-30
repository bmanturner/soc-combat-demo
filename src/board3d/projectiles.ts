// Low-poly projectiles for ranged strikes, built pointing along +z (the board orients them along their flight).
// World-sized to match figures at the board's figure scale.

import * as THREE from 'three';
import { TONE, box, cone, ico, rod, type Projectile } from './rig';

export interface ProjectileMesh {
  object: THREE.Group;
  /** Arc height per tile of distance. */
  lift: number;
  /** Tumble rate (radians per flight) around local x; 0 flies point first. */
  spin: number;
}

const material = (color: string, metalness = 0, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });

export function makeProjectile(kind: Projectile): ProjectileMesh {
  const object = new THREE.Group();
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    object.add(mesh);
  };
  const wood = material(TONE.wood);
  const bronze = material(TONE.bronze, 0.25, 0.45);
  switch (kind) {
    case 'arrow':
    case 'bolt': {
      const len = kind === 'arrow' ? 0.38 : 0.24;
      add(rod(kind === 'arrow' ? 0.0065 : 0.009, [0, 0, -len / 2], [0, 0, len / 2], 4), wood);
      add(cone(0.016, 0.045, 4).rotateX(Math.PI / 2).translate(0, 0, len / 2 + 0.02), bronze);
      const fletch = material(TONE.string);
      for (const r of [0, Math.PI / 2]) add(box(0.004, 0.03, 0.06).rotateZ(r).translate(0, 0, -len / 2 + 0.035), fletch);
      return { object, lift: kind === 'arrow' ? 0.07 : 0.025, spin: 0 };
    }
    case 'knife':
      add(box(0.011, 0.035, 0.13).translate(0, 0, 0.045), bronze);
      add(rod(0.014, [0, 0, -0.06], [0, 0, -0.015], 5), material(TONE.leather));
      return { object, lift: 0.06, spin: Math.PI * 4 };
    case 'javelin':
      add(rod(0.012, [0, 0, -0.36], [0, 0, 0.32], 5), wood);
      add(cone(0.027, 0.1, 4).rotateX(Math.PI / 2).translate(0, 0, 0.37), bronze);
      return { object, lift: 0.13, spin: 0 };
    case 'orb': {
      // Daze bolt: a pale, unlit mote with a soft shell.
      add(ico(0.06, 1), new THREE.MeshBasicMaterial({ color: '#f3e2b8', toneMapped: false }));
      const shell = new THREE.Mesh(ico(0.1, 1), new THREE.MeshBasicMaterial({ color: '#e8c98a', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
      object.add(shell);
      return { object, lift: 0.08, spin: 0 };
    }
    case 'boulder':
      add(ico(0.17).scale(1, 0.85, 1.1), material('#6f685e', 0, 0.95));
      return { object, lift: 0.3, spin: Math.PI * 3 };
  }
}
