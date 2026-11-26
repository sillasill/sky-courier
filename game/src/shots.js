// Deterministic screenshot scenes. Each one plays the real flight model
// forward from a fresh world with the autopilot on the stick, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame. ?shot=start|play|cockpit|end&seed=N
import { MODE_COMPLETE, MODE_CRASHED, MODE_FLYING } from './flight.js';

const STEP = 1 / 60;
const START_SECONDS = 4;
const PLAY_SECONDS = 26;
const COCKPIT_SECONDS = 15;
const PLAY2_SECONDS = 42;
const END_LIMIT_SECONDS = 600;

/**
 * Stage the named scene on `game` (the object main.js builds) and return the
 * screen the HUD should show, plus the end-of-flight summary for the
 * mission-complete screen.
 */
export function stageShot(name, game) {
  const { flight } = game;
  flight.reset();
  if (name !== 'play' && name !== 'play2' && name !== 'cockpit' && name !== 'end') {
    // Title: the Kutilang sits on the strip at dawn light, ready to go.
    game.setCameraMode('title');
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      game.advanceWorld(STEP, i * STEP);
    }
    return { screen: 'title', best: game.best };
  }
  flight.start();
  game.setCameraMode(name === 'cockpit' ? 'cockpit' : 'chase');
  const limit =
    name === 'end'
      ? END_LIMIT_SECONDS
      : name === 'cockpit'
        ? COCKPIT_SECONDS
        : name === 'play2'
          ? PLAY2_SECONDS
          : PLAY_SECONDS;
  let steps = 0;
  const maxSteps = Math.floor(limit / STEP);
  const trace = [];
  while (steps < maxSteps && flight.state.mode === MODE_FLYING) {
    flight.step(STEP, flight.autopilotInput());
    game.advanceWorld(STEP, steps * STEP);
    steps += 1;
    if (steps % 60 === 0) {
      const s = flight.state;
      trace.push({
        t: +(steps * STEP).toFixed(1),
        x: Math.round(s.pos.x),
        y: Math.round(s.pos.y),
        z: Math.round(s.pos.z),
        hdg: Math.round((flight.headingDegrees() + 360) % 360),
        spd: Math.round(s.speed),
        rings: s.ringsPassed,
        mode: s.mode,
      });
    }
  }
  game.shotTrace = trace;
  if (name === 'end') {
    const done = flight.state.mode === MODE_COMPLETE;
    const crashed = flight.state.mode === MODE_CRASHED;
    return {
      screen: 'over',
      best: game.best,
      over: {
        title: done ? 'DELIVERY COMPLETE!' : crashed ? 'CRASHED' : 'OUT OF TIME',
        text: done
          ? 'All ten rings flown and a textbook landing at Nusa Field. The courier service salutes you.'
          : crashed
            ? flight.state.crashReason
            : 'The autopilot ran out of sky before the last ring.',
        score: flight.state.score,
        rings: flight.state.ringsPassed,
        time: flight.state.elapsed,
      },
    };
  }
  return { screen: null, best: game.best };
}
