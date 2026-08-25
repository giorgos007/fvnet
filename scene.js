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
const Z0 = 11;
const Z1 = 18;
const ORBIT = 0.04;

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
scene.fog = new THREE.FogExp2(0x04060a, 0.038);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
if (reduce) camera.position.set(3.2, 1.35, Z0);
else camera.position.set(0, 0.9, Z0);

// Shift the core to the right of hero copy (local-space track after lookAt).
function framingShift() {
  const frac = isMobile ? 0.32 : 0.20;
  const dist = Math.hypot(camera.position.x, camera.position.y, camera.position.z);
  const halfW =
    dist * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.aspect;
  return frac * 2 * halfW;
}

function frameCamera() {
  camera.lookAt(0, 0, 0);
  camera.translateX(-framingShift());
}

scene.add(new THREE.AmbientLight(0x4aa8ff, 0.18));
scene.add(new THREE.HemisphereLight(0x4aa8ff, 0x04060a, 0.35));

const coreGroup = new THREE.Group();
const coreGeo = new THREE.IcosahedronGeometry(1, 1);
const coreFill = new THREE.Mesh(
  coreGeo,
  new THREE.MeshStandardMaterial({
    color: 0x123a66,
    emissive: ACCENT,
    emissiveIntensity: 1.35,
    metalness: 0.28,
    roughness: 0.32,
  })
);
coreFill.scale.setScalar(1.2);
const coreWire = new THREE.LineSegments(
  new THREE.WireframeGeometry(coreGeo),
  new THREE.LineBasicMaterial({
    color: 0xb7dcff,
    transparent: true,
    opacity: 0.7,
  })
);
coreWire.scale.setScalar(1.21);
const coreLight = new THREE.PointLight(ACCENT, 16, 18, 1.7);
coreGroup.add(coreFill, coreWire, coreLight);
scene.add(coreGroup);

const ringDefs = [
  { name: "LAN", radius: 2.55, tiltX: 0.55, tiltZ: 0.72, nodes: 8, packets: 3 },
  { name: "WAN", radius: 3.7, tiltX: 1.18, tiltZ: 0.18, nodes: 10, packets: 4 },
  { name: "cloud", radius: 5.05, tiltX: 1.72, tiltZ: -0.42, nodes: 12, packets: 5 },
];

const nodeGeo = new THREE.IcosahedronGeometry(1, 0);
const matNode = new THREE.MeshBasicMaterial({ color: ACCENT });
const matHub = new THREE.MeshBasicMaterial({ color: ONLINE });
const packetGeo = new THREE.SphereGeometry(1, 10, 10);
const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

const packets = [];

for (const def of ringDefs) {
  const group = new THREE.Group();
  group.rotation.x = def.tiltX;
  group.rotation.z = def.tiltZ;
  group.name = def.name;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(def.radius, 0.012, 8, 160),
    new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.42,
    })
  );
  group.add(ring);

  for (let i = 0; i < def.nodes; i++) {
    const hub = i % 4 === 0;
    const node = new THREE.Mesh(nodeGeo, hub ? matHub : matNode);
    const theta = (i / def.nodes) * Math.PI * 2;
    node.position.set(Math.cos(theta) * def.radius, Math.sin(theta) * def.radius, 0);
    node.scale.setScalar(hub ? 0.09 : 0.045);
    group.add(node);
  }

  for (let i = 0; i < def.packets; i++) {
    const mesh = new THREE.Mesh(packetGeo, packetMat);
    mesh.scale.setScalar(0.055);
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
}

let composer = null;
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
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
    isMobile ? 0.48 : 0.86,
    isMobile ? 0.38 : 0.42,
    0.22
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
} catch (e) {
  composer = null;
}

resize();
window.addEventListener("resize", resize);

const clock = new THREE.Clock();
let mouseX = 0;
let mouseY = 0;
if (!reduce) {
  window.addEventListener("pointermove", (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
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
    camera.position.x = Math.sin(t * ORBIT) * radius + mouseX * 1.25;
    camera.position.z = Math.cos(t * ORBIT) * radius;
    camera.position.y = 0.9 + Math.sin(t * 0.18) * 0.18 + mouseY * 0.5;
    coreGroup.rotation.y = t * 0.22;
    coreGroup.rotation.x = Math.sin(t * 0.12) * 0.08;
    for (const p of packets) {
      p.theta += p.speed * 0.016;
      p.mesh.position.set(
        Math.cos(p.theta) * p.radius,
        Math.sin(p.theta) * p.radius,
        0
      );
    }
  }

  frameCamera();
  render();
  requestAnimationFrame(tick);
}

tick();
