"""Pure-Python 3x3 median reference matching SAR-Accel's interior-only RTL."""


def _validate_image(image):
    if len(image) < 3 or not image or len(image[0]) < 3:
        raise ValueError("image must be at least 3x3")
    width = len(image[0])
    if any(len(row) != width for row in image):
        raise ValueError("image rows must all have the same width")
    for row in image:
        if any(not isinstance(p, int) or p < 0 or p > 255 for p in row):
            raise ValueError("pixels must be integers from 0 through 255")


def median_filter_3x3(image):
    """Return a (height-2) x (width-2) median-filtered image.

    The returned coordinate (y, x) corresponds to input coordinate (y+1, x+1).
    Edges are omitted, matching sar_line_buffer's complete-window policy.
    """
    _validate_image(image)
    height = len(image)
    width = len(image[0])
    output = []
    for y in range(1, height - 1):
        out_row = []
        for x in range(1, width - 1):
            window = [image[yy][xx]
                      for yy in range(y - 1, y + 2)
                      for xx in range(x - 1, x + 2)]
            out_row.append(sorted(window)[4])
        output.append(out_row)
    return output
