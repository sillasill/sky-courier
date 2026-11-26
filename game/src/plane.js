// The courier's bush plane, built from primitives: a high-wing single-prop
// "Kutilang" with a cream fuselage, teal wings and a spinning prop. The group
// faces -Z when heading is 0, matching the flight model's forward vector.
import * as THREE from 'three';

export function buildPlane() {
  const group = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e8d5 });
  const teal = new THREE.MeshLambertMaterial({ color: 0x1f7a6d });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e3438 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 60, specular: 0x888888, transparent: true, opacity: 0.3, depthWrite: false });

  // Fuselage: a tapered cylinder with a rounded nose and tail cone.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.55, 6.4, 12), cream);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.4;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), cream);
  nose.scale.set(1, 1, 1.1);
  nose.position.z = -2.8;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.12, 2.6, 10), cream);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.9;
  group.add(tailCone);

  // Engine cowling and spinner.
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 1.1, 12), teal);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -3.1;
  group.add(cowl);

  // Cockpit glasshouse.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), glass);
  canopy.scale.set(0.95, 0.75, 1.7);
  canopy.position.set(0, 0.85, -0.9);
  group.add(canopy);

  // High wing with a slight dihedral, plus struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.1), teal);
  wing.position.set(0, 1.05, -0.4);
  wing.rotation.z = 0.04;
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 2.1), cream);
  wingTipL.position.set(-5.6, 1.28, -0.4);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.6;
  group.add(wingTipR);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), dark);
    strut.position.set(side * 2.4, 0.1, -0.4);
    strut.rotation.z = side * 0.7;
    group.add(strut);
  }

  // Tail: horizontal stabiliser and fin, with the courier's sunrise mark.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.4), teal);
  stab.position.set(0, 0.45, 5.4);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 1.8), teal);
  fin.position.set(0, 1.3, 5.5);
  fin.rotation.x = -0.18;
  group.add(fin);
  const mark = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({ color: 0xffb03a }),
  );
  mark.position.set(0.13, 1.35, 5.5);
  mark.rotation.y = Math.PI / 2;
  group.add(mark);

  // Fixed landing gear with tundra tyres.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), dark);
    leg.position.set(side * 1.0, -1.0, -1.2);
    leg.rotation.z = side * 0.25;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.25, -1.75, -1.2);
    group.add(wheel);
    const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 10), dark);
    tailWheel.rotation.z = Math.PI / 2;
    tailWheel.position.set(0, -0.85, 5.6);
    group.add(tailWheel);
  }

  // Propeller: two blades on a hub that spins with the engine.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 10), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.6, 0.12), dark);
    blade.position.y = 0;
    const holder = new THREE.Group();
    holder.rotation.z = a;
    holder.add(blade);
    blade.position.y = 1.6;
    prop.add(holder);
  }
  prop.position.z = -3.75;
  group.add(prop);

  // Navigation lights: red port, green starboard, white tail.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  navL.position.set(-5.75, 1.05, -0.4);
  group.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2aff66 }));
  navR.position.set(5.75, 1.05, -0.4);
  group.add(navR);

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });
  return { group, prop };
}
