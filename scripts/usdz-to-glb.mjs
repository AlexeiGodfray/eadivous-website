#!/usr/bin/env node
/**
 * Convert USDZ → GLB with light compression for web use.
 *
 * Pipeline:
 *   1. Parse USDZ with Three.js USDLoader
 *   2. Re-orient Z-up USD assets to glTF's Y-up convention
 *   3. Export intermediate GLB with GLTFExporter
 *   4. Optimize with gltf-transform (meshopt + webp textures)
 *
 * Usage:
 *   node scripts/usdz-to-glb.mjs <input.usdz> [output.glb]
 *   npm run convert:usdz -- path/to/model.usdz
 */

import './browser-polyfill.mjs';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

function usage() {
  console.log(`Usage: node scripts/usdz-to-glb.mjs <input.usdz> [output.glb]

Options:
  --level <medium|high>   Meshopt compression level (default: medium)
  --no-simplify           Skip mesh simplification (geometry preserved)
  --texture-size <px>     Max texture size (default: 2048)
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    level: 'medium',
    simplify: true,
    textureSize: 2048,
  };

  const positional = [];

  while (args.length > 0) {
    const token = args.shift();
    if (token === '--level') {
      options.level = args.shift();
      continue;
    }
    if (token === '--no-simplify') {
      options.simplify = false;
      continue;
    }
    if (token === '--texture-size') {
      options.textureSize = Number(args.shift());
      continue;
    }
    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }
    positional.push(token);
  }

  return { positional, options };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isValidTextureMap(map) {
  if (!map?.image) return false;
  const { width, height } = map.image;
  return width > 0 && height > 0;
}

function stripInvalidTextures(material) {
  const textureKeys = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
  ];

  for (const key of textureKeys) {
    const map = material[key];
    if (map && !isValidTextureMap(map)) {
      material[key] = null;
    }
  }

  return material;
}

function upgradeMaterial(material) {
  if (material instanceof THREE.MeshPhongMaterial) {
    const upgraded = new THREE.MeshStandardMaterial({
      color: material.color,
      map: isValidTextureMap(material.map) ? material.map : null,
      transparent: material.transparent,
      opacity: material.opacity,
      metalness: 0.15,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    material.dispose();
    return stripInvalidTextures(upgraded);
  }

  if (material instanceof THREE.MeshStandardMaterial) {
    material.side = THREE.DoubleSide;
    return stripInvalidTextures(material);
  }

  material.side = THREE.DoubleSide;
  return stripInvalidTextures(material);
}

function prepareModel(root) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    if (Array.isArray(child.material)) {
      child.material = child.material.map(upgradeMaterial);
    } else {
      child.material = upgradeMaterial(child.material);
    }
  });
}

async function loadUsdz(inputPath) {
  const buffer = readFileSync(inputPath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );

  const model = new USDLoader().parse(arrayBuffer);
  const scene = new THREE.Group();
  scene.name = basename(inputPath, extname(inputPath));

  // USD assets are typically Z-up; glTF is Y-up.
  const oriented = new THREE.Group();
  oriented.rotation.x = -Math.PI / 2;
  oriented.add(model);
  scene.add(oriented);

  prepareModel(scene);
  return scene;
}

async function exportGlb(scene) {
  const exporter = new GLTFExporter();
  return exporter.parseAsync(scene, { binary: true });
}

function runGltfTransform(inputPath, outputPath, options) {
  const cliEntry = join(
    PROJECT_ROOT,
    'node_modules',
    '@gltf-transform',
    'cli',
    'bin',
    'cli.js',
  );

  const args = [
    cliEntry,
    'optimize',
    inputPath,
    outputPath,
    '--compress',
    'meshopt',
    '--meshopt-level',
    options.level,
    '--texture-compress',
    'webp',
    '--texture-size',
    String(options.textureSize),
    '--simplify',
    options.simplify ? 'true' : 'false',
    '--simplify-ratio',
    '1',
    '--simplify-error',
    '0.0001',
  ];

  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
  });

  if (result.status !== 0) {
    throw new Error('gltf-transform optimize failed');
  }
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));

  if (options.help || positional.length === 0) {
    usage();
    process.exit(options.help ? 0 : 1);
  }

  const inputPath = resolve(positional[0]);
  const outputPath = resolve(
    positional[1] ?? inputPath.replace(/\.usdz$/i, '.glb'),
  );

  if (!inputPath.toLowerCase().endsWith('.usdz')) {
    console.error('Input must be a .usdz file');
    process.exit(1);
  }

  const inputStat = statSync(inputPath);
  console.log(`Input:  ${inputPath} (${formatBytes(inputStat.size)})`);

  const tempDir = mkdtempSync(join(tmpdir(), 'usdz-to-glb-'));
  const intermediatePath = join(tempDir, 'intermediate.glb');

  try {
    console.log('Loading USDZ...');
    const scene = await loadUsdz(inputPath);

    let meshCount = 0;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) meshCount += 1;
    });
    console.log(`Parsed ${meshCount} mesh(es)`);

    console.log('Exporting intermediate GLB...');
    const glb = await exportGlb(scene);
    writeFileSync(intermediatePath, Buffer.from(glb));

    const intermediateStat = statSync(intermediatePath);
    console.log(`Intermediate GLB: ${formatBytes(intermediateStat.size)}`);

    console.log('Compressing with gltf-transform (meshopt + webp)...');
    runGltfTransform(intermediatePath, outputPath, options);

    const outputStat = statSync(outputPath);
    const savings = ((1 - outputStat.size / inputStat.size) * 100).toFixed(1);
    console.log(`Output: ${outputPath} (${formatBytes(outputStat.size)}, ${savings}% smaller than USDZ)`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
