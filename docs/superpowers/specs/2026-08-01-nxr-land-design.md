# Nxr Land — Game Design and Technical Specification

**Date:** 2026-08-01  
**Status:** Approved  
**Owner:** Nxrskyaa

## 1. Product Vision

Nxr Land is a browser-based cozy farming and light city-building game inspired by the approachable life simulation of Animal Crossing, the farming loop of Stardew Valley, and the creature charm of Pokémon Pokopia. It uses Three.js to present an original soft 3D diorama world viewed through a fixed orthographic top-down camera.

The first release is a polished vertical slice rather than a shallow implementation of the complete long-term game. In one session, a player must be able to create a character, enter the village, meet an NPC, receive seeds, farm a crop, sell the harvest, claim rewards, obtain a pet or wardrobe item, buy an expansion, save progress, reload, and continue.

## 2. Release Strategy

### Initial vertical slice

- One complete village map
- Three NPCs
- Eight Chapter 1 story quests
- Six crops
- Eight pets
- Twenty wardrobe pieces
- Eight placeable decorations or buildings
- Two land expansions
- One house upgrade
- Seven-day check-in track
- Five daily playtime milestones
- Pet and wardrobe gacha, pity, and duplicate conversion
- Day/night cycle, weather, ambient animation, audio, and mobile controls

### Expansion path

The content layer must support more than 100 wardrobe items, additional pets, crops, NPCs, quests, buildings, and regions without modifications to the inventory, gacha, farming, or quest engines.

## 3. Visual Direction

### Style

- Soft stylized 3D diorama
- Rounded low-poly forms with intentional silhouettes; no crude capsule characters or primitive-only final art
- Fresh green terrain, warm wood, turquoise water, golden evening light
- Chibi characters with large heads but readable humanoid proportions
- Original code-generated geometry, materials, textures, and animation to avoid third-party licensing uncertainty

### World regions

1. **Town Plaza:** fountain, Heartroot, NPC gathering area, quest board, daily check-in
2. **Home Plot:** starter house, garden, storage, decoration area
3. **Market Lane:** seed shop, produce sales, wardrobe shop
4. **River Garden:** pond, bridge, fishing spot, foliage
5. **Expansion Land:** locked plots purchased through progression

The logical farming/building grid is hidden beneath organic paths, varied terrain, foliage, fencing, rocks, water, and small elevation changes.

### Camera and movement

- Three.js `OrthographicCamera` at a 40–50 degree top-down angle
- Fixed rotation to preserve controls and art composition
- Smooth damped follow and limited zoom
- WASD and arrow keys on desktop
- Virtual joystick and action controls on touch devices
- Tap-to-approach and interact with nearby world objects
- Collision for structures, trees, water, locked land, and map boundaries
- A guaranteed clear spawn and navigable route from the home plot

### Animation and atmosphere

- Player: idle, walk, hoe, plant, water, harvest, fish, interact, and emote
- Crops: multi-stage growth and harvesting feedback
- Ambient: swaying plants, water ripples, butterflies, clouds, falling leaves, and night fireflies
- Morning, afternoon, sunset, and night lighting
- Soft shadows and restrained fog
- Automatic quality presets for weaker devices

## 4. Core Gameplay

### Farming state machine

`empty → tilled → planted → watered → growing → harvestable → empty`

The initial crop catalog is turnip, carrot, tomato, strawberry, pumpkin, and sunflower. Growth time is compressed for browser play. Each crop defines seed price, growth duration, sell value, visual stages, and optional secondary use.

### Economy

Players earn Coin from crops and quests. Coin purchases seeds, tools, land, house upgrades, decorations, buildings, and standard gacha pulls.

All transactions are atomic: validation occurs before inventory or currency changes, then state is saved after a successful transaction.

### Building mode

- Place structures and decoration on permitted owned land
- Ghost preview
- Grid snapping hidden behind natural placement presentation
- Rotation
- Green/red valid-state feedback
- Collision and overlap checks
- Confirmation before spending
- Partial refund when selling eligible objects

## 5. Story and Quest Design

### Chapter 1: The Sleeping Seed

The player inherits a neglected plot in Nxr Land. Heartroot, the living tree at the village center, is losing its light. The player restores its first spark through farming, relationships, and rebuilding.

### Initial NPCs

- **Mira:** garden keeper and farming tutorial
- **Tomo:** market owner and economy/land progression
- **Lumi:** pet researcher who unlocks pet collection and gacha

### Main quest sequence

1. Arrive in Nxr Land
2. Clear the garden
3. Plant the first crop
4. Help reopen the market
5. Find the Spirit Seed
6. Hatch the first pet
7. Rebuild the village planter
8. Restore Heartroot’s first light

Every quest displays an explicit objective, progress, destination guidance, and reward. Quest triggers consume domain events rather than reaching into unrelated systems.

## 6. Rewards and Gacha

### Daily check-in

Seven-day sequence:

1. Coin
2. Seed Pack
3. Wardrobe Ticket
4. Coin
5. Pet Treat
6. Premium Ticket
7. Guaranteed Rare Reward

Claims are based on the player’s local calendar day, stored with a last-claim timestamp and streak state. The implementation prevents duplicate claims from repeated clicks or reloads.

### Daily playtime milestones

Only active foreground gameplay time counts. The daily milestones are:

- 5 minutes: Coin and seeds
- 15 minutes: Wardrobe Ticket
- 30 minutes: Pet Treat and Coin
- 45 minutes: Gacha Ticket
- 60 minutes: Rare Chest

Each milestone can be claimed once per local day. Background tabs do not increase active playtime.

### Gacha

Two initial banners:

- Pet banner: common, rare, and epic pets
- Wardrobe banner: hair, tops, bottoms, shoes, and accessories

Rules:

- Transparent rates and pity counter
- Story grants one guaranteed starter pet
- Duplicate wardrobe and pet rewards convert to Style Dust
- Style Dust can purchase selected collection items
- No real-money purchases in the vertical slice
- Pet bonuses remain small and noncompetitive

## 7. Character Customization

The character creator supports:

- Name
- Skin tone
- Hairstyle
- Hair color
- Top
- Bottom
- Shoes
- Accessory

Character visuals are assembled from reusable mesh groups and material palettes. The same assembly function powers creator preview, in-world player rendering, wardrobe preview, and save restoration so those views cannot drift apart.

## 8. Technical Architecture

### Stack

- Vite
- Three.js
- JavaScript ES modules
- HTML/CSS interface layer
- `localStorage` persistence for the first release
- GitHub repository `Nxrskyaa/Nxr-Land`
- Vercel static deployment

React is intentionally excluded from the vertical slice. The game loop, world state, and Three.js lifecycle remain framework-independent and the DOM interface receives explicit state updates.

### Module boundaries

```text
src/
├── main.js
├── game/
│   ├── Game.js
│   ├── World.js
│   ├── Camera.js
│   ├── Input.js
│   ├── Collision.js
│   └── SaveManager.js
├── entities/
│   ├── Player.js
│   ├── NPC.js
│   ├── Pet.js
│   └── Crop.js
├── systems/
│   ├── FarmingSystem.js
│   ├── BuildingSystem.js
│   ├── QuestSystem.js
│   ├── EconomySystem.js
│   ├── RewardSystem.js
│   ├── GachaSystem.js
│   ├── TimeSystem.js
│   └── AudioSystem.js
├── visuals/
│   ├── CharacterFactory.js
│   ├── BuildingFactory.js
│   ├── NatureFactory.js
│   ├── AnimationController.js
│   └── VFX.js
├── data/
│   ├── crops.js
│   ├── items.js
│   ├── pets.js
│   ├── quests.js
│   ├── buildings.js
│   └── dialogue.js
└── ui/
    ├── UIManager.js
    ├── CharacterCreator.js
    ├── InventoryUI.js
    ├── ShopUI.js
    ├── QuestUI.js
    ├── GachaUI.js
    └── BuildingUI.js
```

Each module has one responsibility and communicates through explicit methods or domain events. Content definitions are data, not branches embedded in UI or system code.

### Event flow

```text
Input
  → Player or interaction controller
  → Domain system
  → Authoritative game state
  → Quest/economy/reward events
  → UI projection
  → SaveManager
```

Initial events include:

- `crop:planted`
- `crop:watered`
- `crop:harvested`
- `item:purchased`
- `item:sold`
- `building:placed`
- `quest:completed`
- `reward:claimed`
- `gacha:pulled`

## 9. Persistence

The save document stores:

- Schema version
- Character appearance and outfit
- Player position
- Currency and inventory
- Crops and timestamps
- Placed buildings and transforms
- Owned land and upgrades
- Quest and story progress
- Pet collection and active pet
- Gacha pity and Style Dust
- Check-in state
- Playtime reward state
- Settings

`SaveManager` validates parsed data, migrates older schema versions, keeps a last-known-good backup, and autosaves after important transactions plus at a modest interval. A corrupt primary save triggers recovery from backup. If both fail, the UI offers a fresh save without silently deleting stored data.

The state contracts are designed so a future cloud-save adapter can replace local persistence without rewriting domain systems.

## 10. UI and UX

### Player flow

1. Animated loading screen
2. Continue / New Game / Settings
3. Character creator
4. Short story introduction
5. World entry and movement tutorial
6. Farming tutorial
7. Gradual unlocking of market, rewards, pets, wardrobe, and building

### Interface principles

- Looks like a game, not a web dashboard
- HUD shows only currency, time/weather, active quest, and selected tool
- Bottom hotbar for tools and seeds
- Dedicated inventory, shop, quest, character, gacha, building, and settings panels
- No emoji as primary action icons
- Hover, pressed, focus, disabled, and audio feedback states
- Keyboard navigation for menus where practical
- Responsive touch layout with no letterboxing, stretching, or clipping

## 11. Performance and Compatibility

- Shared geometry and materials
- `InstancedMesh` for repeated foliage, rocks, flowers, and crop groups where appropriate
- Shadows limited to important actors and objects
- Mobile DPR cap and optional shadow disable
- Quality presets: low, medium, and high
- Page visibility pauses expensive updates and excludes background time from playtime rewards
- Three.js bundled with Vite rather than fetched from a runtime CDN
- Startup failures render a visible retry/reset interface instead of a blank or black screen

## 12. Error Handling and Integrity

- Transaction locks prevent duplicate claims and gacha pulls
- Invalid building placement cannot deduct currency
- Failed asset loads use deliberate fallback materials or meshes
- Save writes occur after validated state transitions
- Corrupt saves retain recoverable source data
- WebGL initialization failure produces a readable error screen
- Runtime errors are caught at the outer game boundary and surfaced with restart instructions

## 13. Verification Plan

### Automated checks

- Production build
- JavaScript lint/static checks
- Unit tests for farming transitions, economy transactions, quest progress, reward eligibility, gacha rates/pity behavior, duplicate conversion, save migration, and collision helpers
- Integration tests for planting through selling, quest completion, building placement, reward claiming, gacha persistence, and save/reload

### Browser checks

- No console errors during startup and core loop
- Character creator changes appear in the world
- Keyboard movement and interaction work
- Touch controls and tap interaction work under mobile viewport emulation
- Spawn is clear and required destinations are reachable
- Farming loop completes from purchase to sale
- Chapter 1 can be completed
- Daily and playtime rewards cannot be duplicated
- Building placement, rotation, collision, and persistence work
- Reload restores authoritative state
- Low-quality mode remains playable

### Deployment checks

- GitHub main branch contains the verified build source
- Vercel production deployment succeeds
- Production URL serves current assets, not stale bundles
- Live game is entered and played through a core interaction
- Desktop and mobile viewport screenshots are inspected
- Movement is verified through actual state change, not screenshot appearance alone

## 14. Definition of Done

The vertical slice is complete when a new player can create a character, play through the eight Chapter 1 quests, complete farming and selling, obtain and equip wardrobe, receive and follow a pet, place a building, buy land, claim legitimate daily/playtime rewards, reload without losing progress, and perform the same core flow on desktop and mobile without startup, rendering, control, or save errors.
