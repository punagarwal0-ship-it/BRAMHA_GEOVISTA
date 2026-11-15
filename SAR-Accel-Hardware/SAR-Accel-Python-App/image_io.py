"""Helpers for simple row-major hexadecimal pixel files used by Verilog."""

from pathlib import Path


def read_hex_pixels(path, width, height):
    values = [int(token, 16) for token in Path(path).read_text().split()]
    expected = width * height
    if len(values) != expected:
        raise ValueError(f"{path}: expected {expected} pixels, found {len(values)}")
    if any(value < 0 or value > 255 for value in values):
        raise ValueError(f"{path}: pixel values must be 00 through FF")
    return [values[y * width:(y + 1) * width] for y in range(height)]


def write_hex_pixels(path, image):
    flat = [value for row in image for value in row]
    Path(path).write_text("\n".join(f"{value:02X}" for value in flat) + "\n")


def read_hex_vector(path):
    return [int(token, 16) for token in Path(path).read_text().split()]
