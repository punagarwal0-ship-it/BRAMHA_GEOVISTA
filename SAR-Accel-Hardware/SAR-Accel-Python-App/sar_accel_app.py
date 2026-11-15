"""Desktop companion app for SAR-Accel image simulation and result review."""

import math
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from PIL import Image
from change_detection import change_detection
from generate_test_images import generate_pair
from image_io import read_hex_vector, write_hex_pixels
from median_filter import median_filter_3x3


def to_nested_list(data):
    if hasattr(data, "tolist"):
        data = data.tolist()
    rows = [list(row) for row in data]
    if len(rows) < 3 or not rows or len(rows[0]) < 3:
        raise ValueError("Each image must be at least 3x3")
    width = len(rows[0])
    if any(len(row) != width for row in rows):
        raise ValueError("Image rows must have a consistent width")
    return rows


def convert_pair_to_u8(image1, image2):
    """Preserve byte grayscale; otherwise use shared min/max magnitude scaling."""
    a, b = to_nested_list(image1), to_nested_list(image2)
    if len(a) != len(b) or len(a[0]) != len(b[0]):
        raise ValueError("The two images must have identical dimensions")
    raw = []
    for rows in (a, b):
        for row in rows:
            for value in row:
                if isinstance(value, complex):
                    value = abs(value)
                try:
                    value = float(value)
                except (TypeError, ValueError) as exc:
                    raise ValueError("Image pixels must be numeric") from exc
                if not math.isfinite(value):
                    raise ValueError("Image pixels must be finite")
                raw.append(value)

    is_byte_gray = all(v.is_integer() and 0 <= v <= 255 for v in raw)
    if is_byte_gray:
        split = len(a) * len(a[0])
        width = len(a[0])
        flat_a = [int(v) for v in raw[:split]]
        flat_b = [int(v) for v in raw[split:]]
        return ([flat_a[i:i + width] for i in range(0, len(flat_a), width)],
                [flat_b[i:i + width] for i in range(0, len(flat_b), width)])

    low, high = min(raw), max(raw)
    if high == low:
        scaled = [0] * len(raw)
    else:
        scale = 255.0 / (high - low)
        scaled = [max(0, min(255, int(round((v - low) * scale)))) for v in raw]

    split = len(a) * len(a[0])
    flat_a, flat_b = scaled[:split], scaled[split:]
    width = len(a[0])
    a8 = [flat_a[i:i + width] for i in range(0, len(flat_a), width)]
    b8 = [flat_b[i:i + width] for i in range(0, len(flat_b), width)]
    return a8, b8


def write_png(image, path, binary=False):
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("PNG export needs Pillow. Install with: python -m pip install Pillow") from exc
    pixels = [255 if v else 0 for row in image for v in row] if binary else [v for row in image for v in row]
    out = Image.new("L", (len(image[0]), len(image)))
    out.putdata(pixels)
    out.save(path)


class SarAccelApp:
    def __init__(self, root):
        self.root = root
        root.title("SAR-Accel | Image Simulation Companion")
        root.geometry("1040x760")
        root.minsize(820, 620)

        self.image1 = self.image2 = self.truth = None
        self.enhanced = self.change_map = None
        self.preview_labels = []

        header = ttk.Frame(root, padding=(12, 10))
        header.pack(fill="x")
        ttk.Label(header, text="SAR-Accel", font=("Segoe UI", 18, "bold")).pack(anchor="w")
        ttk.Label(header, text="Prepare image streams, run the Python reference, and review Vivado outputs.").pack(anchor="w")

        controls = ttk.LabelFrame(root, text="1. Load or generate an image pair", padding=10)
        controls.pack(fill="x", padx=12, pady=(0, 8))
        # These defaults match sar_accel_file_tb.v.
        self.width_var = tk.IntVar(value=16)
        self.height_var = tk.IntVar(value=16)
        self.threshold_var = tk.IntVar(value=20)
        self.seed_var = tk.IntVar(value=7)
        for col, (label, var, width) in enumerate((
            ("Width", self.width_var, 7), ("Height", self.height_var, 7),
            ("Threshold", self.threshold_var, 7), ("Seed", self.seed_var, 7))):
            ttk.Label(controls, text=label).grid(row=0, column=col * 2, sticky="w", padx=(0, 4))
            ttk.Spinbox(controls, from_=0, to=4096, textvariable=var, width=width).grid(row=0, column=col * 2 + 1, sticky="w", padx=(0, 14))
        ttk.Button(controls, text="Generate synthetic pair", command=self.generate).grid(row=0, column=8, padx=4)
        ttk.Button(controls, text="Load image pair…", command=self.load_image_pair).grid(row=0, column=9, padx=4)

        actions = ttk.LabelFrame(root, text="2. Process and connect to Vivado", padding=10)
        actions.pack(fill="x", padx=12, pady=(0, 8))
        ttk.Button(actions, text="Run Python reference", command=self.process).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Export .mem inputs for Vivado…", command=self.export_mem).pack(side="left", padx=8)
        ttk.Button(actions, text="Load RTL output files…", command=self.load_rtl).pack(side="left", padx=8)
        ttk.Button(actions, text="Save preview PNGs…", command=self.save_pngs).pack(side="left", padx=8)

        previews = ttk.Frame(root, padding=(12, 2))
        previews.pack(fill="both", expand=True)
        names = ("Image 1 input", "Image 2 input", "Enhanced output", "Change map")
        for i, name in enumerate(names):
            box = ttk.LabelFrame(previews, text=name, padding=8)
            box.grid(row=i // 2, column=i % 2, sticky="nsew", padx=5, pady=5)
            label = ttk.Label(box, text="No image loaded", anchor="center")
            label.pack(fill="both", expand=True)
            self.preview_labels.append(label)
            previews.columnconfigure(i % 2, weight=1)
            previews.rowconfigure(i // 2, weight=1)

        self.status_var = tk.StringVar(value="Load two image files or generate a synthetic pair to begin.")
        ttk.Label(root, textvariable=self.status_var, relief="sunken", padding=7, anchor="w").pack(fill="x", side="bottom")

    def show_images(self):
        data = (self.image1, self.image2, self.enhanced, self.change_map)
        self._photos = []
        for label, image in zip(self.preview_labels, data):
            if image is None:
                label.configure(image="", text="No image loaded")
                continue
            photo = self.make_photo(image, binary=(image is self.change_map))
            self._photos.append(photo)
            label.configure(image=photo, text="")

    @staticmethod
    def make_photo(image, binary=False):
        height, width = len(image), len(image[0])
        limit = 360
        scale = min(1.0, limit / max(width, height))
        dw, dh = max(1, int(width * scale)), max(1, int(height * scale))
        photo = tk.PhotoImage(width=dw, height=dh)
        for y in range(dh):
            sy = min(height - 1, int(y * height / dh))
            colors = []
            for x in range(dw):
                sx = min(width - 1, int(x * width / dw))
                value = 255 if binary and image[sy][sx] else (0 if binary else image[sy][sx])
                colors.append(f"#{value:02x}{value:02x}{value:02x}")
            photo.put("{" + " ".join(colors) + "}", to=(0, y))
        return photo

    def generate(self):
        try:
            w, h = self.width_var.get(), self.height_var.get()
            a, b, truth = generate_pair(w, h, self.seed_var.get())
            self.set_pair(a, b, truth, "Synthetic test data generated (not real satellite data).")
        except Exception as exc:
            messagebox.showerror("Could not generate images", str(exc))

    @staticmethod
    def read_image_file(path):
        """Read a single image as a 2D numeric array without clipping 16-bit data."""
        with Image.open(path) as source:
            # Keep high-bit-depth grayscale samples for shared pair scaling.
            if source.mode in ("I;16", "I;16B", "I;16L", "I", "F"):
                image = source.copy()
            else:
                # Convert RGB, palette, and other common image modes to grayscale.
                image = source.convert("L")
            width, height = image.size
            if width < 3 or height < 3:
                raise ValueError(f"{Path(path).name} must be at least 3x3 pixels")
            samples = list(image.getdata())
            return [samples[y * width:(y + 1) * width] for y in range(height)]

    def load_image_pair(self):
        filetypes = [("Image files", "*.png *.jpg *.jpeg *.tif *.tiff *.bmp"), ("All files", "*.*")]
        first_path = filedialog.askopenfilename(title="Choose first input image", filetypes=filetypes)
        if not first_path:
            return
        second_path = filedialog.askopenfilename(title="Choose second input image", filetypes=filetypes)
        if not second_path:
            return
        try:
            image1 = self.read_image_file(first_path)
            image2 = self.read_image_file(second_path)
            a, b = convert_pair_to_u8(image1, image2)
            self.set_pair(a, b, None,
                          f"Loaded {Path(first_path).name} and {Path(second_path).name}.")
        except Exception as exc:
            messagebox.showerror("Could not load image pair", str(exc))

    def set_pair(self, a, b, truth, message):
        self.image1, self.image2, self.truth = a, b, truth
        self.enhanced = self.change_map = None
        self.width_var.set(len(a[0]))
        self.height_var.set(len(a))
        self.show_images()
        self.status_var.set(f"{message} Pair size: {len(a[0])}x{len(a)} pixels.")

    def process(self):
        if self.image1 is None:
            messagebox.showinfo("Load images first", "Generate a synthetic pair or load two image files first.")
            return
        try:
            threshold = self.threshold_var.get()
            filtered1 = median_filter_3x3(self.image1)
            self.enhanced = median_filter_3x3(self.image2)
            _, self.change_map = change_detection(filtered1, self.enhanced, threshold)
            self.show_images()
            self.status_var.set(f"Python reference complete. Output size: {len(self.enhanced[0])}x{len(self.enhanced)}; threshold={threshold}.")
        except Exception as exc:
            messagebox.showerror("Reference processing failed", str(exc))

    def export_mem(self):
        if self.image1 is None:
            messagebox.showinfo("Load images first", "Generate or load a pair before exporting.")
            return
        folder = filedialog.askdirectory(title="Choose folder for Vivado input files")
        if not folder:
            return
        write_hex_pixels(Path(folder) / "image1.mem", self.image1)
        write_hex_pixels(Path(folder) / "image2.mem", self.image2)
        (Path(folder) / "threshold.mem").write_text(f"{self.threshold_var.get():02X}\n")
        if self.truth is not None:
            write_hex_pixels(Path(folder) / "truth_change.mem", self.truth)
        width, height = len(self.image1[0]), len(self.image1)
        (Path(folder) / "vivado_config.txt").write_text(
            f"IMAGE_WIDTH={width}\nIMAGE_HEIGHT={height}\n"
            f"THRESHOLD={self.threshold_var.get()}\n"
            "Set IMAGE_WIDTH and IMAGE_HEIGHT in sar_accel_file_tb.v to match.\n"
            "Copy image1.mem, image2.mem, and threshold.mem into the XSim run directory.\n"
        )
        self.status_var.set(f"Exported image1.mem, image2.mem, threshold.mem, and vivado_config.txt to {folder}.")

    def load_rtl(self):
        if self.enhanced is None or self.change_map is None:
            messagebox.showinfo("Run reference first", "Run the Python reference before loading RTL outputs.")
            return
        enhanced_path = filedialog.askopenfilename(title="Select rtl_enhanced.mem")
        if not enhanced_path:
            return
        change_path = filedialog.askopenfilename(title="Select rtl_change.mem")
        if not change_path:
            return
        try:
            expected_enh = len(self.enhanced) * len(self.enhanced[0])
            expected_chg = len(self.change_map) * len(self.change_map[0])
            rtl_enh = read_hex_vector(enhanced_path)
            rtl_chg = read_hex_vector(change_path)
            if len(rtl_enh) != expected_enh or len(rtl_chg) != expected_chg:
                raise ValueError("RTL output pixel count does not match the reference interior dimensions")
            ref_enh = [v for row in self.enhanced for v in row]
            ref_chg = [v for row in self.change_map for v in row]
            mse = sum((a - b) ** 2 for a, b in zip(rtl_enh, ref_enh)) / expected_enh
            mismatches = sum(a != b for a, b in zip(rtl_enh, ref_enh))
            change_match = sum(a == b for a, b in zip(rtl_chg, ref_chg))
            self.enhanced = [rtl_enh[i:i + len(self.enhanced[0])]
                             for i in range(0, len(rtl_enh), len(self.enhanced[0]))]
            self.change_map = [rtl_chg[i:i + len(self.change_map[0])]
                               for i in range(0, len(rtl_chg), len(self.change_map[0]))]
            self.show_images()
            self.status_var.set(f"RTL compare: enhanced mismatches {mismatches}/{expected_enh}, MSE={mse:.4f}; change exact matches {change_match}/{expected_chg}.")
        except Exception as exc:
            messagebox.showerror("RTL comparison failed", str(exc))

    def save_pngs(self):
        if self.enhanced is None or self.change_map is None:
            messagebox.showinfo("No outputs yet", "Run the Python reference first.")
            return
        folder = filedialog.askdirectory(title="Choose folder for PNG outputs")
        if not folder:
            return
        try:
            write_png(self.enhanced, Path(folder) / "enhanced.png")
            write_png(self.change_map, Path(folder) / "change_map.png", binary=True)
            self.status_var.set(f"Saved enhanced.png and change_map.png to {folder}.")
        except Exception as exc:
            messagebox.showerror("PNG export failed", str(exc))


def main():
    root = tk.Tk()
    SarAccelApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
