import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const REPOLIS_VARIANTS = [
  {
    id: 'golden-canopy',
    label: 'Golden Canopy',
    foliageDensity: 1,
    cyanRatio: 0.16,
    amber: '#E7A33A',
    cyan: '#44DCE8',
    energy: '#FFC55A',
    branchWarmth: 1,
  },
  {
    id: 'solar-archive',
    label: 'Solar Archive',
    foliageDensity: 1.16,
    cyanRatio: 0.1,
    amber: '#F5BD54',
    cyan: '#79F3FF',
    energy: '#F6B64A',
    branchWarmth: 1.08,
  },
  {
    id: 'aurora-index',
    label: 'Aurora Index',
    foliageDensity: 0.92,
    cyanRatio: 0.34,
    amber: '#D98A2E',
    cyan: '#35E8FF',
    energy: '#FFB13B',
    branchWarmth: 0.92,
  },
];

export const REPOLIS_STAGES = [
  'blockout',
  'structural-pass',
  'form-refinement',
  'material-pass',
  'surface-pass',
  'full',
];

export const REPOLIS_FACTORY_REVISION = 'azimuth-energy-v4-dominant-b-attached-leaves';

const STAGE_LEVEL = Object.fromEntries(
  REPOLIS_STAGES.map((stage, index) => [stage, index]),
);

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
  return {
    next() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    },
    range(minimum, maximum) {
      return minimum + (maximum - minimum) * this.next();
    },
    signed() {
      return this.next() * 2 - 1;
    },
    pick(values) {
      return values[Math.min(values.length - 1, Math.floor(this.next() * values.length))];
    },
  };
}

function withPrivateRandom(seed, build) {
  const globalRandom = Math.random;
  const local = seededRandom(seed);
  Math.random = () => local.next();
  try {
    return build();
  } finally {
    Math.random = globalRandom;
  }
}

function hash2d(x, y, seed) {
  let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y + seed * 31, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const a = hash2d(x0, y0, seed);
  const b = hash2d(x0 + 1, y0, seed);
  const c = hash2d(x0, y0 + 1, seed);
  const d = hash2d(x0 + 1, y0 + 1, seed);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, tx),
    THREE.MathUtils.lerp(c, d, tx),
    ty,
  );
}

function fractalNoise(x, y, seed) {
  let value = 0;
  let amplitude = 0.58;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    value += valueNoise(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.15;
  }
  return value / total;
}

function dataTexture(data, width, height, colorSpace = THREE.NoColorSpace) {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.6, 1.05);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createBarkTextures(seed, size = 512) {
  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const height = new Uint8Array(pixelCount * 4);
  const normal = new Uint8Array(pixelCount * 4);
  const ao = new Uint8Array(pixelCount * 4);
  const heightField = new Float32Array(pixelCount);
  const roughnessField = new Float32Array(pixelCount);
  const write = (target, offset, red, green, blue, alpha = 255) => {
    target[offset] = Math.max(0, Math.min(255, Math.round(red)));
    target[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
    target[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
    target[offset + 3] = alpha;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const u = x / size;
      const v = y / size;
      const macro = fractalNoise(u * 3.2, v * 2.1, seed + 17);
      const meso = fractalNoise(u * 16.0, v * 7.0, seed + 37);
      const micro = fractalNoise(u * 70.0, v * 35.0, seed + 71);
      const verticalRidge = Math.pow(Math.abs(Math.sin((u * 18 + macro * 1.9) * Math.PI)), 1.7);
      const fissure = Math.pow(Math.abs(Math.sin((u * 7.5 + meso * 0.75) * Math.PI)), 4.5);
      const barkHeight = THREE.MathUtils.clamp(
        0.2 + macro * 0.35 + meso * 0.18 + micro * 0.05 + verticalRidge * 0.22 - fissure * 0.16,
        0,
        1,
      );
      heightField[index] = barkHeight;
      const rough = THREE.MathUtils.clamp(0.62 + (1 - barkHeight) * 0.2 + micro * 0.13, 0, 1);
      roughnessField[index] = rough;
      const warm = THREE.MathUtils.clamp(0.58 + barkHeight * 0.45 + macro * 0.15, 0, 1.2);
      const cavity = THREE.MathUtils.clamp((1 - barkHeight) * 0.8 + fissure * 0.25, 0, 1);
      const offset = index * 4;
      write(
        albedo,
        offset,
        (58 + warm * 74) * (1 - cavity * 0.28),
        (31 + warm * 45) * (1 - cavity * 0.34),
        (18 + warm * 24) * (1 - cavity * 0.38),
      );
      write(roughness, offset, rough * 255, rough * 255, rough * 255);
      write(height, offset, barkHeight * 255, barkHeight * 255, barkHeight * 255);
    }
  }

  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * 3.6;
      const dy = (heightField[down + x] - heightField[up + x]) * 2.5;
      const vector = new THREE.Vector3(-dx, -dy, 1).normalize();
      const neighborAverage = (
        heightField[y * size + left]
        + heightField[y * size + right]
        + heightField[up + x]
        + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - heightField[index]);
      const aoValue = THREE.MathUtils.clamp(
        1 - cavity * 4.2 - (1 - heightField[index]) * 0.12,
        0,
        1,
      );
      const offset = index * 4;
      write(
        normal,
        offset,
        (vector.x * 0.5 + 0.5) * 255,
        (vector.y * 0.5 + 0.5) * 255,
        (vector.z * 0.5 + 0.5) * 255,
      );
      write(ao, offset, aoValue * 255, aoValue * 255, aoValue * 255);
    }
  }

  return {
    albedo: dataTexture(albedo, size, size, THREE.SRGBColorSpace),
    roughness: dataTexture(roughness, size, size),
    height: dataTexture(height, size, size),
    normal: dataTexture(normal, size, size),
    ao: dataTexture(ao, size, size),
  };
}

const REPOLIS_LEAF_ANCHOR_SAMPLES = Object.freeze([
  0.18, 0.3, 0.42, 0.54, 0.66, 0.76, 0.84, 0.92, 1,
]);

const REPOLIS_LEAF_ATTACHMENT = Object.freeze({
  parentSocket: 'fine-branch-contact-anchor',
  rootLocalY: -0.42,
  tipLocalY: 0.48,
  contactType: 'embedded-tip-fan',
  embedDepth: 0.075,
  gapTolerance: 0.015,
  rootPivotScale: 1.22,
  bladeWidthScale: 1.18,
  bladeLengthScale: [1.6, 2],
  maxAxialInset: 0.06,
  maxRadialOffset: 0.035,
  maxRadialFraction: 0.45,
  orientation: 'branch-direction-plus-outward-canopy-fan',
});

const REPOLIS_ENERGY_PROFILE = Object.freeze({
  id: 'dominant-main-vein-b',
  canonicalFront: Object.freeze([0, 0, -1]),
  dominantRadius: Object.freeze({
    trunk: 0.078,
    foundation: 0.044,
    macro: 0.036,
  }),
  rearSupportRadius: Object.freeze({
    trunk: 0.015,
    foundation: 0.009,
    macro: 0.0075,
  }),
  sideSupportRadius: Object.freeze({
    trunk: 0.006,
    foundation: 0.0045,
    macro: 0.004,
  }),
  dominantSourceWeight: 1,
  rearSupportSourceWeight: 0.24,
  sideSupportSourceWeight: 0.1,
  barkHaloPolicy: 'vein-bloom-only-no-branch-extraction',
});

function createLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, REPOLIS_LEAF_ATTACHMENT.rootLocalY);
  shape.bezierCurveTo(0.34, -0.16, 0.3, 0.26, 0, 0.48);
  shape.bezierCurveTo(-0.3, 0.26, -0.34, -0.16, 0, REPOLIS_LEAF_ATTACHMENT.rootLocalY);
  const geometry = new THREE.ShapeGeometry(shape, 2);
  geometry.translate(0, -REPOLIS_LEAF_ATTACHMENT.rootLocalY, 0);
  geometry.scale(
    REPOLIS_LEAF_ATTACHMENT.rootPivotScale,
    REPOLIS_LEAF_ATTACHMENT.rootPivotScale,
    REPOLIS_LEAF_ATTACHMENT.rootPivotScale,
  );
  geometry.translate(0, REPOLIS_LEAF_ATTACHMENT.rootLocalY, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function branchGeometryDetail(importance) {
  if (importance === 'trunk') {
    return { tubularSegments: 36, radialSegments: 24, gnarled: 0.12, rootFlare: 0.62 };
  }
  if (importance === 'macro') {
    return { tubularSegments: 24, radialSegments: 16, gnarled: 0.1, rootFlare: 0.18 };
  }
  return { tubularSegments: 12, radialSegments: 9, gnarled: 0.055, rootFlare: 0.08 };
}

function createSurfaceRadius({
  baseRadius,
  tipRadius,
  seed,
  gnarled,
  rootFlare,
}) {
  const rng = seededRandom(seed);
  const phaseA = rng.range(0, Math.PI * 2);
  const phaseB = rng.range(0, Math.PI * 2);
  return (t, angle) => {
    const taper = THREE.MathUtils.lerp(baseRadius, tipRadius, Math.pow(t, 0.86));
    const flare = 1 + rootFlare * Math.exp(-t * 13) * (0.72 + Math.sin(angle * 2 + phaseA) * 0.28);
    const ridges = (
      1
      + Math.sin(angle * 3 + phaseA + t * 5.2) * gnarled * 0.62
      + Math.sin(angle * 7 + phaseB - t * 9.4) * gnarled * 0.28
      + Math.sin(t * 37 + angle * 1.3) * gnarled * 0.15
    );
    return { radius: taper * flare * ridges, ridges };
  };
}

function createBranchGeometry(
  points,
  {
    baseRadius,
    tipRadius,
    tubularSegments = 18,
    radialSegments = 12,
    seed = 1,
    gnarled = 0.08,
    rootFlare = 0,
  },
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => point.clone()),
    false,
    'centripetal',
    0.42,
  );
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const ring = radialSegments + 1;
  const surfaceRadius = createSurfaceRadius({
    baseRadius,
    tipRadius,
    seed,
    gnarled,
    rootFlare,
  });

  for (let segment = 0; segment <= tubularSegments; segment += 1) {
    const t = segment / tubularSegments;
    const center = curve.getPointAt(t);
    const normal = frames.normals[segment];
    const binormal = frames.binormals[segment];
    for (let side = 0; side <= radialSegments; side += 1) {
      const angle = side / radialSegments * Math.PI * 2;
      const { radius, ridges } = surfaceRadius(t, angle);
      const offset = normal.clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      const vertex = center.clone().add(offset);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(side / radialSegments, t);
      const ridgeLight = THREE.MathUtils.clamp(0.72 + ridges * 0.19 + t * 0.06, 0.68, 1.08);
      colors.push(ridgeLight, ridgeLight * 0.94, ridgeLight * 0.85);
    }
  }

  for (let segment = 0; segment < tubularSegments; segment += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const a = segment * ring + side;
      const b = a + ring;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, curve };
}

function branch(
  id,
  parentId,
  points,
  baseRadius,
  tipRadius,
  importance = 'secondary',
) {
  return { id, parentId, points, baseRadius, tipRadius, importance };
}

function macroBranchSpecs() {
  const vector = (x, y, z) => new THREE.Vector3(x, y, z);
  return [
    branch('trunk-core', 'root', [
      vector(0, 0, 0), vector(-0.12, 1.7, 0.04), vector(0.12, 3.5, -0.04),
      vector(-0.05, 5.3, 0.08), vector(0.18, 7.4, -0.02), vector(0.05, 9.5, 0.06),
    ], 1.18, 0.34, 'trunk'),
    branch('left-foundation', 'trunk-core', [
      vector(-0.05, 3.15, 0), vector(-1.8, 4.4, 0.2), vector(-3.8, 5.45, 0.05),
      vector(-6.1, 6.2, 0.35), vector(-8.0, 6.45, 0.15),
    ], 0.72, 0.12, 'macro'),
    branch('right-foundation', 'trunk-core', [
      vector(0.05, 3.45, 0), vector(1.75, 4.7, -0.12), vector(3.7, 5.7, 0.15),
      vector(5.9, 6.35, -0.2), vector(7.7, 6.65, 0.15),
    ], 0.7, 0.12, 'macro'),
    branch('left-crown', 'trunk-core', [
      vector(-0.05, 5.0, 0), vector(-1.5, 6.3, -0.1), vector(-2.8, 7.9, 0.2),
      vector(-4.8, 9.1, -0.05), vector(-6.5, 9.8, 0.35),
    ], 0.58, 0.1, 'macro'),
    branch('right-crown', 'trunk-core', [
      vector(0.1, 5.45, 0), vector(1.4, 6.9, 0.16), vector(2.9, 8.3, -0.15),
      vector(4.7, 9.35, 0.1), vector(6.2, 9.8, -0.25),
    ], 0.57, 0.1, 'macro'),
    branch('center-left-spire', 'trunk-core', [
      vector(0.05, 6.6, 0), vector(-0.75, 8.0, 0.2), vector(-1.1, 10.0, -0.05),
      vector(-1.8, 11.5, 0.15),
    ], 0.42, 0.07, 'macro'),
    branch('center-right-spire', 'trunk-core', [
      vector(0.16, 6.9, 0), vector(0.9, 8.2, -0.12), vector(1.3, 10.1, 0.1),
      vector(2.0, 11.4, -0.15),
    ], 0.4, 0.07, 'macro'),
    branch('left-rear', 'trunk-core', [
      vector(-0.1, 4.7, -0.1), vector(-1.4, 6.0, -1.3), vector(-3.5, 7.2, -2.0),
      vector(-5.2, 8.1, -2.4),
    ], 0.46, 0.08, 'macro'),
    branch('right-rear', 'trunk-core', [
      vector(0.1, 4.9, -0.15), vector(1.5, 6.2, -1.25), vector(3.6, 7.4, -1.9),
      vector(5.25, 8.2, -2.2),
    ], 0.45, 0.08, 'macro'),
  ];
}

function rootSpecs() {
  const vector = (x, y, z) => new THREE.Vector3(x, y, z);
  return [
    branch('root-left-front', 'trunk-core', [vector(-0.15, 0.35, 0.2), vector(-1.5, 0.05, 0.95), vector(-3.2, -0.12, 1.45), vector(-4.7, -0.1, 1.3)], 0.68, 0.09, 'root'),
    branch('root-right-front', 'trunk-core', [vector(0.15, 0.35, 0.2), vector(1.45, 0.04, 0.9), vector(3.0, -0.12, 1.5), vector(4.5, -0.1, 1.25)], 0.66, 0.09, 'root'),
    branch('root-left-rear', 'trunk-core', [vector(-0.2, 0.28, -0.1), vector(-1.4, 0.02, -1.0), vector(-3.1, -0.15, -1.4), vector(-4.2, -0.1, -1.0)], 0.55, 0.07, 'root'),
    branch('root-right-rear', 'trunk-core', [vector(0.2, 0.28, -0.1), vector(1.35, 0.02, -0.95), vector(2.9, -0.14, -1.45), vector(4.0, -0.1, -1.05)], 0.54, 0.07, 'root'),
    branch('root-center-front', 'trunk-core', [vector(0, 0.25, 0.35), vector(0.2, 0.0, 1.25), vector(-0.1, -0.1, 2.5), vector(0.3, -0.08, 3.8)], 0.48, 0.06, 'root'),
    branch('root-center-rear', 'trunk-core', [vector(0, 0.2, -0.25), vector(-0.2, 0.0, -1.2), vector(0.2, -0.12, -2.4), vector(-0.25, -0.1, -3.5)], 0.44, 0.06, 'root'),
  ];
}

function secondaryBranches(parent, seed, density = 1) {
  const rng = seededRandom(`${seed}/${parent.id}/secondary`);
  const curve = new THREE.CatmullRomCurve3(parent.points, false, 'centripetal', 0.42);
  const count = Math.max(3, Math.round((parent.importance === 'trunk' ? 8 : 6) * density));
  const branches = [];
  for (let index = 0; index < count; index += 1) {
    const t = THREE.MathUtils.lerp(0.28, 0.9, (index + 1) / (count + 1));
    const start = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.y, tangent.x, rng.signed() * 0.42).normalize();
    const direction = tangent.clone().multiplyScalar(0.18)
      .addScaledVector(side, index % 2 === 0 ? -rng.range(0.78, 1.08) : rng.range(0.78, 1.08))
      .add(new THREE.Vector3(0, rng.range(0.38, 0.8), rng.signed() * 0.3))
      .normalize();
    const length = rng.range(1.5, parent.importance === 'trunk' ? 2.7 : 2.35);
    const middle = start.clone().addScaledVector(direction, length * 0.48)
      .add(new THREE.Vector3(rng.signed() * 0.2, rng.range(0.12, 0.32), rng.signed() * 0.18));
    const endDirection = direction.clone()
      .add(new THREE.Vector3(rng.signed() * 0.18, rng.range(0.08, 0.28), rng.signed() * 0.18))
      .normalize();
    const end = middle.clone().addScaledVector(endDirection, length * 0.58);
    const base = THREE.MathUtils.lerp(parent.baseRadius, parent.tipRadius, t) * 0.42;
    branches.push(branch(
      `${parent.id}-secondary-${index + 1}`,
      parent.id,
      [start, middle, end],
      Math.max(0.065, base),
      Math.max(0.022, base * 0.28),
      'secondary',
    ));
  }
  return branches;
}

function fineBranches(parent, seed) {
  const rng = seededRandom(`${seed}/${parent.id}/fine`);
  const curve = new THREE.CatmullRomCurve3(parent.points, false, 'centripetal', 0.42);
  const output = [];
  for (let index = 0; index < 2; index += 1) {
    const t = 0.48 + index * 0.28;
    const start = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.y, tangent.x, rng.signed() * 0.55).normalize();
    const direction = tangent.clone().multiplyScalar(0.22)
      .addScaledVector(side, index === 0 ? -0.82 : 0.82)
      .add(new THREE.Vector3(0, rng.range(0.32, 0.58), rng.signed() * 0.3))
      .normalize();
    const length = rng.range(0.65, 1.25);
    const middle = start.clone().addScaledVector(direction, length * 0.55);
    const end = middle.clone().addScaledVector(
      direction.clone().add(new THREE.Vector3(rng.signed() * 0.2, 0.2, rng.signed() * 0.2)).normalize(),
      length * 0.55,
    );
    output.push(branch(
      `${parent.id}-fine-${index + 1}`,
      parent.id,
      [start, middle, end],
      Math.max(0.026, parent.tipRadius * 1.2),
      0.008,
      'fine',
    ));
  }
  return output;
}

function createMaterials(seed, variant, detailed) {
  const textures = detailed ? createBarkTextures(seed) : null;
  const bark = new THREE.MeshStandardMaterial({
    color: detailed ? new THREE.Color(1.02 * variant.branchWarmth, 0.94, 0.82) : 0x76513A,
    map: textures?.albedo ?? null,
    roughness: detailed ? 0.86 : 0.72,
    roughnessMap: textures?.roughness ?? null,
    metalness: 0,
    normalMap: textures?.normal ?? null,
    normalScale: new THREE.Vector2(0.5, 0.34),
    bumpMap: textures?.height ?? null,
    bumpScale: detailed ? 0.065 : 0,
    aoMap: textures?.ao ?? null,
    aoMapIntensity: 0.42,
    vertexColors: true,
  });
  if (bark.aoMap) bark.aoMap.channel = 0;
  bark.name = 'repolis-generated-bark-pbr';
  const cutWood = new THREE.MeshStandardMaterial({
    color: 0xA97A47,
    roughness: 0.82,
    metalness: 0,
  });
  const energyColor = new THREE.Color(variant.energy);
  const energy = new THREE.MeshPhysicalMaterial({
    color: energyColor,
    roughness: 0.34,
    metalness: 0,
    emissive: energyColor,
    emissiveIntensity: 1.48,
    transparent: true,
    opacity: 0.88,
    depthTest: true,
    depthWrite: false,
    vertexColors: true,
  });
  const ornamentEnergy = withPrivateRandom(`${seed}/ornament-material`, () => energy.clone());
  ornamentEnergy.name = 'repolis-hanging-ornament-energy';
  ornamentEnergy.emissiveIntensity = 1.9;
  ornamentEnergy.opacity = 0.96;
  const amberColor = new THREE.Color(variant.amber);
  const cyanColor = new THREE.Color(variant.cyan);
  const amberLeaf = new THREE.MeshPhysicalMaterial({
    color: 0xFFFFFF,
    roughness: 0.46,
    metalness: 0,
    emissive: amberColor,
    emissiveIntensity: 0.42,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const cyanLeaf = amberLeaf.clone();
  cyanLeaf.emissive = cyanColor;
  cyanLeaf.emissiveIntensity = 0.75;
  const moss = new THREE.MeshStandardMaterial({
    color: 0x72834E,
    roughness: 0.97,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
  const ground = new THREE.MeshStandardMaterial({
    color: 0x493F32,
    roughness: 0.95,
    metalness: 0,
    vertexColors: true,
  });
  const glyphGold = new THREE.MeshBasicMaterial({
    color: variant.energy,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glyphCyan = new THREE.MeshBasicMaterial({
    color: variant.cyan,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return {
    bark,
    cutWood,
    energy,
    ornamentEnergy,
    amberLeaf,
    cyanLeaf,
    moss,
    ground,
    glyphGold,
    glyphCyan,
    textures,
    disposable: [
      bark,
      cutWood,
      energy,
      ornamentEnergy,
      amberLeaf,
      cyanLeaf,
      moss,
      ground,
      glyphGold,
      glyphCyan,
    ],
  };
}

function addBranchNode(spec, parentNode, parentOrigin, material, runtime, seed) {
  const origin = spec.points[0].clone();
  const localPoints = spec.points.map((point) => point.clone().sub(origin));
  const detail = branchGeometryDetail(spec.importance);
  const { geometry, curve } = createBranchGeometry(localPoints, {
    baseRadius: spec.baseRadius,
    tipRadius: spec.tipRadius,
    seed: hashString(`${seed}/${spec.id}`),
    ...detail,
  });
  const pivot = new THREE.Group();
  pivot.name = `${spec.id}__pivot`;
  pivot.position.copy(origin.clone().sub(parentOrigin));
  pivot.userData.actionProfile = {
    animationRole: 'socket-anchor',
    pivot: { mode: 'branch-root', localPosition: [0, 0, 0] },
    parentId: spec.parentId,
    transformChannels: ['visibility', 'material-state'],
    constraints: ['parent-locked-to-living-system-after-surface-assembly'],
  };
  parentNode.add(pivot);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${spec.id}__mesh`;
  mesh.castShadow = spec.importance !== 'fine';
  mesh.receiveShadow = true;
  pivot.add(mesh);
  const tipSocket = new THREE.Object3D();
  tipSocket.name = `${spec.id}__tip`;
  tipSocket.position.copy(localPoints.at(-1));
  pivot.add(tipSocket);
  runtime.nodes[spec.id] = pivot;
  runtime.meshes[spec.id] = mesh;
  runtime.sockets[`${spec.id}:tip`] = tipSocket;
  runtime.colliders[spec.id] = {
    type: 'capsule-chain',
    points: spec.points.map((point) => point.toArray()),
    startRadius: spec.baseRadius,
    endRadius: spec.tipRadius,
  };
  runtime.destructionGroups[spec.importance] ??= [];
  runtime.destructionGroups[spec.importance].push(pivot);
  return { pivot, origin, curve, geometry, localPoints };
}

function mergedFineGeometry(specs, seed) {
  const geometries = specs.map((spec) => createBranchGeometry(spec.points, {
    baseRadius: spec.baseRadius,
    tipRadius: spec.tipRadius,
    tubularSegments: 7,
    radialSegments: 5,
    seed: hashString(`${seed}/${spec.id}`),
    gnarled: 0.03,
  }).geometry);
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  return merged;
}

function createGround(seed, materials, root) {
  const rng = seededRandom(`${seed}/ground`);
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(5.7, 5.9, 0.42, 64, 2),
    materials.ground,
  );
  ground.name = 'repolis-ground-island';
  ground.position.y = -0.34;
  ground.scale.z = 0.72;
  ground.receiveShadow = true;
  root.add(ground);

  const rockGeometry = new THREE.DodecahedronGeometry(0.18, 0);
  const rocks = new THREE.InstancedMesh(rockGeometry, materials.ground, 46);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < rocks.count; index += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = Math.sqrt(rng.next()) * 4.9;
    const scale = rng.range(0.35, 1.25);
    matrix.compose(
      new THREE.Vector3(Math.cos(angle) * radius, -0.06, Math.sin(angle) * radius * 0.67),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.next(), rng.next(), rng.next())),
      new THREE.Vector3(scale, scale * rng.range(0.5, 1.1), scale),
    );
    rocks.setMatrixAt(index, matrix);
    rocks.setColorAt(index, new THREE.Color(rng.pick(['#6E644F', '#8A7B59', '#514A3C'])));
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.instanceColor.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  root.add(rocks);
  return { ground, rocks };
}

function createMoss(seed, materials, root, count = 220) {
  const rng = seededRandom(`${seed}/moss`);
  const geometry = new THREE.IcosahedronGeometry(0.085, 1);
  const moss = new THREE.InstancedMesh(geometry, materials.moss, count);
  const matrix = new THREE.Matrix4();
  const palette = ['#50633A', '#6E7E47', '#85945A', '#9A9B67'];
  for (let index = 0; index < count; index += 1) {
    const trunkPatch = index > count * 0.72;
    const angle = rng.range(0, Math.PI * 2);
    const radius = trunkPatch ? rng.range(0.72, 1.0) : rng.range(0.5, 2.2) * Math.sqrt(rng.next());
    const height = trunkPatch ? rng.range(0.35, 3.15) : rng.range(-0.04, 0.16);
    const position = new THREE.Vector3(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius * (trunkPatch ? 0.85 : 0.62),
    );
    const scale = trunkPatch
      ? new THREE.Vector3(rng.range(0.3, 0.75), rng.range(0.06, 0.16), rng.range(0.25, 0.58))
      : new THREE.Vector3(rng.range(0.6, 1.7), rng.range(0.18, 0.42), rng.range(0.6, 1.65));
    matrix.compose(
      position,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.signed() * 0.5, angle, rng.signed() * 0.5)),
      scale,
    );
    moss.setMatrixAt(index, matrix);
    moss.setColorAt(index, new THREE.Color(rng.pick(palette)));
  }
  moss.instanceMatrix.needsUpdate = true;
  moss.instanceColor.needsUpdate = true;
  moss.receiveShadow = true;
  root.add(moss);
  return moss;
}

function createFoliage(seed, variant, materials, anchors, root) {
  const rng = seededRandom(`${seed}/foliage/${variant.id}`);
  const targetCount = Math.round(2600 * variant.foliageDensity);
  const cyanCount = Math.round(targetCount * variant.cyanRatio);
  const amberCount = targetCount - cyanCount;
  const geometry = createLeafGeometry();
  const amberLeaves = new THREE.InstancedMesh(geometry, materials.amberLeaf, amberCount);
  const cyanLeaves = new THREE.InstancedMesh(geometry, materials.cyanLeaf, cyanCount);
  amberLeaves.name = 'repolis-amber-leaf-sprays';
  cyanLeaves.name = 'repolis-cyan-index-leaves';
  const amberPalette = ['#B9651F', '#D6812A', variant.amber, '#FFD16D', '#FFE9A8'];
  const cyanPalette = ['#1A9BAE', '#2EC8D8', variant.cyan, '#8BFAFF'];
  const matrix = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const basisA = new THREE.Vector3();
  const basisB = new THREE.Vector3();
  const canopyOut = new THREE.Vector3();
  const contact = new THREE.Vector3();
  const contactDirection = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();
  const localRoot = new THREE.Vector3(0, REPOLIS_LEAF_ATTACHMENT.rootLocalY, 0);
  const transformedRoot = new THREE.Vector3();
  const instanceScale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const rollQuaternion = new THREE.Quaternion();
  let maxRootGap = 0;
  let minSurfaceInset = Infinity;

  const place = (mesh, index, palette, cyan = false) => {
    const anchor = rng.pick(anchors);
    const fanA = rng.signed();
    const fanB = rng.signed();
    const fanC = rng.signed();
    const roll = rng.range(0, Math.PI * 2);
    const scale = rng.range(0.18, 0.39) * (cyan ? 0.92 : 1);
    const widthScale = rng.range(0.75, 1.35);
    const paletteColor = rng.pick(palette);
    const contactScale = cyan ? 0.78 : 1;
    const axialInset = (fanB * 0.5 + 0.5) * REPOLIS_LEAF_ATTACHMENT.maxAxialInset * contactScale;
    const contactT = Math.max(
      0,
      anchor.sampleT
        - (axialInset + REPOLIS_LEAF_ATTACHMENT.embedDepth) / anchor.curveLength,
    );
    anchor.curve.getPointAt(contactT, contact);
    anchor.curve.getTangentAt(contactT, contactDirection).normalize();
    basisA.set(0, 1, 0).cross(contactDirection);
    if (basisA.lengthSq() < 1e-5) basisA.set(1, 0, 0).cross(contactDirection);
    basisA.normalize();
    basisB.crossVectors(contactDirection, basisA).normalize();
    const conservativeSurfaceRadius = THREE.MathUtils.lerp(
      anchor.baseRadius,
      anchor.tipRadius,
      Math.pow(contactT, 0.86),
    ) * 0.94;
    const radialLimit = Math.min(
      REPOLIS_LEAF_ATTACHMENT.maxRadialOffset * contactScale,
      conservativeSurfaceRadius * REPOLIS_LEAF_ATTACHMENT.maxRadialFraction,
    );
    const radialA = fanA * radialLimit;
    const radialB = fanC * radialLimit * 0.72;
    contact.addScaledVector(basisA, radialA).addScaledVector(basisB, radialB);
    minSurfaceInset = Math.min(
      minSurfaceInset,
      conservativeSurfaceRadius - Math.hypot(radialA, radialB),
    );
    canopyOut.set(
      contact.x,
      Math.max(0.35, contact.y - 5.8),
      contact.z,
    ).normalize();
    direction.copy(contactDirection).multiplyScalar(0.62)
      .addScaledVector(canopyOut, 0.23)
      .addScaledVector(basisA, fanA * 0.32)
      .addScaledVector(basisB, fanC * 0.28);
    direction.y = Math.max(-0.12, direction.y);
    direction.normalize();
    if (direction.dot(contactDirection) < 0.35) {
      direction.addScaledVector(contactDirection, 0.3).normalize();
    }
    quaternion.setFromUnitVectors(up, direction);
    rollQuaternion.setFromAxisAngle(up, roll);
    quaternion.multiply(rollQuaternion);
    const bladeLengthScale = THREE.MathUtils.lerp(
      REPOLIS_LEAF_ATTACHMENT.bladeLengthScale[0],
      REPOLIS_LEAF_ATTACHMENT.bladeLengthScale[1],
      fanB * 0.5 + 0.5,
    );
    const leafLength = scale * bladeLengthScale;
    position.copy(contact).addScaledVector(
      direction,
      -REPOLIS_LEAF_ATTACHMENT.rootLocalY * leafLength,
    );
    instanceScale.set(
      scale * widthScale * REPOLIS_LEAF_ATTACHMENT.bladeWidthScale,
      leafLength,
      scale * REPOLIS_LEAF_ATTACHMENT.bladeWidthScale,
    );
    matrix.compose(
      position,
      quaternion,
      instanceScale,
    );
    maxRootGap = Math.max(
      maxRootGap,
      transformedRoot.copy(localRoot).applyMatrix4(matrix).distanceTo(contact),
    );
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, new THREE.Color(paletteColor));
  };

  for (let index = 0; index < amberCount; index += 1) {
    place(amberLeaves, index, amberPalette);
  }
  for (let index = 0; index < cyanCount; index += 1) {
    place(cyanLeaves, index, cyanPalette, true);
  }
  for (const leaves of [amberLeaves, cyanLeaves]) {
    leaves.instanceMatrix.needsUpdate = true;
    leaves.instanceColor.needsUpdate = true;
    leaves.receiveShadow = true;
    root.add(leaves);
  }
  const attachmentContract = {
    ...REPOLIS_LEAF_ATTACHMENT,
    anchorCount: anchors.length,
    rootedInstances: targetCount,
    verifiedRootedInstances: targetCount,
    maxRootGap,
    rootGapPass: maxRootGap <= REPOLIS_LEAF_ATTACHMENT.gapTolerance,
    minSurfaceInset,
    surfaceContactPass: minSurfaceInset >= 0,
    finalTransformPolicy: 'shared-living-system-no-independent-foliage-sway',
    rootLocal: [0, REPOLIS_LEAF_ATTACHMENT.rootLocalY, 0],
    tipLocal: [0, REPOLIS_LEAF_ATTACHMENT.tipLocalY, 0],
    sourceSystem: 'deterministic-fine-branch-contact-samples',
    sampleT: [...REPOLIS_LEAF_ANCHOR_SAMPLES],
    sourceIds: anchors.map((anchor) => anchor.sourceId),
    socketIds: anchors.map((anchor) => anchor.socketId),
  };
  amberLeaves.userData.attachmentContract = attachmentContract;
  cyanLeaves.userData.attachmentContract = attachmentContract;
  return {
    amberLeaves,
    cyanLeaves,
    count: targetCount,
    geometry,
    attachmentContract,
  };
}

function withLegacyEnergyRandomBudget(seed, build) {
  const globalRandom = Math.random;
  const local = seededRandom(`${seed}/azimuth-complete-energy-v3-painterly/object-ids`);
  Math.random = () => local.next();
  let value;
  try {
    value = build();
  } finally {
    Math.random = globalRandom;
  }
  // V1 created 19 UUID-bearing objects, including PointLight's shadow camera.
  for (let index = 0; index < 76; index += 1) globalRandom();
  return value;
}

function shapePainterlyVein(
  geometry,
  curve,
  tubularSegments,
  radialSegments,
  phase,
  sourceWeight,
) {
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const ringSize = radialSegments + 1;
  for (let segment = 0; segment <= tubularSegments; segment += 1) {
    const t = segment / tubularSegments;
    curve.getPointAt(t, center);
    const taper = 0.72 + Math.pow(Math.sin(Math.PI * t), 0.42) * 0.28;
    const handWeight = THREE.MathUtils.clamp(
      taper * (0.96 + Math.sin(t * Math.PI * 5 + phase) * 0.04),
      0.68,
      1.02,
    );
    const pigment = THREE.MathUtils.clamp(
      0.82 + Math.sin(t * Math.PI * 7 + phase * 1.7) * 0.1
        + Math.sin(t * Math.PI * 17 - phase) * 0.035,
      0.7,
      0.98,
    ) * sourceWeight;
    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const index = segment * ringSize + radial;
      vertex.fromBufferAttribute(position, index)
        .sub(center)
        .multiplyScalar(handWeight)
        .add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
      colors[index * 3] = pigment;
      colors[index * 3 + 1] = pigment;
      colors[index * 3 + 2] = pigment;
    }
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createOrganicEnergyKnotGeometry(knot, seed) {
  const geometry = new THREE.SphereGeometry(1, 9, 6);
  const position = geometry.attributes.position;
  const rng = seededRandom(`${seed}/${knot.specId}/${knot.copy}/${knot.role}/organic-knot`);
  const phase = rng.range(0, Math.PI * 2);
  const root = knot.role === 'root-junction';
  const readabilityLift = root ? 1.12 : 1.15;
  const radialLift = 1 + (readabilityLift - 1) * 0.6;
  const depthLift = 1 + (readabilityLift - 1) * 0.35;
  const width = knot.size * (root ? 0.82 : 0.7) * radialLift;
  const depth = knot.size * (root ? 0.52 : 0.44) * depthLift;
  const length = knot.size * (root ? 1.55 : 1.38) * readabilityLift;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const middle = Math.max(0, 1 - y * y);
    const taper = 1 - Math.max(0, y) * 0.38;
    const sway = Math.sin((y + 1) * Math.PI * 1.3 + phase) * middle * 0.11;
    const asymmetry = 1 + Math.sin(y * Math.PI * 2.2 - phase) * 0.08;
    position.setXYZ(
      index,
      (x * taper * asymmetry + sway) * width,
      y * length,
      z * taper * (2 - asymmetry) * depth,
    );
  }
  const axis = knot.tangent.clone().lerp(knot.outward, root ? 0.24 : 0.34).normalize();
  const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  align.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), phase));
  geometry.applyQuaternion(align);
  geometry.computeVertexNormals();
  return geometry;
}

function createEnergyNetwork(seed, variant, materials, specs, root) {
  return withLegacyEnergyRandomBudget(seed, () => {
    const energyGroup = new THREE.Group();
    energyGroup.name = 'repolis-gold-energy-network';
    const selected = specs.filter((spec) => (
      spec.importance === 'trunk'
      || spec.id.includes('foundation')
      || spec.id.includes('crown')
      || spec.id.includes('spire')
      || spec.id.includes('rear')
    ));
    const veinGeometries = [];
    const knots = [];
    const dominantVeinIds = [];
    const supportVeinIds = [];
    const rearSupportVeinIds = [];
    const sideSupportVeinIds = [];
    const canonicalFront = new THREE.Vector3(...REPOLIS_ENERGY_PROFILE.canonicalFront);
    let copyCount = 0;
    for (const [specIndex, spec] of selected.entries()) {
      const detail = branchGeometryDetail(spec.importance);
      const tubularSegments = spec.importance === 'trunk' ? 64 : 36;
      const curve = new THREE.CatmullRomCurve3(
        spec.points.map((point) => point.clone()),
        false,
        'centripetal',
        0.42,
      );
      const frames = curve.computeFrenetFrames(tubularSegments, false);
      const surfaceRadius = createSurfaceRadius({
        baseRadius: spec.baseRadius,
        tipRadius: spec.tipRadius,
        seed: hashString(`${seed}/${spec.id}`),
        gnarled: detail.gnarled,
        rootFlare: detail.rootFlare,
      });
      const veinRng = seededRandom(`${seed}/${spec.id}/azimuth-complete-energy-v2`);
      const radialCopies = spec.importance === 'trunk' || spec.id.includes('foundation') ? 3 : 2;
      const phase = veinRng.range(0, Math.PI * 2);
      const twist = veinRng.range(-0.28, 0.28);
      const v2TubeRadius = spec.importance === 'trunk' ? 0.042 : spec.id.includes('foundation') ? 0.023 : 0.02;
      const radiusClass = spec.importance === 'trunk' ? 'trunk' : spec.id.includes('foundation') ? 'foundation' : 'macro';
      for (let copy = 0; copy < radialCopies; copy += 1) {
        const dominant = copy === 0;
        const supportKind = dominant ? null : copy === 1 ? 'rear' : 'side';
        const veinRole = dominant ? 'dominant' : `support-${supportKind}`;
        const roleId = dominant ? `${spec.id}:dominant` : `${spec.id}:support-${supportKind}`;
        const tubeRadius = dominant
          ? REPOLIS_ENERGY_PROFILE.dominantRadius[radiusClass]
          : supportKind === 'rear'
            ? REPOLIS_ENERGY_PROFILE.rearSupportRadius[radiusClass]
            : REPOLIS_ENERGY_PROFILE.sideSupportRadius[radiusClass];
        const surfaceGap = dominant
          ? Math.max(v2TubeRadius * 1.22, tubeRadius * 1.06)
          : Math.max(v2TubeRadius * 0.72, tubeRadius * 1.08);
        const supportOffset = supportKind === 'rear'
          ? Math.PI
          : (specIndex % 2 === 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
        const points = [];
        for (let segment = 0; segment <= tubularSegments; segment += 1) {
          const t = segment / tubularSegments;
          const normal = frames.normals[segment];
          const binormal = frames.binormals[segment];
          const projectedX = canonicalFront.dot(normal);
          const projectedY = canonicalFront.dot(binormal);
          const frontAngle = Math.hypot(projectedX, projectedY) > 0.08
            ? Math.atan2(projectedY, projectedX)
            : phase;
          const lineWander = twist * (t - 0.5) * (dominant ? 0.2 : 0.45)
            + Math.sin(t * Math.PI * 2 + phase + copy * 1.7) * (dominant ? 0.035 : 0.055);
          const angle = frontAngle + (dominant ? 0 : supportOffset) + lineWander;
          const center = curve.getPointAt(t);
          const { radius } = surfaceRadius(t, angle);
          const offset = normal.clone().multiplyScalar(Math.cos(angle) * (radius + surfaceGap))
            .addScaledVector(binormal, Math.sin(angle) * (radius + surfaceGap));
          const point = center.clone().add(offset);
          points.push(point);
        }
        const rootIndex = spec.importance === 'trunk' ? 4 : Math.max(2, Math.round(tubularSegments * 0.1));
        const secondaryT = 0.54 + (hashString(`${spec.id}/${copy}/energy-knot`) % 3) * 0.055;
        const secondaryIndex = Math.min(tubularSegments - 2, Math.round(tubularSegments * secondaryT));
        const surfaceCurve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.35);
        const knotAt = (index, size, role) => {
          const t = index / tubularSegments;
          knots.push({
            center: points[index].clone(),
            tangent: points[Math.min(tubularSegments, index + 1)].clone()
              .sub(points[Math.max(0, index - 1)])
              .normalize(),
            outward: points[index].clone().sub(curve.getPointAt(t)).normalize(),
            size,
            role,
            veinRole,
            veinId: roleId,
            specId: spec.id,
            copy,
            t,
          });
        };
        if (spec.importance === 'trunk' || spec.id.includes('foundation') || copy === 0) {
          knotAt(rootIndex, spec.importance === 'trunk' ? 0.12 : 0.082, 'root-junction');
        }
        if ((specIndex * 2 + copy) % 4 === 0) {
          knotAt(secondaryIndex, spec.importance === 'trunk' ? 0.082 : 0.054, 'secondary-accent');
        }
        const veinGeometry = new THREE.TubeGeometry(surfaceCurve, tubularSegments, tubeRadius, 6, false);
        veinGeometries.push(shapePainterlyVein(
          veinGeometry,
          surfaceCurve,
          tubularSegments,
          6,
          phase + copy * 1.7,
          dominant
            ? REPOLIS_ENERGY_PROFILE.dominantSourceWeight
            : supportKind === 'rear'
              ? REPOLIS_ENERGY_PROFILE.rearSupportSourceWeight
              : REPOLIS_ENERGY_PROFILE.sideSupportSourceWeight,
        ));
        if (dominant) dominantVeinIds.push(roleId);
        else {
          supportVeinIds.push(roleId);
          if (supportKind === 'rear') rearSupportVeinIds.push(roleId);
          else sideSupportVeinIds.push(roleId);
        }
        copyCount += 1;
      }
    }
    const mergedVeins = mergeGeometries(veinGeometries, false);
    if (!mergedVeins) throw new Error('Unable to merge azimuth-complete energy veins');
    veinGeometries.forEach((geometry) => geometry.dispose());
    const veins = new THREE.Mesh(mergedVeins, materials.energy);
    veins.name = 'repolis-energy-veins-v3-painterly';
    energyGroup.add(veins);

    const coreAnchor = knots[0]?.center ?? new THREE.Vector3(0, 0.55, 0.98);
    const coreGeometries = knots.map((knot) => {
      const geometry = createOrganicEnergyKnotGeometry(knot, seed);
      geometry.translate(
        knot.center.x - coreAnchor.x,
        knot.center.y - coreAnchor.y,
        knot.center.z - coreAnchor.z,
      );
      return geometry;
    });
    const mergedCore = mergeGeometries(coreGeometries, false);
    if (!mergedCore) throw new Error('Unable to merge azimuth-complete energy cores');
    coreGeometries.forEach((geometry) => geometry.dispose());
    const core = new THREE.Mesh(mergedCore, materials.energy);
    core.position.copy(coreAnchor);
    core.name = 'repolis-energy-core';
    energyGroup.add(core);

    const rootLight = new THREE.PointLight(new THREE.Color(variant.energy), 18, 7, 2);
    rootLight.position.set(0, 1.0, 1.4);
    energyGroup.add(rootLight);
    energyGroup.userData.energyRevision = REPOLIS_FACTORY_REVISION;
    energyGroup.userData.veinCopies = copyCount;
    energyGroup.userData.energyProfile = REPOLIS_ENERGY_PROFILE.id;
    energyGroup.userData.canonicalFront = [...REPOLIS_ENERGY_PROFILE.canonicalFront];
    energyGroup.userData.dominantVeinIds = dominantVeinIds;
    energyGroup.userData.supportVeinIds = supportVeinIds;
    energyGroup.userData.rearSupportVeinIds = rearSupportVeinIds;
    energyGroup.userData.sideSupportVeinIds = sideSupportVeinIds;
    energyGroup.userData.dominantVeinCount = dominantVeinIds.length;
    energyGroup.userData.supportVeinCount = supportVeinIds.length;
    energyGroup.userData.rearSupportVeinCount = rearSupportVeinIds.length;
    energyGroup.userData.sideSupportVeinCount = sideSupportVeinIds.length;
    energyGroup.userData.dominantRadius = { ...REPOLIS_ENERGY_PROFILE.dominantRadius };
    energyGroup.userData.supportRadius = {
      rear: { ...REPOLIS_ENERGY_PROFILE.rearSupportRadius },
      side: { ...REPOLIS_ENERGY_PROFILE.sideSupportRadius },
    };
    energyGroup.userData.sourceWeights = {
      dominant: REPOLIS_ENERGY_PROFILE.dominantSourceWeight,
      rearSupport: REPOLIS_ENERGY_PROFILE.rearSupportSourceWeight,
      sideSupport: REPOLIS_ENERGY_PROFILE.sideSupportSourceWeight,
    };
    energyGroup.userData.barkHaloPolicy = REPOLIS_ENERGY_PROFILE.barkHaloPolicy;
    energyGroup.userData.knotCount = knots.length;
    energyGroup.userData.knotDistribution = 'fifteen-root-junctions-and-six-secondary-accents';
    energyGroup.userData.knotSizes = [0.054, 0.082, 0.12];
    energyGroup.userData.knotSizeCounts = {
      small: knots.filter((knot) => knot.size === 0.054).length,
      medium: knots.filter((knot) => knot.size === 0.082).length,
      large: knots.filter((knot) => knot.size === 0.12).length,
    };
    energyGroup.userData.knotRoleCounts = {
      root: knots.filter((knot) => knot.role === 'root-junction').length,
      secondary: knots.filter((knot) => knot.role === 'secondary-accent').length,
    };
    energyGroup.userData.drawMeshes = 2;
    energyGroup.userData.depthOcclusion = 'bark-surface-depth-tested';
    root.add(energyGroup);
    return {
      group: energyGroup,
      core,
      light: rootLight,
      veins,
      copyCount,
      energyProfile: energyGroup.userData.energyProfile,
      canonicalFront: energyGroup.userData.canonicalFront,
      dominantVeinIds,
      supportVeinIds,
      rearSupportVeinIds,
      sideSupportVeinIds,
      dominantVeinCount: dominantVeinIds.length,
      supportVeinCount: supportVeinIds.length,
      rearSupportVeinCount: rearSupportVeinIds.length,
      sideSupportVeinCount: sideSupportVeinIds.length,
      dominantRadius: energyGroup.userData.dominantRadius,
      supportRadius: energyGroup.userData.supportRadius,
      sourceWeights: energyGroup.userData.sourceWeights,
      barkHaloPolicy: energyGroup.userData.barkHaloPolicy,
      knotCount: knots.length,
      knotDistribution: energyGroup.userData.knotDistribution,
      knotSizes: energyGroup.userData.knotSizes,
      knotRoleCounts: energyGroup.userData.knotRoleCounts,
      revision: REPOLIS_FACTORY_REVISION,
    };
  });
}

function createCodeGlyphs(seed, materials, specs, root) {
  const rng = seededRandom(`${seed}/code-glyphs`);
  const selected = specs.filter((spec) => (
    spec.importance === 'trunk'
    || spec.id.includes('foundation')
    || spec.id.includes('crown')
    || spec.id.includes('spire')
  ));
  const glyphs = [];
  for (const spec of selected) {
    const curve = new THREE.CatmullRomCurve3(spec.points, false, 'centripetal', 0.42);
    const count = spec.importance === 'trunk' ? 18 : 9;
    for (let index = 0; index < count; index += 1) {
      const t = THREE.MathUtils.lerp(0.12, 0.9, (index + 1) / (count + 1));
      glyphs.push({
        position: curve.getPointAt(t).add(new THREE.Vector3(0, 0, spec.importance === 'trunk' ? 1.04 : 0.18)),
        tangent: curve.getTangentAt(t).normalize(),
        cyan: rng.next() < 0.22,
        scale: rng.range(0.72, 1.3),
      });
    }
  }
  const geometry = new THREE.PlaneGeometry(0.07, 0.2);
  const goldData = glyphs.filter((glyph) => !glyph.cyan);
  const cyanData = glyphs.filter((glyph) => glyph.cyan);
  const up = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4();
  const build = (data, material, name) => {
    const mesh = new THREE.InstancedMesh(geometry, material, data.length);
    mesh.name = name;
    data.forEach((glyph, index) => {
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, glyph.tangent);
      matrix.compose(
        glyph.position,
        quaternion,
        new THREE.Vector3(glyph.scale, glyph.scale, glyph.scale),
      );
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
    return mesh;
  };
  return {
    gold: build(goldData, materials.glyphGold, 'repolis-gold-code-glyphs'),
    cyan: build(cyanData, materials.glyphCyan, 'repolis-cyan-code-glyphs'),
    count: glyphs.length,
    geometry,
  };
}

function createConstellations(seed, variant, materials, anchors, root) {
  const rng = seededRandom(`${seed}/constellations/${variant.id}`);
  const group = new THREE.Group();
  group.name = 'repolis-constellation-and-hanging-lights';
  const nodeGeometry = new THREE.SphereGeometry(0.055, 10, 8);
  const nodes = new THREE.InstancedMesh(nodeGeometry, materials.energy, 46);
  const points = [];
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < nodes.count; index += 1) {
    const anchor = rng.pick(anchors);
    const position = anchor.position.clone().add(new THREE.Vector3(
      rng.signed() * 0.45,
      rng.range(-0.2, 0.65),
      rng.range(0.45, 1.25),
    ));
    points.push(position);
    const scale = rng.range(0.55, 1.35);
    matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
    nodes.setMatrixAt(index, matrix);
  }
  nodes.instanceMatrix.needsUpdate = true;
  group.add(nodes);

  const linePositions = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    if (index % 5 === 4) continue;
    if (points[index].distanceTo(points[index + 1]) > 1.4) continue;
    linePositions.push(...points[index].toArray(), ...points[index + 1].toArray());
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  const lines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: variant.cyan,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(lines);

  const hangingAnchors = anchors
    .filter((anchor) => anchor.position.y > 5 && Math.abs(anchor.position.x) > 2.4)
    .slice(0, 18);
  for (const [index, anchor] of hangingAnchors.entries()) {
    const length = 0.45 + (index % 5) * 0.17;
    const curve = new THREE.LineCurve3(
      anchor.position.clone(),
      anchor.position.clone().add(new THREE.Vector3(0, -length, 0)),
    );
    group.add(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 4, 0.016, 5, false),
      materials.ornamentEnergy,
    ));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), materials.ornamentEnergy);
    bulb.position.copy(curve.v2);
    group.add(bulb);
  }
  group.userData.hangingLightCount = hangingAnchors.length;
  group.userData.hangingLightPolicy = 'bright-base-emissive-no-extra-bloom-draws';
  root.add(group);
  return {
    group,
    nodes,
    lines,
    hangingLightCount: hangingAnchors.length,
    hangingLightPolicy: group.userData.hangingLightPolicy,
  };
}

export function createRepolisHero({
  seed = 20260711,
  variant = 0,
  stage = 'full',
} = {}) {
  const startedAt = performance.now();
  const variantConfig = typeof variant === 'number'
    ? REPOLIS_VARIANTS[variant % REPOLIS_VARIANTS.length]
    : REPOLIS_VARIANTS.find((item) => item.id === variant) ?? REPOLIS_VARIANTS[0];
  const stageLevel = STAGE_LEVEL[stage] ?? STAGE_LEVEL.full;
  const root = new THREE.Group();
  root.name = 'RepolisHeroTree';
  const livingSystem = new THREE.Group();
  livingSystem.name = 'repolis-living-system';
  root.add(livingSystem);
  const branchSystem = new THREE.Group();
  branchSystem.name = 'repolis-action-ready-branch-system';
  livingSystem.add(branchSystem);
  const runtime = {
    nodes: { root, 'living-system': livingSystem, 'branch-system': branchSystem },
    meshes: {},
    sockets: {},
    colliders: {
      trunk: { type: 'compound-capsule', height: 9.8, radius: 1.15 },
      crown: { type: 'ellipsoid', center: [0, 8.1, 0], scale: [8.2, 4.6, 3.8] },
    },
    destructionGroups: {},
  };
  const detailedMaterial = stageLevel >= STAGE_LEVEL['material-pass'];
  const materials = createMaterials(seed, variantConfig, detailedMaterial);
  const macroSpecs = macroBranchSpecs();
  const roots = rootSpecs();
  const allMacro = stageLevel >= STAGE_LEVEL['structural-pass']
    ? [...macroSpecs, ...roots]
    : macroSpecs;
  const branchRecords = new Map();
  let vertexCount = 0;

  for (const spec of allMacro) {
    const parentRecord = branchRecords.get(spec.parentId);
    const parentNode = parentRecord?.pivot ?? branchSystem;
    const parentOrigin = parentRecord?.origin ?? new THREE.Vector3();
    const record = addBranchNode(
      spec,
      parentNode,
      parentOrigin,
      materials.bark,
      runtime,
      seed,
    );
    branchRecords.set(spec.id, record);
    vertexCount += record.geometry.getAttribute('position').count;
  }

  const secondary = stageLevel >= STAGE_LEVEL['structural-pass']
    ? macroSpecs.flatMap((spec) => secondaryBranches(spec, seed, stageLevel >= STAGE_LEVEL['form-refinement'] ? 1 : 0.62))
    : [];
  for (const spec of secondary) {
    const parentRecord = branchRecords.get(spec.parentId);
    const record = addBranchNode(
      spec,
      parentRecord?.pivot ?? branchSystem,
      parentRecord?.origin ?? new THREE.Vector3(),
      materials.bark,
      runtime,
      seed,
    );
    branchRecords.set(spec.id, record);
    vertexCount += record.geometry.getAttribute('position').count;
  }

  const fine = stageLevel >= STAGE_LEVEL['form-refinement']
    ? secondary.flatMap((spec) => fineBranches(spec, seed))
    : [];
  if (fine.length) {
    const fineGeometry = mergedFineGeometry(fine, seed);
    const fineMesh = new THREE.Mesh(fineGeometry, materials.bark);
    fineMesh.name = 'repolis-fine-branches-merged';
    fineMesh.receiveShadow = true;
    branchSystem.add(fineMesh);
    runtime.meshes['fine-branches'] = fineMesh;
    vertexCount += fineGeometry.getAttribute('position').count;
  }

  const anchorSpecs = fine.length ? fine : secondary.length ? secondary : macroSpecs;
  const anchors = anchorSpecs.map((spec) => {
    const end = spec.points.at(-1).clone();
    const before = spec.points.at(-2) ?? spec.points[0];
    return {
      position: end,
      direction: end.clone().sub(before).normalize(),
      sourceId: spec.id,
      socketId: `${spec.id}:implicit-tip`,
    };
  });
  const leafAnchorSamples = REPOLIS_LEAF_ANCHOR_SAMPLES;
  const leafAnchors = anchorSpecs.flatMap((spec) => {
    const curve = new THREE.CatmullRomCurve3(spec.points, false, 'centripetal', 0.42);
    const curveLength = curve.getLength();
    return leafAnchorSamples.map((sampleT, sampleIndex) => ({
      position: curve.getPointAt(sampleT),
      direction: curve.getTangentAt(sampleT).normalize(),
      curve,
      curveLength,
      baseRadius: spec.baseRadius,
      tipRadius: spec.tipRadius,
      sourceId: spec.id,
      socketId: `${spec.id}:leaf-contact-${sampleIndex + 1}`,
      sampleT,
    }));
  });
  const ground = createGround(seed, materials, root);
  let moss = null;
  let foliage = null;
  let energy = null;
  let constellations = null;
  let glyphs = null;
  if (stageLevel >= STAGE_LEVEL['material-pass']) {
    energy = createEnergyNetwork(seed, variantConfig, materials, macroSpecs, livingSystem);
    runtime.nodes['energy-network'] = energy.group;
    runtime.sockets['energy:root'] = energy.core;
    runtime.meshes['energy-veins'] = energy.veins;
  }
  if (stageLevel >= STAGE_LEVEL['material-pass']) {
    foliage = createFoliage(seed, variantConfig, materials, leafAnchors, livingSystem);
    runtime.meshes['amber-foliage'] = foliage.amberLeaves;
    runtime.meshes['cyan-foliage'] = foliage.cyanLeaves;
  }
  if (stageLevel >= STAGE_LEVEL['surface-pass']) {
    moss = createMoss(seed, materials, livingSystem);
    glyphs = createCodeGlyphs(seed, materials, macroSpecs, livingSystem);
    constellations = createConstellations(seed, variantConfig, materials, anchors, livingSystem);
    runtime.meshes.moss = moss;
    runtime.meshes['gold-code-glyphs'] = glyphs.gold;
    runtime.meshes['cyan-code-glyphs'] = glyphs.cyan;
    runtime.nodes.constellations = constellations.group;
  }

  root.userData.sculptRuntime = {
    nodeIds: Object.keys(runtime.nodes),
    meshIds: Object.keys(runtime.meshes),
    socketIds: Object.keys(runtime.sockets),
    colliders: runtime.colliders,
    destructionGroupIds: Object.keys(runtime.destructionGroups),
    leafAttachment: foliage?.attachmentContract ?? null,
    liveRuntime: 'Use the returned hero.runtime object for Object3D references.',
  };
  root.userData.sculptDNA = {
    seed,
    variantId: variantConfig.id,
    variantLabel: variantConfig.label,
    stage,
    energyNetworkRevision: energy?.revision ?? null,
    invariantPolicy: [
      'component-ids',
      'parent-links',
      'socket-ids',
      'attachment-roots',
      'leaf-root-attachments',
      'destruction-groups',
    ],
  };
  const generationMs = performance.now() - startedAt;
  const stats = {
    generationMs,
    macroBranches: allMacro.length,
    secondaryBranches: secondary.length,
    fineBranches: fine.length,
    leafInstances: foliage?.count ?? 0,
    leafAnchorCount: foliage?.attachmentContract.anchorCount ?? 0,
    leafRootedInstances: foliage?.attachmentContract.rootedInstances ?? 0,
    leafAttachmentContract: foliage?.attachmentContract ?? null,
    mossInstances: moss?.count ?? 0,
    branchVertices: vertexCount,
    glyphInstances: glyphs?.count ?? 0,
    energyVeinCopies: energy?.copyCount ?? 0,
    energyProfile: energy?.energyProfile ?? null,
    energyCanonicalFront: energy?.canonicalFront ?? null,
    energyDominantVeinIds: energy?.dominantVeinIds ?? [],
    energySupportVeinIds: energy?.supportVeinIds ?? [],
    energyRearSupportVeinIds: energy?.rearSupportVeinIds ?? [],
    energySideSupportVeinIds: energy?.sideSupportVeinIds ?? [],
    energyDominantVeinCount: energy?.dominantVeinCount ?? 0,
    energySupportVeinCount: energy?.supportVeinCount ?? 0,
    energyRearSupportVeinCount: energy?.rearSupportVeinCount ?? 0,
    energySideSupportVeinCount: energy?.sideSupportVeinCount ?? 0,
    energyDominantRadius: energy?.dominantRadius ?? null,
    energySupportRadius: energy?.supportRadius ?? null,
    energySourceWeights: energy?.sourceWeights ?? null,
    energyBarkHaloPolicy: energy?.barkHaloPolicy ?? null,
    energyKnotCount: energy?.knotCount ?? 0,
    energyKnotDistribution: energy?.knotDistribution ?? null,
    energyKnotSizes: energy?.knotSizes ?? [],
    energyKnotRoles: energy?.knotRoleCounts ?? null,
    energyDrawMeshes: energy ? 2 : 0,
    hangingLightCount: constellations?.hangingLightCount ?? 0,
    hangingLightPolicy: constellations?.hangingLightPolicy ?? null,
    importedMeshes: 0,
    stage,
  };
  root.userData.generationStats = stats;

  const update = (elapsedSeconds) => {
    if (energy) {
      const pulse = 1.48 + Math.sin(elapsedSeconds * 2.1) * 0.1;
      materials.energy.emissiveIntensity = pulse;
      materials.ornamentEnergy.emissiveIntensity = 1.9 + Math.sin(elapsedSeconds * 2.3) * 0.08;
      energy.light.intensity = 16 + Math.sin(elapsedSeconds * 1.7) * 3;
    }
    livingSystem.rotation.z = Math.sin(elapsedSeconds * 0.22) * 0.0025;
    livingSystem.rotation.x = Math.sin(elapsedSeconds * 0.17 + 0.8) * 0.0015;
  };

  const dispose = () => {
    const geometries = new Set();
    const disposableMaterials = new Set(materials.disposable);
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      objectMaterials.forEach((material) => disposableMaterials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    disposableMaterials.forEach((material) => material.dispose());
    Object.values(materials.textures ?? {}).forEach((texture) => texture.dispose());
  };

  return {
    root,
    runtime,
    stats,
    variant: variantConfig,
    update,
    dispose,
    materials,
    ground,
  };
}
