import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("webgl");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 860px)").matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.75));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04060a, 0.045);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
camera.position.set(0, 1.4, 16);

const nodeCount = isMobile ? 70 : 140;
const nodes = [];
const dummy = new THREE.Object3D();

function fibSphere(i, n, radius) {
  const offset = 2 / n;
  const y = i * offset - 1 + offset / 2;
  const r = Math.sqrt(1 - y * y);
  const phi = i * 2.399963229728653;
  return new THREE.Vector3(
    Math.cos(phi) * r * radius,
    y * radius * 0.72,
    Math.sin(phi) * r * radius
  );
}

const geo = new THREE.SphereGeometry(1, 12, 12);
const matCore = new THREE.MeshBasicMaterial({ color: 0x9ef2ff });
const matNode = new THREE.MeshBasicMaterial({ color: 0x5ce1ff });
const inst = new THREE.InstancedMesh(geo, matNode, nodeCount);
inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

const sizes = new Float32Array(nodeCount);
for (let i = 0; i < nodeCount; i++) {
  const p = fibSphere(i, nodeCount, 6.4);
  // squash into a cinematic disk / torus-like cloud
  p.x *= 1.35;
  p.z *= 1.35;
  const hub = i % 17 === 0;
  const s = hub ? 0.085 : 0.028 + Math.random() * 0.03;
  sizes[i] = s;
  nodes.push({ p, hub, phase: Math.random() * Math.PI * 2 });
  dummy.position.copy(p);
  dummy.scale.setScalar(s);
  dummy.updateMatrix();
  inst.setMatrixAt(i, dummy.matrix);
  inst.setColorAt(i, new THREE.Color(hub ? 0xe7fbff : 0x4ec8ea));
}
inst.instanceColor.setUsage(THREE.DynamicDrawUsage);
scene.add(inst);

const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), matCore);
scene.add(core);
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.2, 0.008, 8, 128),
  new THREE.MeshBasicMaterial({ color: 0x7ae7ff, transparent: true, opacity: 0.35 })
);
ring.rotation.x = Math.PI / 2.4;
scene.add(ring);

const linePos = [];
const maxDist = isMobile ? 2.15 : 1.85;
for (let i = 0; i < nodeCount; i++) {
  for (let j = i + 1; j < nodeCount; j++) {
    if (nodes[i].p.distanceTo(nodes[j].p) < maxDist) {
      linePos.push(nodes[i].p.x, nodes[i].p.y, nodes[i].p.z);
      linePos.push(nodes[j].p.x, nodes[j].p.y, nodes[j].p.z);
    }
  }
}
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
const lines = new THREE.LineSegments(
  lineGeo,
  new THREE.LineBasicMaterial({
    color: 0x3aa9c8,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(lines);

const pulseCount = isMobile ? 10 : 22;
const pulseGeo = new THREE.SphereGeometry(1, 8, 8);
const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pulses = new THREE.InstancedMesh(pulseGeo, pulseMat, pulseCount);
const pulsePaths = [];
for (let i = 0; i < pulseCount; i++) {
  const a = nodes[Math.floor(Math.random() * nodeCount)].p.clone();
  const b = nodes[Math.floor(Math.random() * nodeCount)].p.clone();
  pulsePaths.push({ a, b, t: Math.random(), speed: 0.12 + Math.random() * 0.18 });
}
scene.add(pulses);

let composer = null;
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
}

try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isMobile ? 0.55 : 0.85,
    0.7,
    0.2
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
} catch (e) {
  composer = null;
}

function setCanvasSize() {
  const parent = canvas.parentElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  resize();
}
setCanvasSize();
window.addEventListener("resize", setCanvasSize);

const clock = new THREE.Clock();
let mouseX = 0;
let mouseY = 0;
window.addEventListener("pointermove", (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

function tick() {
  const t = clock.getElapsedTime();
  if (!reduce) {
    const orbit = t * 0.08;
    camera.position.x = Math.sin(orbit) * 16 + mouseX * 1.4;
    camera.position.z = Math.cos(orbit) * 16;
    camera.position.y = 1.4 + Math.sin(t * 0.22) * 0.45 + mouseY * 0.6;
  }
  camera.lookAt(0, 0, 0);
  core.rotation.y = t * 0.25;
  ring.rotation.z = t * 0.08;

  for (let i = 0; i < nodeCount; i++) {
    const n = nodes[i];
    const s = sizes[i] * (1 + Math.sin(t * 1.6 + n.phase) * 0.12);
    dummy.position.copy(n.p);
    dummy.position.y += Math.sin(t * 0.5 + n.phase) * 0.06;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < pulseCount; i++) {
    const p = pulsePaths[i];
    p.t += p.speed * 0.016;
    if (p.t > 1) {
      p.t = 0;
      p.a.copy(nodes[Math.floor(Math.random() * nodeCount)].p);
      p.b.copy(nodes[Math.floor(Math.random() * nodeCount)].p);
    }
    dummy.position.lerpVectors(p.a, p.b, p.t);
    dummy.scale.setScalar(0.045);
    dummy.updateMatrix();
    pulses.setMatrixAt(i, dummy.matrix);
  }
  pulses.instanceMatrix.needsUpdate = true;

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
