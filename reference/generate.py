"""Make independent continuous-aperture Fraunhofer references.

Run with NumPy, SciPy and Pillow. Coordinates q = f D are dimensionless.
Polygon amplitudes use a boundary integral and stadium uses strip quadrature.
The browser's rasterizer/FFT is deliberately absent from this generator.
"""
from pathlib import Path
import json

import numpy as np
from PIL import Image
from scipy.special import j1, roots_legendre


SHAPES = ("circle", "square", "triangle", "hexagon", "stadium", "double-circle")
FOLDER = Path(__file__).with_name("generated")
PALETTE = np.array([[4, 15, 19], [17, 42, 55], [23, 94, 111],
                    [57, 155, 152], [167, 213, 169], [255, 234, 168]])


def airy(qx, qy):
    phase = np.pi * np.hypot(qx, qy)
    return np.divide(2 * j1(phase), phase, out=np.ones_like(phase), where=phase != 0)


def polygon(qx, qy, count):
    angle = np.pi / 2 + np.arange(count) * 2 * np.pi / count
    points = np.column_stack((np.cos(angle), np.sin(angle))) / 2
    edges = np.roll(points, -1, axis=0) - points
    kx, ky = 2 * np.pi * qx, 2 * np.pi * qy
    k_squared = kx**2 + ky**2
    area = count * np.sin(2 * np.pi / count) / 8
    total = np.zeros_like(qx, dtype=np.complex128)
    for (x, y), (dx, dy) in zip(points, edges):
        phase = kx * (x + dx / 2) + ky * (y + dy / 2)
        total += 1j * (kx * dy - ky * dx) * np.exp(-1j * phase) * np.sinc(qx * dx + qy * dy)
    return np.divide(total, k_squared * area, out=np.ones_like(total), where=k_squared != 0)


def stadium(qx, qy):
    nodes, weights = roots_legendre(72)
    total = np.zeros_like(qx)
    for node, weight in zip(nodes, weights):
        # The long axis is horizontal. Integrate the vertical strip amplitude
        # over positive x, using symmetry and a change of variables in the cap.
        x = (node + 1) / 4
        total += weight / 2 * np.cos(2 * np.pi * qx * x) * np.sinc(qy)
        angle = (node + 1) * np.pi / 4
        cap_x = (1 + np.sin(angle)) / 2
        cap_height = np.cos(angle)
        total += (weight * np.pi / 4 * cap_height**2
                  * np.cos(2 * np.pi * qx * cap_x) * np.sinc(cap_height * qy))
    return total / (1 + np.pi / 4)


def intensity(shape, qx, qy):
    if shape == "circle":
        amplitude = airy(qx, qy)
    elif shape == "square":
        amplitude = np.sinc(qx) * np.sinc(qy)
    elif shape == "triangle":
        amplitude = polygon(qx, qy, 3)
    elif shape == "hexagon":
        amplitude = polygon(qx, qy, 6)
    elif shape == "stadium":
        amplitude = stadium(qx, qy)
    else:
        amplitude = airy(qx, qy) * np.cos(2 * np.pi * qx)
    return np.clip(np.abs(amplitude)**2, 0, 1)


def write_references():
    FOLDER.mkdir(exist_ok=True)
    # All samples use λ = 632.8 nm, z = 10 m and D = 1 mm by default.
    # On the screen this domain is ±37.968 mm at those values.
    q = np.linspace(-6, 6, 257)
    qx, qy = np.meshgrid(q, q[::-1])
    coarse = np.linspace(-6, 6, 49)
    grid_x, grid_y = np.meshgrid(coarse, coarse)
    sample_values = {}
    for shape in SHAPES:
        raw = intensity(shape, qx, qy)
        normalized_log = 1 + np.log10(np.maximum(1e-6, raw)) / 6
        key = normalized_log * (len(PALETTE) - 1)
        rgb = [np.interp(key, np.arange(len(PALETTE)), PALETTE[:, column]) for column in range(3)]
        Image.fromarray(np.round(np.stack(rgb, axis=-1)).astype(np.uint8)).save(FOLDER / (shape + ".png"))
        values = intensity(shape, grid_x, grid_y)
        sample_values[shape] = [float(f"{value:.9g}") for value in values.ravel()]
    with (FOLDER / "profiles.json").open("w", encoding="utf-8") as file:
        json.dump({"dimension": 49, "halfWidthQ": 6, "wavelength": 632.8e-9, "distance": 10,
                   "size": 1e-3, "spacingRatio": 2, "rows": "y ascending",
                   "intensity": sample_values}, file, separators=(",", ":"))
        file.write("\n")


if __name__ == "__main__":
    write_references()
