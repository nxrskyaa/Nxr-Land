# Nxr Land Vertical Slice Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ship a polished, playable Three.js cozy-farming vertical slice with character customization, story quests, rewards, gacha, pets, building, persistence, mobile controls, GitHub source, and a verified Vercel production deployment.

**Architecture:** A Vite application owns one Three.js scene and a framework-independent game loop. Domain systems operate on a serializable authoritative state and emit events consumed by quests, UI, audio, and persistence. The DOM interface is layered over WebGL and all content catalogs are data-driven.

**Tech Stack:** Vite, Three.js, vanilla JavaScript ES modules, Vitest, jsdom, CSS, localStorage, GitHub, Vercel.

---

### Task 1: Scaffold the application and quality commands

**Objective:** Create a reproducible Vite/Three.js project with unit, build, and static-check commands.

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/styles.css`
- Create: `vitest.config.js`
- Create: `vercel.json`

**Steps:**
1. Define scripts: `dev`, `build`, `test`, and `check` (`node --check` over source modules).
2. Add `three` and dev dependencies `vite`, `vitest`, and `jsdom`.
3. Add a loading shell and module entrypoint.
4. Run `npm install`; expect lockfile creation with no audit-blocking error.
5. Run `npm test -- --run`; expect zero failing tests.
6. Run `npm run build`; expect `dist/index.html` and a bundled JS asset.
7. Commit: `chore: scaffold Nxr Land`.

### Task 2: Define catalogs and authoritative state

**Objective:** Make crops, items, pets, wardrobe, buildings, quests, and initial state data-driven.

**Files:**
- Create: `src/data/crops.js`
- Create: `src/data/items.js`
- Create: `src/data/pets.js`
- Create: `src/data/buildings.js`
- Create: `src/data/quests.js`
- Create: `src/game/createState.js`
- Test: `tests/state.test.js`

**Steps:**
1. Write tests asserting six crops, eight pets, twenty wardrobe items, eight placeables, and eight ordered quests have unique IDs and required fields.
2. Run the test and verify failure because catalogs do not exist.
3. Add immutable catalog objects and a versioned initial state containing player, world, economy, crops, collection, quests, rewards, gacha, and settings.
4. Run tests; expect all catalog and initial-state assertions to pass.
5. Commit: `feat: add game catalogs and initial state`.

### Task 3: Implement event bus and persistence

**Objective:** Support decoupled domain events, validated save/load, backup recovery, and schema migration.

**Files:**
- Create: `src/game/EventBus.js`
- Create: `src/game/SaveManager.js`
- Test: `tests/save-manager.test.js`

**Steps:**
1. Write tests for subscribe/emit/unsubscribe, save round-trip, corrupt primary recovery, and migration from schema zero.
2. Run targeted tests and verify failure.
3. Implement a small synchronous event bus and injected-storage SaveManager.
4. Save to `nxr-land-save-v1`, copy the previous valid value to a backup before replacement, and validate required top-level sections.
5. Run tests; expect pass.
6. Commit: `feat: add resilient local persistence`.

### Task 4: Build the Three.js scene and diorama factories

**Objective:** Render an attractive orthographic village with reusable original geometry.

**Files:**
- Create: `src/game/Game.js`
- Create: `src/game/World.js`
- Create: `src/visuals/materials.js`
- Create: `src/visuals/NatureFactory.js`
- Create: `src/visuals/BuildingFactory.js`
- Create: `src/visuals/VFX.js`

**Steps:**
1. Add renderer initialization with antialiasing, tone mapping, capped DPR, resize handling, and visible fatal-error fallback.
2. Add orthographic camera, hemisphere/key lighting, soft shadows on capable devices, fog, and a world underlay.
3. Construct Town Plaza, Home Plot, Market Lane, River Garden, expansion barriers, paths, bridge, pond, Heartroot, market, and starter house.
4. Use shared geometry/materials and instancing for repeated foliage.
5. Add water motion, foliage sway, clouds, butterflies, and fireflies.
6. Run `npm run build`; expect success.
7. Start local server and inspect the first rendered frame for non-black, non-empty output.
8. Commit: `feat: create soft 3d village diorama`.

### Task 5: Implement character factory, creator, movement, camera, and collision

**Objective:** Let desktop and mobile players create and move a readable customized character.

**Files:**
- Create: `src/visuals/CharacterFactory.js`
- Create: `src/entities/Player.js`
- Create: `src/game/Input.js`
- Create: `src/game/Collision.js`
- Create: `src/game/Camera.js`
- Create: `src/ui/CharacterCreator.js`
- Test: `tests/collision.test.js`

**Steps:**
1. Write tests for map bounds, solid rectangles, and spawn-clear validation.
2. Run tests and verify failure.
3. Build a layered chibi character from rounded head, hair, torso, separate legs, arms, outfit pieces, and accessories; cache appearance variants.
4. Add idle breathing and weighted acceleration/friction walk animation.
5. Add WASD/arrows, virtual joystick, action button, and tap-to-target.
6. Add smooth camera follow and collision sliding.
7. Verify a simulated held-right input changes player world position and the spawn has a valid exit.
8. Commit: `feat: add character creator and playable controls`.

### Task 6: Implement time, farming, tools, and crop visuals

**Objective:** Complete the buy-seed-to-harvest portion of the core loop.

**Files:**
- Create: `src/systems/TimeSystem.js`
- Create: `src/systems/FarmingSystem.js`
- Create: `src/entities/Crop.js`
- Create: `src/visuals/CropFactory.js`
- Test: `tests/farming.test.js`

**Steps:**
1. Write tests for invalid transitions and the complete empty→tilled→planted→watered→growing→harvestable cycle.
2. Run tests and verify failure.
3. Implement plot state transitions and compressed deterministic growth durations.
4. Add six distinct crop forms with several growth stages, sway, moisture feedback, harvest particles, and tool animations.
5. Emit farming events and save after mutations.
6. Run tests; expect pass.
7. Commit: `feat: add complete farming loop`.

### Task 7: Implement economy, inventory, market, and hotbar

**Objective:** Let the player purchase seeds, select tools, harvest inventory, sell produce, and receive atomic currency updates.

**Files:**
- Create: `src/systems/EconomySystem.js`
- Create: `src/ui/InventoryUI.js`
- Create: `src/ui/ShopUI.js`
- Create: `src/ui/HotbarUI.js`
- Test: `tests/economy.test.js`

**Steps:**
1. Write tests for successful purchase/sale and rejected insufficient-funds/insufficient-stock transactions.
2. Run tests and verify failure.
3. Implement validate-first atomic transactions.
4. Add market, inventory, and tool/seed hotbar panels with keyboard and touch selection.
5. Verify one integration path: buy turnip seed, plant, advance time, harvest, sell, and end with expected inventory/currency.
6. Commit: `feat: add inventory and village economy`.

### Task 8: Implement NPCs, dialogue, and Chapter 1 quests

**Objective:** Deliver three live NPCs and eight explicit story quests.

**Files:**
- Create: `src/entities/NPC.js`
- Create: `src/systems/QuestSystem.js`
- Create: `src/ui/DialogueUI.js`
- Create: `src/ui/QuestUI.js`
- Test: `tests/quests.test.js`

**Steps:**
1. Write tests mapping domain events to all eight quest progressions and reward claims.
2. Run tests and verify failure.
3. Create Mira, Tomo, and Lumi with distinct silhouettes, idle paths, role labels, dialogue, and quest markers.
4. Implement quest acceptance, progress, completion, turn-in, rewards, tracker, and destination beacon.
5. Run tests and a scripted Chapter 1 completion path; expect final Heartroot restoration state.
6. Commit: `feat: add Sleeping Seed story chapter`.

### Task 9: Implement daily and active-playtime rewards

**Objective:** Add reliable seven-day check-in and 5/15/30/45/60-minute milestones.

**Files:**
- Create: `src/systems/RewardSystem.js`
- Create: `src/ui/RewardUI.js`
- Test: `tests/rewards.test.js`

**Steps:**
1. Use an injected clock in tests for same-day duplicate prevention, next-day availability, streak progression, foreground-only active time, and milestone idempotency.
2. Run tests and verify failure.
3. Implement claim locks, local-day keys, visibility-aware accumulation, and reward grants.
4. Add an attractive reward calendar and milestone tray.
5. Run tests; expect pass.
6. Commit: `feat: add daily and playtime rewards`.

### Task 10: Implement wardrobe and pet gacha

**Objective:** Provide collection pulls, pity, duplicates-to-Style-Dust, pet followers, and outfit equipping.

**Files:**
- Create: `src/systems/GachaSystem.js`
- Create: `src/entities/Pet.js`
- Create: `src/ui/GachaUI.js`
- Create: `src/ui/WardrobeUI.js`
- Test: `tests/gacha.test.js`

**Steps:**
1. Write deterministic RNG tests for rates, pity guarantee, duplicate conversion, and atomic ticket/coin spending.
2. Run tests and verify failure.
3. Implement separate pet/wardrobe pools and transparent rate metadata.
4. Add staged reveal animation, rarity VFX, skip button, collection/equip UI, and a smoothly following active pet.
5. Verify equipped wardrobe survives reload and changes the same character factory used in-world.
6. Commit: `feat: add pet and wardrobe collections`.

### Task 11: Implement building and land progression

**Objective:** Let players place, rotate, persist, sell, and unlock structures on owned land.

**Files:**
- Create: `src/systems/BuildingSystem.js`
- Create: `src/ui/BuildingUI.js`
- Test: `tests/building.test.js`

**Steps:**
1. Write tests for ownership, bounds, overlap, collision, cost, rotation, selling refund, and persistence shape.
2. Run tests and verify failure.
3. Implement ghost preview, snap, valid/invalid tint, confirm/cancel, rotation, and collider registration.
4. Add two land purchases and one starter-house upgrade.
5. Run tests and verify a reload reconstructs identical object transforms.
6. Commit: `feat: add land and building progression`.

### Task 12: Add audio, day/night, weather, feedback, and final UI polish

**Objective:** Make the vertical slice feel alive and cohesive.

**Files:**
- Create: `src/systems/AudioSystem.js`
- Create: `src/systems/WeatherSystem.js`
- Create: `src/ui/UIManager.js`
- Modify: `src/styles.css`

**Steps:**
1. Add a relaxing low-volume Web Audio melody/pad loop resumed on user gesture plus UI, tool, harvest, quest, reward, and gacha SFX.
2. Add day/night light and sky interpolation, clear/rain weather, rain VFX, stronger night fireflies, lantern glow, and window lights.
3. Add restrained screen shake, particles, item toast, quest completion, and Heartroot restoration sequence.
4. Polish menus with a warm game-native visual language; avoid emoji action icons and generic dashboard cards.
5. Run build and inspect desktop and portrait layouts.
6. Commit: `feat: polish ambience audio and interface`.

### Task 13: Run complete automated and browser verification

**Objective:** Prove the game builds, persists, plays, and displays correctly.

**Files:**
- Create: `tests/core-loop.test.js`
- Create: `tests/dom.test.js`
- Create: `scripts/verify-source.mjs`

**Steps:**
1. Add integration coverage for character creation, seed purchase, farm cycle, sale, quest progress, reward claim, gacha, equip, building placement, save, and reload.
2. Add DOM tests for opening/closing each panel and core touch controls.
3. Run `npm test -- --run`; expect all tests pass.
4. Run `npm run check`; expect zero syntax errors.
5. Run `npm run build`; expect production bundle success.
6. Serve `dist`, verify every emitted asset returns HTTP 200, and inspect browser console.
7. Probe keyboard movement by comparing player position before and after held input.
8. Test portrait mobile viewport for controls, aspect, and non-black WebGL output.
9. Commit: `test: verify complete vertical slice`.

### Task 14: Create GitHub repository, push, deploy, and verify production

**Objective:** Publish source and a verified live game.

**Files:**
- Modify: `README.md`
- Confirm: `vercel.json`

**Steps:**
1. Add a README with controls, features, architecture, local commands, and screenshots if available.
2. Ensure no token or credential exists in tracked files using a secret-pattern scan.
3. Create `Nxrskyaa/Nxr-Land` through the GitHub API if it does not exist.
4. Configure origin and push `main`.
5. Verify the remote main commit through the GitHub API.
6. Run the real Vercel CLI with the supplied token, link `nxr-land`, and deploy production.
7. Open the production alias, enter the game, verify branding, inspect console, move the player, perform one interaction, and inspect a portrait viewport.
8. Record GitHub and Vercel URLs in the final delivery.
9. Instruct the owner to revoke and regenerate both chat-exposed tokens.

## Final acceptance checklist

- [ ] All unit and integration tests pass
- [ ] Production build succeeds
- [ ] No console errors in the core flow
- [ ] Desktop and mobile movement are proven by state change
- [ ] Farming, selling, quests, rewards, gacha, wardrobe, pets, building, and persistence work
- [ ] World is visually populated, animated, lit, and non-black on mobile emulation
- [ ] GitHub `main` contains no secrets
- [ ] Vercel production is live and manually verified
