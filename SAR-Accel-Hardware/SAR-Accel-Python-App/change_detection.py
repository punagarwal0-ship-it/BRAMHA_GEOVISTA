"""Pixel-wise absolute-difference change detection reference."""


def change_detection(image1, image2, threshold):
    """Return (difference_image, binary_map); change is strictly diff > threshold."""
    if not 0 <= threshold <= 255:
        raise ValueError("threshold must be from 0 through 255")
    if len(image1) != len(image2) or any(len(a) != len(b) for a, b in zip(image1, image2)):
        raise ValueError("images must have identical dimensions")
    differences = []
    change_map = []
    for row1, row2 in zip(image1, image2):
        diff_row = []
        change_row = []
        for a, b in zip(row1, row2):
            diff = abs(int(b) - int(a))
            diff_row.append(diff)
            change_row.append(1 if diff > threshold else 0)
        differences.append(diff_row)
        change_map.append(change_row)
    return differences, change_map
