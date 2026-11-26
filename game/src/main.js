// NUSA SKY COURIER — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. Screens: title, flying, paused, mission complete / crashed.
//
// ?seed=N fixes the archipelago. ?shot=start|play|cockpit|end (with &seed=N)
// stages that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { createRandom } from './rng.js';
import { buildWorld } from './world.js';
import { buildPlane } from './plane.js';
import { createFlight, MODE_COMPLETE, MODE_CRASHED, MODE_FLYING, MODE_PAUSED, MODE_TITLE } from './flight.js';
import { createInput, ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const BEST_KEY = 'nusa-sky-courier-best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);

const rng = createRandom(seed);
const world = buildWorld(scene, rng, seed);
const plane = buildPlane();
scene.add(plane.group);
const flight = createFlight(world);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

let cameraMode = 'title';
let screen = MODE_TITLE;
let time = 0;
let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  best = 0;
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

const camPos = new THREE.Vector3(-40, 20, 0);
const camTarget = new THREE.Vector3();

function updateCamera(dt) {
  const p = flight.state.pos;
  const fwd = flight.forwardVector();
  if (cameraMode === 'title') {
    // Three-quarter view from behind and to the side: plane, strip and hills.
    const wanted = new THREE.Vector3()
      .copy(p)
      .addScaledVector(fwd, -20)
      .add(new THREE.Vector3(0, 9, 13));
    camPos.lerp(wanted, Math.min(1, dt * 5));
    camera.position.copy(camPos);
    camTarget.copy(p).addScaledVector(fwd, 30);
    camTarget.y += 2;
    camera.lookAt(camTarget);
    plane.group.visible = true;
    return;
  }
  if (cameraMode === 'cockpit') {
    // The pilot's head, inside the canopy (its glass is transparent):
    // the wing sits above the windshield, the cowling and prop ahead.
    camPos.copy(p).addScaledVector(fwd, -0.9);
    camPos.y = p.y + 1.15;
    camTarget.copy(p).addScaledVector(fwd, 60);
    camTarget.y += flight.state.pitch * 30 - 2;
    camera.position.lerp(camPos, Math.min(1, dt * 18));
    camera.lookAt(camTarget);
    plane.group.visible = true;
    return;
  }
  plane.group.visible = true;
  const wanted = new THREE.Vector3()
    .copy(p)
    .addScaledVector(fwd, -17)
    .add(new THREE.Vector3(0, 5.5, 0));
  camPos.lerp(wanted, Math.min(1, dt * 5));
  camera.position.copy(camPos);
  camTarget.copy(p).addScaledVector(fwd, 24);
  camTarget.y += 1;
  camera.lookAt(camTarget);
}

function syncPlane() {
  const s = flight.state;
  plane.group.position.copy(s.pos);
  plane.group.rotation.order = 'YXZ';
  plane.group.rotation.y = s.heading;
  // Nose up is +X rotation for a model facing -Z; banking right (roll > 0)
  // drops the right wing, which is -Z rotation.
  plane.group.rotation.x = s.pitch;
  plane.group.rotation.z = -s.roll;
  plane.prop.rotation.z += (0.25 + s.throttle * 2.4) * (s.mode === MODE_FLYING ? 1 : 0.2);
  // Next ring glows brighter so the pilot can always find the course.
  const next = world.rings[s.ringsPassed];
  if (next) {
    const pulse = 0.75 + Math.sin(time * 5) * 0.25;
    next.torus.material.color.setHex(s.ringsPassed === 0 ? 0xffe066 : 0xff8c2f);
    next.torus.scale.setScalar(pulse * 0.12 + 0.94);
  }
}

function showEndScreen() {
  const s = flight.state;
  if (s.score > best) {
    best = s.score;
    saveBest(best);
  }
  const done = s.mode === MODE_COMPLETE;
  hud.showScreen('over', {
    title: done ? 'DELIVERY COMPLETE!' : 'CRASHED',
    text: done
      ? 'All ten rings flown and a textbook landing at Nusa Field. The courier service salutes you.'
      : s.crashReason,
    score: s.score,
    rings: s.ringsPassed,
    time: s.elapsed,
  });
}

function advanceWorld(dt, t) {
  world.update(dt, t);
  syncPlane();
}

const game = {
  flight,
  world,
  best,
  setCameraMode(mode) {
    cameraMode = mode;
  },
  advanceWorld,
};

function runShot(name) {
  const staged = stageShot(name, game);
  syncPlane();
  updateCamera(1);
  renderer.render(scene, camera);
  if (staged.screen === 'title') hud.showScreen('title', { best: staged.best });
  else if (staged.screen === 'over') hud.showScreen('over', staged.over);
  else hud.hideScreens();
  hud.update(flight.state, flight.headingDegrees());
  // Paint twice so the frame is settled, then signal the screenshot tool.
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
    window.__shotReady = true;
  });
}

function runGame() {
  let last = performance.now();
  let accumulator = 0;
  let prevMode = screen;
  let prevRings = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const { pitch, roll, throttleDelta, actions } = input.read(frameDt);
    time += frameDt;

    if (actions.has(ACTION_MUTE)) audio.setMuted(!audio.isMuted());
    if (actions.has(ACTION_CAMERA)) cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';

    if (screen === MODE_TITLE) {
      if (actions.has(ACTION_CONFIRM)) {
        audio.start();
        flight.start();
        cameraMode = 'chase';
        screen = MODE_FLYING;
        hud.hideScreens();
      }
    } else if (screen === MODE_FLYING) {
      if (actions.has(ACTION_PAUSE)) {
        screen = MODE_PAUSED;
        flight.state.mode = MODE_PAUSED;
        hud.showScreen('pause');
      } else if (actions.has(ACTION_RESTART)) {
        flight.start();
      }
    } else if (screen === MODE_PAUSED) {
      if (actions.has(ACTION_PAUSE) || actions.has(ACTION_CONFIRM)) {
        screen = MODE_FLYING;
        flight.state.mode = MODE_FLYING;
        hud.hideScreens();
      } else if (actions.has(ACTION_RESTART)) {
        flight.start();
        screen = MODE_FLYING;
        hud.hideScreens();
      }
    } else if (screen === MODE_COMPLETE || screen === MODE_CRASHED) {
      if (actions.has(ACTION_CONFIRM) || actions.has(ACTION_RESTART)) {
        flight.reset();
        cameraMode = 'title';
        screen = MODE_TITLE;
        hud.showScreen('title', { best });
      }
    }

    if (screen === MODE_FLYING) {
      accumulator += frameDt;
      while (accumulator >= STEP) {
        flight.step(STEP, { pitch, roll, throttleDelta });
        advanceWorld(STEP, time);
        accumulator -= STEP;
      }
      if (flight.state.mode === MODE_COMPLETE || flight.state.mode === MODE_CRASHED) {
        screen = flight.state.mode;
        if (flight.state.mode === MODE_COMPLETE) audio.fanfare();
        else audio.crashThud();
        showEndScreen();
      }
      if (flight.state.ringsPassed !== prevRings) {
        prevRings = flight.state.ringsPassed;
        audio.ringChime();
      }
      audio.update(flight.state.throttle, flight.state.speed, true);
    } else {
      advanceWorld(frameDt, time);
      audio.update(0, 0, false);
    }

    if (screen !== prevMode) {
      prevMode = screen;
      if (screen === MODE_TITLE) hud.showScreen('title', { best });
    }
    updateCamera(frameDt);
    hud.update(flight.state, flight.headingDegrees());
    renderer.render(scene, camera);
    window.__gameState = {
      mode: screen,
      score: flight.state.score,
      rings: flight.state.ringsPassed,
      speed: flight.state.speed,
      altitude: flight.state.pos.y,
      heading: flight.headingDegrees(),
      fuel: flight.state.fuel,
      throttle: flight.state.throttle,
      x: flight.state.pos.x,
      y: flight.state.pos.y,
      z: flight.state.pos.z,
    };
  }
  hud.showScreen('title', { best });
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__game = game;
window.__shotReady = false;

if (shot) runShot(shot);
else runGame();
