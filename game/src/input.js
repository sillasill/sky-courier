// Keyboard and mouse input. Arrows / WASD fly the plane, Shift / Ctrl work
// the throttle, the mouse steers toward the pointer, C swaps the camera,
// P pauses, R restarts and M mutes. Everything is read once per frame.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_CAMERA = 'camera';
export const ACTION_MUTE = 'mute';

const KEYMAP = {
  ArrowUp: 'pitchUp',
  KeyW: 'pitchUp',
  ArrowDown: 'pitchDown',
  KeyS: 'pitchDown',
  ArrowLeft: 'rollLeft',
  KeyA: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyD: 'rollRight',
  ShiftLeft: 'throttleUp',
  ShiftRight: 'throttleUp',
  ControlLeft: 'throttleDown',
  ControlRight: 'throttleDown',
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let mouseTimer = 0;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width - 0.5;
    mouseY = (event.clientY - rect.top) / rect.height - 0.5;
    mouseActive = true;
    mouseTimer = 2.5;
  }
  function onMouseDown() {
    mouseActive = true;
    mouseTimer = 2.5;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);

  function held(action) {
    for (const [code, name] of Object.entries(KEYMAP)) {
      if (name === action && keys.has(code)) return true;
    }
    return false;
  }
  function wasPressed(code) {
    return pressed.has(code);
  }

  return {
    /** Read the stick for this frame and clear one-shot presses. */
    read(dt) {
      mouseTimer = Math.max(0, mouseTimer - dt);
      if (mouseTimer === 0) mouseActive = false;
      let pitch = 0;
      let roll = 0;
      // Keyboard: up/ W pulls the nose up; left / A banks left.
      if (held('pitchUp')) pitch += 1;
      if (held('pitchDown')) pitch -= 1;
      if (held('rollLeft')) roll -= 1;
      if (held('rollRight')) roll += 1;
      // Mouse: pointer above centre pulls up, pointer left banks left.
      if (mouseActive && pitch === 0 && roll === 0) {
        pitch = Math.max(-1, Math.min(1, -mouseY * 2.4));
        roll = Math.max(-1, Math.min(1, mouseX * 2.4));
      }
      let throttleDelta = 0;
      if (held('throttleUp')) throttleDelta += 1;
      if (held('throttleDown')) throttleDelta -= 1;
      const actions = new Set();
      if (wasPressed('Enter') || wasPressed('Space')) actions.add(ACTION_CONFIRM);
      if (wasPressed('KeyP') || wasPressed('Escape')) actions.add(ACTION_PAUSE);
      if (wasPressed('KeyR')) actions.add(ACTION_RESTART);
      if (wasPressed('KeyC')) actions.add(ACTION_CAMERA);
      if (wasPressed('KeyM')) actions.add(ACTION_MUTE);
      pressed.clear();
      return { pitch, roll, throttleDelta, actions };
    },
  };
}
