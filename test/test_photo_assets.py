import importlib.util
import io
import pathlib
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location("photo_assets", pathlib.Path(__file__).parents[1] / "scripts" / "prepare-photo-assets.py")
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class PhotoAssetsTest(unittest.TestCase):
    def test_sizes_and_original_bytes(self):
        image = Image.new("RGB", (6567, 4137), (76, 91, 103))
        source = io.BytesIO()
        image.save(source, "PNG")
        original = source.getvalue()
        result = assets.variants(original)
        self.assertEqual(source.getvalue(), original)
        for key, edge in [("thumbnail", 640), ("preview", 2048)]:
            with Image.open(io.BytesIO(result[key])) as resized:
                self.assertEqual(resized.format, "WEBP")
                self.assertEqual(max(resized.size), edge)
                self.assertAlmostEqual(resized.width / resized.height, 6567 / 4137, delta=.006)
                self.assertLess(abs(resized.getpixel((0, 0))[0] - 76), 5)

    def test_orientation_and_transparency(self):
        image = Image.new("RGB", (800, 400), (20, 40, 60))
        exif = Image.Exif()
        exif[274] = 6
        source = io.BytesIO()
        image.save(source, "JPEG", exif=exif)
        with Image.open(io.BytesIO(assets.variants(source.getvalue())["preview"])) as result:
            self.assertEqual(result.size, (400, 800))
        source = io.BytesIO()
        Image.new("RGBA", (900, 600), (100, 120, 140, 0)).save(source, "PNG")
        with Image.open(io.BytesIO(assets.variants(source.getvalue())["thumbnail"])) as result:
            self.assertEqual(result.getpixel((0, 0))[3], 0)


if __name__ == "__main__":
    unittest.main()
