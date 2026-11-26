// The glass-cockpit HUD: altitude, speed and heading, throttle and fuel,
// rings and score, a live attitude indicator, a compass strip, and the
// title / pause / end screens. All DOM, updated from the flight state.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const alt = el('hud-alt');
  const spd = el('hud-speed');
  const hdg = el('hud-heading');
  const thr = el('hud-throttle-fill');
  const thrText = el('hud-throttle-text');
  const fuel = el('hud-fuel-fill');
  const fuelText = el('hud-fuel-text');
  const score = el('hud-score');
  const rings = el('hud-rings');
  const timer = el('hud-time');
  const msg = el('hud-message');
  const warn = el('hud-warning');
  const compass = el('hud-compass');
  const attitude = el('hud-attitude');
  const actx = attitude.getContext('2d');
  const screens = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    over: el('screen-over'),
  };
  const overTitle = el('over-title');
  const overText = el('over-text');
  const overScore = el('over-score');
  const titleBest = el('title-best');

  const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  function drawAttitude(pitch, roll) {
    const w = attitude.width;
    const h = attitude.height;
    actx.clearRect(0, 0, w, h);
    actx.save();
    actx.beginPath();
    actx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    actx.clip();
    actx.translate(w / 2, h / 2);
    actx.rotate(-roll);
    const horizonY = pitch * 90;
    actx.fillStyle = '#2f7fd0';
    actx.fillRect(-w, -h + horizonY, w * 2, h);
    actx.fillStyle = '#8a6b48';
    actx.fillRect(-w, horizonY, w * 2, h);
    actx.strokeStyle = '#ffffff';
    actx.lineWidth = 2;
    actx.beginPath();
    actx.moveTo(-w, horizonY);
    actx.lineTo(w, horizonY);
    actx.stroke();
    actx.restore();
    // Fixed wings marker.
    actx.strokeStyle = '#ffe066';
    actx.lineWidth = 3;
    actx.beginPath();
    actx.moveTo(w / 2 - 26, h / 2);
    actx.lineTo(w / 2 - 8, h / 2);
    actx.moveTo(w / 2 + 8, h / 2);
    actx.lineTo(w / 2 + 26, h / 2);
    actx.stroke();
    actx.beginPath();
    actx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    actx.strokeStyle = '#e8e8e8';
    actx.lineWidth = 2;
    actx.stroke();
  }

  function drawCompass(headingDeg) {
    const labels = [];
    for (let d = -60; d <= 60; d += 15) {
      const deg = (Math.round(headingDeg) + d + 360) % 360;
      const name = deg % 45 === 0 ? COMPASS_POINTS[(deg / 45) % 8] : String(deg).padStart(3, '0');
      const x = 50 + (d / 60) * 44;
      labels.push(`<span style="left:${x}%">${name}</span>`);
    }
    compass.innerHTML = labels.join('') + '<b>▲</b>';
  }

  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return {
    update(state, headingDeg) {
      const altFt = Math.max(0, Math.round((state.pos.y - 8) * 3.281));
      alt.textContent = `${altFt.toLocaleString('en-US')} ft`;
      spd.textContent = `${Math.round(state.speed * 1.944)} kt`;
      hdg.textContent = `${String(Math.round(headingDeg)).padStart(3, '0')}°`;
      thr.style.width = `${Math.round(state.throttle * 100)}%`;
      thrText.textContent = `THR ${Math.round(state.throttle * 100)}%`;
      fuel.style.width = `${Math.round(state.fuel)}%`;
      fuelText.textContent = `FUEL ${Math.round(state.fuel)}%`;
      fuel.classList.toggle('low', state.fuel < 25);
      score.textContent = String(state.score);
      rings.textContent = `RINGS ${state.ringsPassed}/10`;
      timer.textContent = fmtTime(state.elapsed);
      msg.textContent = state.elapsed < state.messageUntil ? state.message : '';
      const lowFuel = state.fuel < 20 && state.fuel > 0;
      const stalling = state.speed < 26 && !state.onGround;
      warn.textContent = state.fuel <= 0 ? '⚠ OUT OF FUEL — GLIDE!' : lowFuel ? '⚠ LOW FUEL' : stalling ? '⚠ STALL — NOSE DOWN, POWER UP' : '';
      drawAttitude(state.pitch, state.roll);
      drawCompass(headingDeg);
    },
    showScreen(name, data) {
      for (const [key, node] of Object.entries(screens)) {
        node.classList.toggle('hidden', key !== name);
      }
      if (name === 'over' && data) {
        overTitle.textContent = data.title;
        overText.textContent = data.text;
        overScore.textContent = `SCORE ${data.score}  ·  RINGS ${data.rings}/10  ·  TIME ${fmtTime(data.time)}`;
      }
      if (name === 'title' && data) {
        titleBest.textContent = data.best > 0 ? `Best score: ${data.best}` : 'First flight? Full throttle, then pull up gently.';
      }
    },
    hideScreens() {
      for (const node of Object.values(screens)) node.classList.add('hidden');
    },
  };
}
