import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ENCOUNTERS } from './content/encounters';
import { controller } from './game/controller';
import { decodeShare } from './game/share';
import { showToast, store } from './game/store';
import { App } from './hud/App';
import './hud/styles.css';

// Restore a shared link: encounter, loadout, seed and rule overrides.
const shared = decodeShare(location.hash);
if (shared.invalid) showToast('Invalid share-link values were replaced with defaults.');
store.setState({
  config: shared.config,
  secondaryWeaponId: shared.secondaryWeaponId ?? null,
  equippedSlot: shared.equippedSlot ?? 0,
  ...(shared.weaponId && { weaponId: shared.weaponId }),
  ...(shared.armor && { armor: shared.armor }),
  ...(shared.seed !== undefined && { seed: shared.seed }),
});
if (shared.encounterId && ENCOUNTERS.some((e) => e.id === shared.encounterId)) controller.openSetup(shared.encounterId);

window.addEventListener('hashchange', () => {
  const next = decodeShare(location.hash);
  if (store.getState().battle?.outcome === 'ongoing' && !window.confirm('Load shared setup and replace the current fight?')) {
    history.replaceState(null, '', controller.shareLink());
    return;
  }
  controller.openMenu();
  store.setState({ config: next.config, weaponId: next.weaponId ?? 'daggers', secondaryWeaponId: next.secondaryWeaponId ?? null, equippedSlot: next.equippedSlot ?? 0, armor: next.armor ?? 'clothing', seed: next.seed ?? 1, botParty: false });
  if (next.encounterId) controller.openSetup(next.encounterId);
  if (next.invalid) showToast('Invalid share-link values were replaced with defaults.');
});

// Test/debug handle (Playwright drives the game through this; harmless in production).
(window as unknown as { __soc: unknown }).__soc = { store, controller };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
