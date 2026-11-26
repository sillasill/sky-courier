# Nusa Sky Courier

[![Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/sillasill/sky-courier/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/sillasill/sky-courier/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A bush-plane courier run over the fictional Nusa islands: fly the Kutilang through all 10 rings, then bring her home and land on the strip at Nusa Field. Rings pay 100 points and +6 fuel; a clean landing pays 500 + 5 per fuel left. Watch the tanks — empty means a glide, and the sea is not a runway.

Play it: serve `game/` with any static server and open `game/index.html` in desktop Chrome. It plays fully offline — every script, image and sound is a file under `game/` or synthesized live.

- **Controls:** W/S or ↑/↓ pitch, A/D or ←/→ bank, Shift/Ctrl throttle, mouse steers too. C swaps cockpit / chase camera, P pauses, R restarts, M mutes.
- **The game:** a 3D chase or cockpit view over seeded island terrain (beaches, jungle, a snow-capped volcano, boats, palms, a lighthouse), a lit runway with edge lights, windsock, hangar and tower, a glass-cockpit HUD (altitude, airspeed, heading, compass strip, attitude indicator, throttle and fuel), procedural WebAudio engine hum, wind, ring chimes and crash thuds.
- **Tech:** Three.js (vendored as `game/vendor/three.module.min.js`), own flight model, own seeded world generation — no network requests, no build step.

## Run it locally

```sh
node serve.ts   # serves game/ on http://localhost:8080 (dev helper, not part of the entry)
```

Or any static server pointed at `game/`. Deterministic screenshot scenes: `?shot=start|play|cockpit|end&seed=1`.

## Hand in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Bounty: [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) — $500, 50 places paid.
