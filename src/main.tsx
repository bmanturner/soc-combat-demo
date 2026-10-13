import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ENCOUNTERS } from './content/encounters';
import { controller } from './game/controller';
import { decodeShare } from './game/share';
import { store } from './game/store';
import { App } from './hud/App';
import './hud/styles.css';

// Restore a shared link: encounter, loadout, seed and rule overrides.
const shared = decodeShare(location.hash);
store.setState({
  config: shared.config,
  ...(shared.weaponId && { weaponId: shared.weaponId }),
  ...(shared.armor && { armor: shared.armor }),
  ...(shared.seed !== undefined && { seed: shared.seed }),
});
if (shared.encounterId && ENCOUNTERS.some((e) => e.id === shared.encounterId)) controller.openSetup(shared.encounterId);

// Test/debug handle (Playwright drives the game through this; harmless in production).
(window as unknown as { __soc: unknown }).__soc = { store, controller };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
