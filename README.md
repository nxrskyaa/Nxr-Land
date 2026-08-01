# Nxr Land

A cozy 3D farming and collection vertical slice built with Three.js and Vite. Grow crops, complete Chapter 1 quests, claim daily and playtime rewards, wish for pets and wardrobe items, and place buildings on land you own.

**Live:** https://nxr-land.vercel.app

## Features

- **Character creator** — skin, hair, outfit, accessory; live preview in the 3D village.
- **Farming loop** — hoe, plant, water, harvest, sell.
- **Village economy** — buy/sell through the market, tool & seed hotbar, satchel inventory.
- **Chapter 1 quests** — 8 sequential quests with NPCs, rewards, and unlocks.
- **Rewards** — 7-day local-day daily streak + foreground playtime milestones, exactly-once durable claims.
- **Collections (gacha)** — separate pet and wardrobe pools, transparent rates, pity, duplicates → Style Dust, equip that changes the in-world character.
- **Building & land** — place/rotate/sell structures with collision + bounds validation, two land expansions, starter-house upgrade; transforms survive reload.

## Controls

- **Move:** WASD / arrow keys (desktop), on-screen joystick (touch).
- **Interact / use tool:** tap NPCs, plots, and buildings; hotbar slots `1`–`4`.
- **Panels:** rewards, collection wishes, wardrobe, market, inventory in the surrounding UI.

## Architecture

- **Rendering:** Three.js scene (`src/game/World.js`, `src/visuals/`) with a code-generated village diorama.
- **State:** single versioned state object (`src/game/createState.js`), persisted to `localStorage` (`nxr-land-save-v1`) via `SaveManager` with schema migration.
- **Systems:** transactional `EventBus` (snapshot → mutate → save → rollback; events emitted only after durable save) drives farming, economy, quests, rewards, gacha, and building systems in `src/systems/`.
- **UI:** framework-free DOM panels in `src/ui/` subscribed to state events.

## Local development

```bash
npm install
npm run dev      # Vite dev server
npm test -- --run  # full test suite (271 tests)
npm run check    # syntax check all sources
npm run build    # production bundle to dist/
```

## Deployment

Static build deployed to Vercel (`vercel.json`). Push to `main`; deploy production with the Vercel CLI or dashboard.
