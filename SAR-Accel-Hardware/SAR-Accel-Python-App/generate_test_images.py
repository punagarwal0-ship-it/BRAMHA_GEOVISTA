"""Generate deterministic synthetic SAR-like image pairs and a truth mask."""

import argparse
import random
from pathlib import Path

from image_io import write_hex_pixels


def generate_pair(width, height, seed=7):
    if width < 3 or height < 3:
        raise ValueError("width and height must both be at least 3")
    rng = random.Random(seed)
    image1 = []
    image2 = []
    truth = []
    for y in range(height):
        row1, row2, mask_row = [], [], []
        for x in range(width):
            # Synthetic terrain intensity pattern; this is not real SAR data.
            base = 35 + ((x * 7 + y * 11) % 90)
            speckle1 = max(0.0, rng.gauss(1.0, 0.22))
            speckle2 = max(0.0, rng.gauss(1.0, 0.22))
            a = max(0, min(255, int(round(base * speckle1))))
            b = max(0, min(255, int(round(base * speckle2))))

            # A known changed patch in Image 2.
            changed = (width // 3 <= x < max(width // 3 + 1, 2 * width // 3) and
                       height // 3 <= y < max(height // 3 + 1, 2 * height // 3))
            if changed:
                b = min(255, b + 70)
            row1.append(a)
            row2.append(b)
            mask_row.append(1 if changed else 0)
        image1.append(row1)
        image2.append(row2)
        truth.append(mask_row)
    return image1, image2, truth


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, default=16)
    parser.add_argument("--height", type=int, default=16)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=Path, default=Path("simulation/input_images"))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    image1, image2, truth = generate_pair(args.width, args.height, args.seed)
    write_hex_pixels(args.out / "image1.mem", image1)
    write_hex_pixels(args.out / "image2.mem", image2)
    write_hex_pixels(args.out / "truth_change.mem", truth)
    print(f"Wrote {args.width}x{args.height} synthetic images and truth mask to {args.out}")
    print("These generated files are synthetic test data, not real satellite observations.")


if __name__ == "__main__":
    main()
