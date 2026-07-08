#!/usr/bin/env python3
"""
Convert USDZ → GLB using OpenUSD (resolves all mesh instances).

Three.js USDLoader only loads a fraction of instanced meshes from CAD
exports. This script uses pxr to export the full scene, then compresses
with gltf-transform.

Usage:
  .venv-usd/bin/python scripts/usdz-to-glb.py <input.usdz> [output.glb]
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from pxr import Gf, Usd, UsdGeom, UsdShade

ROOT = Path(__file__).resolve().parents[1]

# USD is Z-up; glTF is Y-up.
Z_UP_TO_Y_UP = np.array(
    [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 0.0, -1.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ],
    dtype=np.float64,
)


def gf_to_numpy(matrix: Gf.Matrix4d) -> np.ndarray:
    return np.array(matrix, dtype=np.float64).reshape(4, 4).T


def apply_transform(points: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    ones = np.ones((len(points), 1), dtype=np.float64)
    homogenous = np.hstack([points, ones])
    return (matrix @ homogenous.T).T[:, :3]


def get_diffuse_color(prim) -> tuple[float, float, float]:
    binding = UsdShade.MaterialBindingAPI(prim)
    material, _ = binding.ComputeBoundMaterial()
    if not material:
        return (0.8, 0.8, 0.8)

    for child in material.GetPrim().GetChildren():
        shader = UsdShade.Shader(child)
        if shader.GetIdAttr().Get() != "UsdPreviewSurface":
            continue
        color = shader.GetInput("diffuseColor").Get()
        if color is not None:
            return (float(color[0]), float(color[1]), float(color[2]))

    return (0.8, 0.8, 0.8)


def triangulate_faces(face_counts: list[int], face_indices: list[int]) -> list[list[int]]:
    triangles: list[list[int]] = []
    cursor = 0

    for count in face_counts:
        face = face_indices[cursor : cursor + count]
        cursor += count
        if count < 3:
            continue
        for i in range(1, count - 1):
            triangles.append([face[0], face[i], face[i + 1]])

    return triangles


def build_trimesh(
    points: np.ndarray,
    face_counts: list[int],
    face_indices: list[int],
    face_filter: set[int] | None,
    world_xform: np.ndarray,
    color: tuple[float, float, float],
    meters_per_unit: float,
) -> trimesh.Trimesh | None:
    selected_triangles: list[list[int]] = []
    cursor = 0

    for face_index, count in enumerate(face_counts):
        face = face_indices[cursor : cursor + count]
        cursor += count
        if face_filter is not None and face_index not in face_filter:
            continue
        if count < 3:
            continue
        for i in range(1, count - 1):
            selected_triangles.append([face[0], face[i], face[i + 1]])

    if not selected_triangles:
        return None

    vertices = apply_transform(points, Z_UP_TO_Y_UP @ world_xform) * meters_per_unit
    faces = np.asarray(selected_triangles, dtype=np.int64)

    return trimesh.Trimesh(
        vertices=vertices,
        faces=faces,
        visual=trimesh.visual.TextureVisuals(
            material=PBRMaterial(
                baseColorFactor=[color[0], color[1], color[2], 1.0],
                metallicFactor=0.2,
                roughnessFactor=0.45,
                doubleSided=True,
            )
        ),
        process=False,
    )


def mesh_parts(mesh_prim, world_xform: np.ndarray, meters_per_unit: float) -> list[trimesh.Trimesh]:
    mesh = UsdGeom.Mesh(mesh_prim)
    points = np.asarray(mesh.GetPointsAttr().Get(), dtype=np.float64)
    face_counts = list(mesh.GetFaceVertexCountsAttr().Get() or [])
    face_indices = list(mesh.GetFaceVertexIndicesAttr().Get() or [])

    if len(points) == 0 or not face_counts or not face_indices:
        return []

    parts: list[trimesh.Trimesh] = []
    subsets = [child for child in mesh_prim.GetChildren() if child.IsA(UsdGeom.Subset)]

    if subsets:
        for subset_prim in subsets:
            subset = UsdGeom.Subset(subset_prim)
            subset_faces = set(subset.GetIndicesAttr().Get() or [])
            color = get_diffuse_color(subset_prim)
            part = build_trimesh(
                points,
                face_counts,
                face_indices,
                subset_faces,
                world_xform,
                color,
                meters_per_unit,
            )
            if part is not None:
                parts.append(part)
        return parts

    color = get_diffuse_color(mesh_prim)
    part = build_trimesh(
        points,
        face_counts,
        face_indices,
        None,
        world_xform,
        color,
        meters_per_unit,
    )
    return [part] if part is not None else []


def export_usdz_to_glb(input_path: Path, output_path: Path) -> tuple[int, int]:
    stage = Usd.Stage.Open(str(input_path))
    if stage is None:
        raise RuntimeError(f"Failed to open USD stage: {input_path}")

    meters_per_unit = UsdGeom.GetStageMetersPerUnit(stage)

    scene = trimesh.Scene()
    mesh_count = 0
    part_count = 0

    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue

        imageable = UsdGeom.Imageable(prim)
        visibility = imageable.ComputeVisibility(Usd.TimeCode.Default())
        if visibility == UsdGeom.Tokens.invisible:
            continue

        xform = UsdGeom.Xformable(prim)
        world_xform = gf_to_numpy(xform.ComputeLocalToWorldTransform(Usd.TimeCode.Default()))

        for part in mesh_parts(prim, world_xform, meters_per_unit):
            scene.add_geometry(part)
            part_count += 1

        mesh_count += 1

    if part_count == 0:
        raise RuntimeError("No mesh geometry found in USDZ")

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
        intermediate_path = Path(tmp.name)

    try:
        scene.export(intermediate_path, file_type="glb")
        run_gltf_transform(intermediate_path, output_path)
    finally:
        intermediate_path.unlink(missing_ok=True)

    return mesh_count, part_count


def run_gltf_transform(input_path: Path, output_path: Path) -> None:
    cli = ROOT / "node_modules" / "@gltf-transform" / "cli" / "bin" / "cli.js"
    if not cli.exists():
        raise RuntimeError("Missing @gltf-transform/cli. Run: npm install")

    result = subprocess.run(
        [
            "node",
            str(cli),
            "optimize",
            str(input_path),
            str(output_path),
            "--compress",
            "meshopt",
            "--meshopt-level",
            "medium",
            "--texture-compress",
            "webp",
            "--texture-size",
            "2048",
            "--simplify",
            "false",
        ],
        cwd=ROOT,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError("gltf-transform optimize failed")


def format_bytes(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    if num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    return f"{num_bytes / (1024 * 1024):.2f} MB"


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert USDZ to compressed GLB via OpenUSD")
    parser.add_argument("input", type=Path, help="Input .usdz file")
    parser.add_argument("output", nargs="?", type=Path, help="Output .glb file")
    args = parser.parse_args()

    input_path = args.input.resolve()
    output_path = (
        args.output.resolve()
        if args.output
        else input_path.with_suffix(".glb")
    )

    if input_path.suffix.lower() != ".usdz":
        print("Input must be a .usdz file", file=sys.stderr)
        return 1

    input_size = input_path.stat().st_size
    print(f"Input:  {input_path} ({format_bytes(input_size)})")
    print("Loading USDZ with OpenUSD...")

    mesh_count, part_count = export_usdz_to_glb(input_path, output_path)

    output_size = output_path.stat().st_size
    savings = (1 - output_size / input_size) * 100
    print(f"Parsed {mesh_count} mesh(es) → {part_count} part(s)")
    print(f"Output: {output_path} ({format_bytes(output_size)}, {savings:.1f}% smaller than USDZ)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
