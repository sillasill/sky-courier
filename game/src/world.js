// The archipelago: seeded island terrain, sea, sky, clouds, the home airstrip
// and the ring course. One height function drives both the mesh and the
// collision checks, so what you see is exactly what you can hit.
import * as THREE from 'three';
import { fbm } from './rng.js';

export const WORLD_SIZE = 6000;
export const SEA_LEVEL = 0;
export const RUNWAY_ELEV = 8;
export const RUNWAY_LENGTH = 620;
export const RUNWAY_WIDTH = 34;
export const RING_COUNT = 10;

const ISLANDS = [
  { x: 0, z: 0, r: 1500, peak: 95 },
  { x: 1650, z: -1250, r: 950, peak: 300 },
  { x: -1500, z: 1350, r: 1050, peak: 130 },
  { x: 1900, z: 1500, r: 750, peak: 75 },
  { x: -1900, z: -900, r: 620, peak: 55 },
  { x: 700, z: 2100, r: 480, peak: 40 },
];

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Land height at (x, z). Negative means sea floor. Shared by mesh and physics. */
export function terrainHeightAt(x, z, seed) {
  let h = -14;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.sqrt(dx * dx + dz * dz) / island.r;
    const bump = Math.exp(-d * d * 2.2);
    const rough = 0.72 + 0.28 * fbm(x * 0.0016 + 7, z * 0.0016 + 3, seed, 3);
    h += island.peak * bump * rough;
  }
  h += fbm(x * 0.004, z * 0.004, seed + 55, 3) * 9;
  // Flatten a shelf for the home airstrip so the runway sits on level ground.
  // The flat shelf covers the whole strip (plus margin) and blends out over
  // 200 m, so the strip never pokes through a hillside at its ends. A flat
  // valley corridor runs west from the strip, so the final approach flies
  // over level ground instead of the island's shoulder.
  const fx = (Math.abs(x) - (RUNWAY_LENGTH / 2 + 50)) / 200;
  const fz = (Math.abs(z) - (RUNWAY_WIDTH / 2 + 76)) / 150;
  const flatShelf = 1 - smoothstep(0, 1, Math.max(fx, fz));
  const cx = (Math.abs(x + 600) - 800) / 150;
  const cz = (Math.abs(z) - 120) / 150;
  const flatCorridor = 1 - smoothstep(0, 1, Math.max(cx, cz));
  const flat = Math.max(flatShelf, flatCorridor);
  return h * (1 - flat) + RUNWAY_ELEV * flat;
}

function colorForHeight(h, seed, x, z) {
  const sand = new THREE.Color(0xe8d29a);
  const grass = new THREE.Color(0x5da24a);
  const deepGrass = new THREE.Color(0x3f7d38);
  const rock = new THREE.Color(0x8a7f72);
  const snow = new THREE.Color(0xf2f4f6);
  const jitter = fbm(x * 0.02, z * 0.02, seed + 91, 2) * 0.08;
  let c;
  if (h < 2.5) c = sand.clone();
  else if (h < 55) c = grass.clone().lerp(deepGrass, clamp01((h - 10) / 45));
  else if (h < 150) c = deepGrass.clone().lerp(rock, clamp01((h - 55) / 95));
  else if (h < 230) c = rock.clone();
  else c = rock.clone().lerp(snow, clamp01((h - 230) / 60));
  c.offsetHSL(0, 0, jitter);
  return c;
}

function buildTerrain(scene, seed) {
  const segments = 220;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeightAt(x, z, seed);
    pos.setY(i, h);
    color.copy(colorForHeight(h, seed, x, z));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function buildSea(scene) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE * 2.4, WORLD_SIZE * 2.4, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x1e6f9e,
    shininess: 120,
    specular: 0x99ccff,
    transparent: true,
    opacity: 0.94,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = SEA_LEVEL;
  scene.add(sea);
  return sea;
}

function buildSky(scene) {
  const geo = new THREE.SphereGeometry(9000, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f7fd0) },
      mid: { value: new THREE.Color(0x9fd0ee) },
      low: { value: new THREE.Color(0xf6e3c0) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(180, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
  );
  sun.position.set(4200, 2600, -5200);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  return dome;
}

function buildClouds(scene, rng) {
  const clouds = [];
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 42; i += 1) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(rng.next() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rng.range(18, 42), 10, 8), mat);
      s.position.set(rng.range(-70, 70), rng.range(-8, 10), rng.range(-30, 30));
      s.scale.y = 0.45;
      group.add(s);
    }
    group.position.set(rng.range(-2800, 2800), rng.range(260, 480), rng.range(-2800, 2800));
    scene.add(group);
    clouds.push({ group, speed: rng.range(1.5, 4) });
  }
  return clouds;
}

function buildRunway(scene, seed) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY_LENGTH, 1.2, RUNWAY_WIDTH),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
  );
  strip.position.y = RUNWAY_ELEV + 0.4;
  strip.receiveShadow = true;
  group.add(strip);
  // Centre dashes and threshold bars, painted as thin white boxes on the strip.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let x = -RUNWAY_LENGTH / 2 + 40; x < RUNWAY_LENGTH / 2 - 20; x += 60) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 2.2), dashMat);
    dash.position.set(x, RUNWAY_ELEV + 1.15, 0);
    group.add(dash);
  }
  for (const side of [-1, 1]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 3), dashMat);
      bar.position.set(side * (RUNWAY_LENGTH / 2 - 30), RUNWAY_ELEV + 1.15, k * 6);
      group.add(bar);
    }
  }
  // Edge lights that glow at dusk and read clearly from the air.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  for (let x = -RUNWAY_LENGTH / 2 + 10; x <= RUNWAY_LENGTH / 2 - 10; x += 55) {
    for (const z of [-RUNWAY_WIDTH / 2 - 2, RUNWAY_WIDTH / 2 + 2]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), lightMat);
      lamp.position.set(x, RUNWAY_ELEV + 2.2, z);
      group.add(lamp);
    }
  }
  // Windsock on a pole beside the strip.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.set(60, RUNWAY_ELEV + 7, 42);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 9, 10, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xff7a2f, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(66, RUNWAY_ELEV + 13, 42);
  group.add(sock);
  // Hangar, control tower and a few cottages make the field feel inhabited.
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(46, 16, 30),
    new THREE.MeshLambertMaterial({ color: 0xb8452f }),
  );
  hangar.position.set(-40, RUNWAY_ELEV + 8, -62);
  group.add(hangar);
  const hangarRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15, 46, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x8f3524 }),
  );
  hangarRoof.rotation.z = Math.PI / 2;
  hangarRoof.rotation.y = Math.PI / 2;
  hangarRoof.position.set(-40, RUNWAY_ELEV + 16, -62);
  group.add(hangarRoof);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(10, 34, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }),
  );
  tower.position.set(120, RUNWAY_ELEV + 17, -58);
  group.add(tower);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(16, 8, 16),
    new THREE.MeshPhongMaterial({ color: 0x2f6f9f, shininess: 80 }),
  );
  cab.position.set(120, RUNWAY_ELEV + 38, -58);
  group.add(cab);
  for (let i = 0; i < 6; i += 1) {
    const house = new THREE.Mesh(
      new THREE.BoxGeometry(12, 7, 10),
      new THREE.MeshLambertMaterial({ color: [0xf2e6c8, 0xe8b7a0, 0xcfe0e8][i % 3] }),
    );
    house.position.set(-180 + i * 34, RUNWAY_ELEV + 3.5, 78 + (i % 2) * 22);
    group.add(house);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(9, 5, 4),
      new THREE.MeshLambertMaterial({ color: 0xa03d2a }),
    );
    roof.position.set(house.position.x, RUNWAY_ELEV + 9.5, house.position.z);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  }
  scene.add(group);
  return { group, windsock: sock };
}

function buildPalmTrees(scene, rng, seed) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  let placed = 0;
  let tries = 0;
  while (placed < 90 && tries < 900) {
    tries += 1;
    const x = rng.range(-2600, 2600);
    const z = rng.range(-2600, 2600);
    const h = terrainHeightAt(x, z, seed);
    if (h < 3 || h > 60) continue;
    if (Math.abs(x) < RUNWAY_LENGTH / 2 + 60 && Math.abs(z) < 120) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 11, 6), trunkMat);
    trunk.position.y = 5.5;
    trunk.rotation.z = rng.range(-0.12, 0.12);
    tree.add(trunk);
    for (let l = 0; l < 6; l += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 5), leafMat);
      const a = (l / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 3.4, 11.5, Math.sin(a) * 3.4);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      tree.add(leaf);
    }
    tree.position.set(x, h, z);
    scene.add(tree);
    placed += 1;
  }
}

function buildLighthouse(scene) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 8, 30, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
  );
  base.position.y = 15;
  group.add(base);
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(6.6, 6.6, 6, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  stripe.position.y = 18;
  group.add(stripe);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.y = 32;
  group.add(lamp);
  group.position.set(2380, terrainHeightAt(2380, 1750, 7) - 1, 1750);
  scene.add(group);
  return lamp;
}

function buildBoats(scene, rng) {
  const boats = [];
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d2 });
  const sailMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 4), hullMat);
    hull.position.y = 1;
    boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), hullMat);
    mast.position.y = 6;
    boat.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(6, 7), sailMat);
    sail.position.set(0, 6, 1.8);
    boat.add(sail);
    boat.position.set(rng.range(-2400, 2400), SEA_LEVEL, rng.range(-2400, 2400));
    boat.rotation.y = rng.next() * Math.PI * 2;
    scene.add(boat);
    boats.push({ group: boat, heading: rng.next() * Math.PI * 2, speed: rng.range(1, 3) });
  }
  return boats;
}

/** Ring course: a tour of the archipelago that ends back over the home strip. */
function ringCourse(seed) {
  const pts = [
    [420, 95, -420],
    [950, 130, -900],
    [1500, 210, -1250],
    [1350, 180, -300],
    [700, 120, 500],
    [-350, 150, 1050],
    [-1300, 190, 1350],
    [-1850, 140, 300],
    [-1500, 120, -700],
    [-600, 90, -350],
  ];
  return pts.map(([x, y, z], i) => {
    const ground = terrainHeightAt(x, z, seed);
    return new THREE.Vector3(x, Math.max(y, ground + 55), z);
  });
}

function buildRings(scene, seed) {
  const positions = ringCourse(seed);
  const rings = positions.map((pos, i) => {
    const group = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(17, 1.6, 12, 40),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffe066 : 0xff8c2f }),
    );
    group.add(torus);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(17, 0.5, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    );
    group.add(inner);
    group.position.copy(pos);
    // Face the ring along the course direction so you fly through it, not past it.
    const next = positions[(i + 1) % positions.length];
    group.lookAt(next);
    scene.add(group);
    return { group, torus, center: pos.clone(), passed: false, index: i };
  });
  return rings;
}

/** Build the whole world and return its live handles. */
export function buildWorld(scene, rng, seed) {
  scene.fog = new THREE.Fog(0xcfe4f2, 900, 6500);
  const sunLight = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sunLight.position.set(3000, 3800, -2000);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x5d7a52, 1.1));

  buildTerrain(scene, seed);
  buildSea(scene);
  buildSky(scene);
  const clouds = buildClouds(scene, rng);
  const runway = buildRunway(scene, seed);
  buildPalmTrees(scene, rng, seed);
  const beacon = buildLighthouse(scene);
  const boats = buildBoats(scene, rng);
  const rings = buildRings(scene, seed);

  return {
    rings,
    runway,
    terrainHeightAt: (x, z) => terrainHeightAt(x, z, seed),
    update(dt, time) {
      for (const c of clouds) {
        c.group.position.x += c.speed * dt;
        if (c.group.position.x > 2900) c.group.position.x = -2900;
      }
      for (const b of boats) {
        b.group.position.x += Math.cos(b.heading) * b.speed * dt;
        b.group.position.z += Math.sin(b.heading) * b.speed * dt;
        if (Math.abs(b.group.position.x) > 2600 || Math.abs(b.group.position.z) > 2600) {
          b.heading += Math.PI;
        }
        b.group.position.y = SEA_LEVEL + Math.sin(time * 0.9 + b.group.position.x) * 0.4;
        b.group.rotation.z = Math.sin(time * 0.7) * 0.03;
      }
      beacon.material.color.setHex(Math.sin(time * 3) > 0 ? 0xffe9a8 : 0xcc8822);
    },
  };
}
