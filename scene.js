import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("webgl");
const sceneRoot = document.getElementById("scene");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 860px)").matches;

const ACCENT = 0x4aa8ff;
const ONLINE = 0x3ddc97;
const MAGENTA = 0xff6ad5;
const TEAL = 0x5eead4;
const Z0 = 11;
const Z1 = 18;
const ORBIT = 0.035;

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
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07070c, 0.028);

function makeEnv() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#9ad8ff");
  g.addColorStop(0.42, "#2a2458");
  g.addColorStop(0.72, "#ff7ad9");
  g.addColorStop(1, "#0b1220");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const envMap = makeEnv();
scene.environment = envMap;

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
if (reduce) camera.position.set(3.2, 1.35, Z0);
else camera.position.set(0, 0.85, Z0);

function applyViewOffset(w, h) {
  const mobile = w <= 860;
  const ox = -(mobile ? 0.48 : 0.32) * w;
  const oy = (mobile ? 0.24 : 0.08) * h;
  camera.setViewOffset(w, h, ox, oy, w, h);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.22));
scene.add(new THREE.HemisphereLight(0xb8dcff, 0x1a1028, 0.55));

const lightCyan = new THREE.PointLight(ACCENT, isMobile ? 10 : 16, 22, 1.6);
lightCyan.position.set(4.2, 2.8, 4);
scene.add(lightCyan);
const lightMagenta = new THREE.PointLight(MAGENTA, isMobile ? 6 : 11, 20, 1.8);
lightMagenta.position.set(-4.4, 1.2, 2.2);
scene.add(lightMagenta);
const lightTeal = new THREE.PointLight(TEAL, isMobile ? 5 : 8, 16, 1.9);
lightTeal.position.set(0.4, -3.2, 3.2);
scene.add(lightTeal);

const coreGroup = new THREE.Group();
const coreGeo = new THREE.IcosahedronGeometry(1.15, isMobile ? 2 : 4);
const coreFill = new THREE.Mesh(
  coreGeo,
  new THREE.MeshPhysicalMaterial({
    color: 0x8ecfff,
    metalness: 0.18,
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 1,
    iridescenceIOR: 1.28,
    iridescenceThicknessRange: [120, 420],
    sheen: 0.45,
    sheenColor: new THREE.Color(0x7ae0ff),
    emissive: 0x163a66,
    emissiveIntensity: 0.32,
    envMapIntensity: 1.45,
  })
);
const coreLight = new THREE.PointLight(ACCENT, 8, 14, 1.8);
coreGroup.add(coreFill, coreLight);
scene.add(coreGroup);

const ringDefs = [
  { name: "LAN", radius: 2.55, tiltX: 0.55, tiltZ: 0.72, nodes: 8, packets: 3 },
  { name: "WAN", radius: 3.7, tiltX: 1.18, tiltZ: 0.18, nodes: 10, packets: 4 },
  { name: "cloud", radius: 5.05, tiltX: 1.72, tiltZ: -0.42, nodes: 12, packets: 5 },
];

const nodeGeo = new THREE.SphereGeometry(1, 16, 16);
const matNode = new THREE.MeshPhysicalMaterial({
  color: ACCENT,
  roughness: 0.22,
  metalness: 0.2,
  emissive: ACCENT,
  emissiveIntensity: 0.45,
});
const matHub = new THREE.MeshPhysicalMaterial({
  color: ONLINE,
  roughness: 0.18,
  metalness: 0.15,
  emissive: ONLINE,
  emissiveIntensity: 0.55,
});
const packetGeo = new THREE.SphereGeometry(1, 12, 12);
const packetMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  roughness: 0.12,
  metalness: 0.05,
  emissive: 0xffffff,
  emissiveIntensity: 0.35,
});

const packets = [];
const ringGroups = [];

for (const def of ringDefs) {
  const group = new THREE.Group();
  group.rotation.x = def.tiltX;
  group.rotation.z = def.tiltZ;
  group.name = def.name;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(def.radius, 0.018, 12, 180),
    new THREE.MeshPhysicalMaterial({
      color: ACCENT,
      roughness: 0.28,
      metalness: 0.35,
      emissive: ACCENT,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.7,
    })
  );
  group.add(ring);

  for (let i = 0; i < def.nodes; i++) {
    const hub = i % 4 === 0;
    const node = new THREE.Mesh(nodeGeo, hub ? matHub : matNode);
    const theta = (i / def.nodes) * Math.PI * 2;
    node.position.set(Math.cos(theta) * def.radius, Math.sin(theta) * def.radius, 0);
    node.scale.setScalar(hub ? 0.1 : 0.05);
    group.add(node);
  }

  for (let i = 0; i < def.packets; i++) {
    const mesh = new THREE.Mesh(packetGeo, packetMat);
    mesh.scale.setScalar(0.06);
    const theta = (i / def.packets) * Math.PI * 2;
    mesh.position.set(Math.cos(theta) * def.radius, Math.sin(theta) * def.radius, 0);
    group.add(mesh);
    packets.push({
      mesh,
      radius: def.radius,
      theta,
      speed: 0.35 + i * 0.08 + def.radius * 0.02,
    });
  }

  scene.add(group);
  ringGroups.push(group);
}

const blobGeo = new THREE.SphereGeometry(1, isMobile ? 20 : 32, isMobile ? 20 : 32);
const blobPalette = [ACCENT, MAGENTA, TEAL];
const blobs = [];
const blobCount = isMobile ? 4 : 7;
for (let i = 0; i < blobCount; i++) {
  const mesh = new THREE.Mesh(
    blobGeo,
    new THREE.MeshPhysicalMaterial({
      color: blobPalette[i % 3],
      roughness: 0.16,
      metalness: 0.08,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      iridescence: 0.85,
      iridescenceIOR: 1.25,
      iridescenceThicknessRange: [80, 320],
      transparent: true,
      opacity: 0.78,
      envMapIntensity: 1.2,
    })
  );
  mesh.scale.setScalar(0.16 + (i % 3) * 0.07);
  scene.add(mesh);
  blobs.push({
    mesh,
    radius: 2.1 + i * 0.42,
    speed: 0.11 + i * 0.025,
    phase: i * 0.9,
    y: (i % 2 === 0 ? 0.55 : -0.45) * (0.4 + (i % 3) * 0.2),
  });
}

let composer = null;
let bloomPass = null;
function tuneBloom(w) {
  if (!bloomPass) return;
  const mobile = w <= 860;
  bloomPass.strength = mobile ? 0.32 : 0.72;
  bloomPass.radius = mobile ? 0.22 : 0.42;
  bloomPass.threshold = 0.22;
}
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  applyViewOffset(w, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  tuneBloom(w);
}

try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.72,
    0.42,
    0.22
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
} catch (e) {
  composer = null;
  bloomPass = null;
}

resize();
window.addEventListener("resize", resize);

const clock = new THREE.Clock();
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
if (!reduce) {
  window.addEventListener("pointermove", (e) => {
    targetX = (e.clientX / window.innerWidth) * 2 - 1;
    targetY = (e.clientY / window.innerHeight) * 2 - 1;
  });
}

const main = document.querySelector("main");
const why = document.getElementById("why");
if (main && sceneRoot) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === main) {
          sceneRoot.classList.toggle("is-dim", entry.isIntersecting);
        } else if (entry.target === why) {
          sceneRoot.classList.toggle("is-dim-more", entry.isIntersecting);
        }
      }
    },
    { threshold: 0.04 }
  );
  io.observe(main);
  if (why) io.observe(why);
}

function dollyZ() {
  if (reduce) return Z0;
  const hero = document.getElementById("top");
  if (!hero) return Z0;
  const rect = hero.getBoundingClientRect();
  const h = Math.max(1, rect.height);
  const p = Math.min(1, Math.max(0, -rect.top / h));
  return Z0 + (Z1 - Z0) * p;
}

function render() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function tick() {
  const t = clock.getElapsedTime();
  const radius = dollyZ();

  if (!reduce) {
    mouseX += (targetX - mouseX) * 0.06;
    mouseY += (targetY - mouseY) * 0.06;
    camera.position.x = Math.sin(t * ORBIT) * radius + mouseX * 1.55;
    camera.position.z = Math.cos(t * ORBIT) * radius;
    camera.position.y = 0.85 + Math.sin(t * 0.18) * 0.16 + mouseY * 0.62;
    coreGroup.rotation.y = t * 0.18;
    coreGroup.rotation.x = Math.sin(t * 0.11) * 0.1;
    coreFill.rotation.y = t * 0.08;
    for (const p of packets) {
      p.theta += p.speed * 0.016;
      p.mesh.position.set(
        Math.cos(p.theta) * p.radius,
        Math.sin(p.theta) * p.radius,
        0
      );
    }
    for (const b of blobs) {
      const a = t * b.speed + b.phase;
      b.mesh.position.set(
        Math.cos(a) * b.radius,
        b.y + Math.sin(a * 1.4) * 0.35,
        Math.sin(a) * b.radius * 0.55
      );
    }
    for (let i = 0; i < ringGroups.length; i++) {
      ringGroups[i].rotation.y = t * (0.04 + i * 0.012);
    }
  }

  camera.lookAt(0, 0, 0);
  render();
  requestAnimationFrame(tick);
}

tick();
