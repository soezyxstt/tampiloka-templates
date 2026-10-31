"""Export real 1280 x 800 browser captures. Requires Pillow in the CI runner."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
output = root / "public/demo-previews"
output.mkdir(parents=True, exist_ok=True)
for preset, layout in [("medical", "appointment-first"), ("aesthetic", "editorial"), ("detailing", "service-market"), ("consulting", "minimal-professional")]:
    source = root / "test-results/browser" / f"{layout}-preview.png"
    image = Image.open(source)
    if image.size != (1280, 800):
        raise ValueError(f"Incorrect preview dimensions: {source} {image.size}")
    image.convert("RGB").save(output / f"booking-{preset}.webp", "WEBP", quality=85, method=6)
