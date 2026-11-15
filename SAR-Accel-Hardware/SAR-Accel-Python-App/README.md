# SAR-Accel Python image companion

This desktop app loads two same-size image files, runs a Python model
of the current RTL behavior, writes image files for the Vivado file-driven
testbench, and can compare captured RTL outputs with the Python result.

## Start the app on Windows

Open PowerShell in this folder and run:

```powershell
python -m pip install -r requirements.txt
python sar_accel_app.py
```

Tkinter is included with most standard Windows Python installations. Pillow is
only needed when saving PNG previews; the rest of the app can run without it.

## Try it before the real dataset arrives

1. Click **Generate synthetic pair**. The generated pixels are test data, not
   satellite observations.
2. Set the threshold if desired, then click **Run Python reference**.
3. Click **Save preview PNGs** to save the median-filtered image and binary
   change map.
4. Click **Export .mem inputs for Vivado**. This writes `image1.mem`,
   `image2.mem`, `threshold.mem`, optional `truth_change.mem`, and
   `vivado_config.txt`.

The project testbench `testbench/sar_accel_file_tb.v` defaults to 16 by 16
pixels, matching the app's default. If the images are another size, change its
`IMAGE_WIDTH` and `IMAGE_HEIGHT` parameters to the dimensions shown in
`vivado_config.txt`, then run behavioral simulation. Put the three required
`.mem` files in the XSim run directory used by that simulation. The testbench
writes `rtl_enhanced.mem` and `rtl_change.mem` there.

Back in the app, click **Load RTL output files** and select those two RTL
output files. The status bar reports pixel mismatches and MSE for the enhanced
image, plus exact matches for the change map.

The current RTL omits the outer one-pixel border: an input of W by H produces
an output of (W-2) by (H-2). `enhanced.png` is the median-filtered second image;
the change map compares the median-filtered first and second images.

## Loading dataset images

Use **Load image pair** to select the first and second image files separately.
Supported formats are PNG, JPEG, TIFF, and BMP. Both images must have the same
dimensions and be at least 3 by 3 pixels. Color images are converted to
grayscale. 8-bit grayscale images keep their original pixel values. Higher-bit
depth grayscale images are scaled together using the minimum and maximum across
both images so their relative brightness is preserved. This is a generic
conversion; if the dataset has prescribed SAR calibration or normalization,
that should be applied before exporting the 8-bit pixels for this RTL.
