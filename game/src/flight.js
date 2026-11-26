// Arcade flight model and the sortie state: throttle, lift, banking turns,
// stall, fuel, rings, landings and crashes. No external physics: a few honest
// rules that reward smooth flying and punish yanking the stick.
import * as THREE from 'three';
import { RUNWAY_ELEV, RUNWAY_LENGTH, RUNWAY_WIDTH, RING_COUNT, SEA_LEVEL } from './world.js';

export const MODE_TITLE = 'title';
export const MODE_FLYING = 'flying';
export const MODE_PAUSED = 'paused';
export const MODE_COMPLETE = 'complete';
export const MODE_CRASHED = 'crashed';

const MAX_BANK = 1.05;
const MAX_PITCH = 0.55;
const STALL_SPEED = 26;
const G = 9.81;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createFlight(world) {
  const state = {
    mode: MODE_TITLE,
    pos: new THREE.Vector3(-RUNWAY_LENGTH / 2 + 40, RUNWAY_ELEV + 2.2, 0),
    heading: Math.PI / 2,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    score: 0,
    ringsPassed: 0,
    elapsed: 0,
    message: '',
    messageUntil: 0,
    crashReason: '',
    verticalSpeed: 0,
    onGround: true,
    best: 0,
  };

  function reset() {
    state.mode = MODE_TITLE;
    const startX = -RUNWAY_LENGTH / 2 + 40;
    state.pos.set(startX, world.terrainHeightAt(startX, 0) + 1.7, 0);
    state.heading = Math.PI / 2;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = 100;
    state.score = 0;
    state.ringsPassed = 0;
    state.elapsed = 0;
    state.message = '';
    state.messageUntil = 0;
    state.crashReason = '';
    state.verticalSpeed = 0;
    state.onGround = true;
    for (const ring of world.rings) {
      ring.passed = false;
      ring.group.visible = true;
      ring.torus.material.color.setHex(ring.index === 0 ? 0xffe066 : 0xff8c2f);
    }
  }

  function start() {
    reset();
    state.mode = MODE_FLYING;
    state.message = 'Take off! Full throttle, then pull up gently.';
    state.messageUntil = 6;
  }

  function announce(text, seconds) {
    state.message = text;
    state.messageUntil = state.elapsed + seconds;
  }

  function forwardVector() {
    return new THREE.Vector3(Math.sin(state.heading), 0, -Math.cos(state.heading));
  }

  function crash(reason) {
    state.mode = MODE_CRASHED;
    state.crashReason = reason;
    state.speed = 0;
  }

  function checkRings() {
    const ring = world.rings[state.ringsPassed];
    if (!ring) return;
    const d = state.pos.distanceTo(ring.center);
    if (d < 18) {
      ring.passed = true;
      ring.torus.material.color.setHex(0x37d67a);
      state.ringsPassed += 1;
      state.score += 100;
      state.fuel = Math.min(100, state.fuel + 6);
      if (state.ringsPassed >= RING_COUNT) {
        announce('All rings flown! Bring her home — land on the runway.', 6);
      } else {
        announce(`Ring ${state.ringsPassed} of ${RING_COUNT} — +100 pts, +6 fuel`, 3);
      }
    }
  }

  function checkGround(dt) {
    const ground = world.terrainHeightAt(state.pos.x, state.pos.z);
    // The strip plus its grass verge: a touchdown a few metres off the
    // centreline still counts as a landing, not a crash.
    const overRunway =
      Math.abs(state.pos.x) < RUNWAY_LENGTH / 2 + 20 && Math.abs(state.pos.z) < RUNWAY_WIDTH / 2 + 12;
    const clearance = state.pos.y - ground;
    if (state.pos.y <= SEA_LEVEL + 1.2 && ground < 1) {
      state.pos.y = SEA_LEVEL + 1.2;
      crash('Ditched in the sea — the courier swam home.');
      return;
    }
    if (clearance > 1.6) {
      state.onGround = false;
      return;
    }
    // Touching ground.
    state.pos.y = ground + 1.6;
    state.onGround = true;
    if (overRunway) {
      // Rolling on the strip is normal: takeoff roll and landing roll.
      if (state.ringsPassed >= RING_COUNT) {
        if (Math.abs(state.verticalSpeed) < 4.5 && state.speed < 48 && state.speed > 12) {
          state.mode = MODE_COMPLETE;
          state.score += 500 + Math.round(state.fuel) * 5;
          state.speed = 0;
          state.pitch = 0;
          state.roll = 0;
          return;
        }
        if (state.speed >= 48) {
          crash('Too fast on touchdown — the Kutilang ran off the strip.');
          return;
        }
        if (Math.abs(state.verticalSpeed) >= 4.5) {
          crash('Slammed into the runway — the landing gear gave up.');
          return;
        }
      }
      if (Math.abs(state.verticalSpeed) >= 6 && state.speed > 25) {
        crash('Slammed into the runway — the landing gear gave up.');
        return;
      }
      state.pitch = Math.max(0, state.pitch);
      state.roll *= 0.9;
      return;
    }
    // Off the strip, touching down at speed or dropping hard is a crash.
    if (state.speed > 12 || Math.abs(state.verticalSpeed) > 3) {
      crash(state.speed > 12 ? 'Clipped the terrain at speed.' : 'Dropped out of the sky onto the hillside.');
    } else {
      // Gentle stop in a field (a forced landing before finishing).
      state.speed = Math.max(0, state.speed - 30 * dt);
      state.pitch = 0;
      state.roll *= 0.9;
    }
  }

  /** Advance the simulation one fixed step. Input is { pitch, roll, throttleDelta }. */
  function step(dt, input) {
    if (state.mode !== MODE_FLYING) return;
    state.elapsed += dt;

    // Throttle and fuel.
    state.throttle = clamp(state.throttle + (input.throttleDelta || 0) * dt * 0.9, 0, 1);
    if (state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - dt * (0.12 + state.throttle * 0.28));
    }
    if (state.fuel <= 0 && state.throttle > 0) {
      state.throttle = 0;
      announce('Out of fuel! Glide her down — find flat ground.', 5);
    }

    // Attitude follows the stick with a little lag, so the plane feels weighty.
    const targetRoll = clamp(input.roll || 0, -1, 1) * MAX_BANK;
    const targetPitch = clamp(input.pitch || 0, -1, 1) * MAX_PITCH;
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * 4.5);
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3.5);
    if (state.onGround && state.speed < 18) state.pitch = Math.max(0, state.pitch);

    // Speed chases the throttle; drag grows with the square of speed.
    const targetSpeed = 16 + state.throttle * 58;
    const accel = state.speed < targetSpeed ? 7 : 5;
    state.speed += clamp(targetSpeed - state.speed, -accel * dt, accel * dt);
    if (state.onGround) state.speed = Math.min(state.speed, 62);

    // Banking turns the nose; a stalled wing stops lifting.
    const turnRate = clamp((G * Math.tan(state.roll)) / Math.max(state.speed, 22), -0.55, 0.55) * 1.5;
    state.heading += turnRate * dt;
    const stalling = state.speed < STALL_SPEED && !state.onGround;
    const sink = stalling ? (STALL_SPEED - state.speed) * 0.45 : 0;
    state.verticalSpeed = state.speed * Math.sin(state.pitch) - sink;
    if (stalling && state.pitch > -0.15) state.pitch -= dt * 0.25;

    const fwd = forwardVector();
    state.pos.addScaledVector(fwd, state.speed * dt);
    state.pos.y += state.verticalSpeed * dt;
    if (state.pos.y > 900) state.pos.y = 900;

    checkRings();
    checkGround(dt);
  }

  /** Simple autopilot used by the screenshot scenes: aim at the next target. */
  function autopilotInput() {
    const target = nextTarget();
    const dx = target.x - state.pos.x;
    const dz = target.z - state.pos.z;
    const dy = target.y - state.pos.y;
    const dist = Math.hypot(dx, dz);
    const desiredHeading = Math.atan2(dx, -dz);
    const headingErr = wrapAngle(desiredHeading - state.heading);
    const rollCmd = clamp(headingErr * 1.4, -1, 1);
    const desiredPitch = clamp(Math.atan2(dy, Math.max(dist, 1)) * 1.3, -0.4, 0.4);
    let pitchCmd = clamp(desiredPitch * 1.5, -1, 1);
    let throttleDelta = 0;
    if (state.onGround && state.speed < 34) {
      throttleDelta = 1;
      pitchCmd = 0;
    } else if (state.speed < 42) {
      throttleDelta = 0.8;
    } else if (state.speed > 58) {
      throttleDelta = -0.6;
    }
    // Final approach: hold the glide, bleed speed, flare over the numbers.
    // The glide ends at touchdown height, not above it, or the plane
    // holds altitude over the strip forever and never lands.
    if (state.ringsPassed >= RING_COUNT) {
      if (state.pos.x >= -400) {
        // Aim a touch below touchdown height so the plane keeps a gentle
        // descent through the flare instead of hovering above the strip.
        pitchCmd = clamp((RUNWAY_ELEV + 1.0 - state.pos.y) * 0.04, -0.15, 0.1);
        if (state.speed > 40) throttleDelta = -0.8;
        else if (state.speed < 28) throttleDelta = 0.4;
      } else if (state.pos.x >= -1000 && state.speed > 50) {
        throttleDelta = -0.5;
      }
    }
    return { pitch: pitchCmd, roll: rollCmd, throttleDelta };
  }

  function nextTarget() {
    if (state.ringsPassed < RING_COUNT) return world.rings[state.ringsPassed].center;
    // Final approach in three legs down the flat valley corridor: a high
    // fix west of the field, a lower fix at the shelf's edge, then a point
    // past the numbers so the plane flies down the strip and settles onto
    // it. Overshoot the far end and it goes around.
    const x = state.pos.x;
    if (x > 300) return new THREE.Vector3(-1200, RUNWAY_ELEV + 140, 0);
    if (x < -1000) return new THREE.Vector3(-1200, RUNWAY_ELEV + 140, 0);
    if (x < -400) return new THREE.Vector3(-400, RUNWAY_ELEV + 42, 0);
    return new THREE.Vector3(200, RUNWAY_ELEV + 1.0, 0);
  }

  return {
    state,
    reset,
    start,
    step,
    autopilotInput,
    forwardVector,
    headingDegrees() {
      const deg = (state.heading * 180) / Math.PI;
      return ((deg % 360) + 360) % 360;
    },
  };
}
