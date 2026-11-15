import hashlib
import importlib.util
import base64
import contextlib
import io
import json
import pathlib
import shutil
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
from unittest import mock

spec = importlib.util.spec_from_file_location("video_assets", pathlib.Path(__file__).parents[1] / "scripts" / "prepare-video-assets.py")
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class VideoPolicyTest(unittest.TestCase):
    def test_dimensions_preserve_display_aspect_rotation_and_never_upscale(self):
        self.assertEqual(assets.dimensions({"width": 1920, "height": 1080}, 640), (640, 360))
        self.assertEqual(assets.dimensions({"width": 320, "height": 180}, 640), (320, 180))
        rotated = {"width": 1920, "height": 1080, "side_data_list": [{"rotation": -90}]}
        self.assertEqual(assets.dimensions(rotated, 640), (360, 640))
        anamorphic = {"width": 720, "height": 576, "sample_aspect_ratio": "16:15"}
        self.assertEqual(assets.dimensions(anamorphic, 640), (640, 480))

    def test_hdr_alpha_subtitles_and_multiple_tracks_keep_original_playback(self):
        video = {"codec_type": "video", "pix_fmt": "yuv420p"}
        audio = {"codec_type": "audio", "channels": 2}
        self.assertTrue(assets.ordinary_sdr([video, audio]))
        for streams in [
            [{**video, "color_transfer": "smpte2084"}],
            [{**video, "pix_fmt": "yuva420p"}],
            [{**video, "pix_fmt": "yuv420p10le"}],
            [video, audio, audio],
            [video, {"codec_type": "subtitle"}],
            [video, {**audio, "channels": 6}],
        ]:
            self.assertFalse(assets.ordinary_sdr(streams))

    def test_only_same_https_origin_is_used_for_media_and_api(self):
        origin = "https://family.example"
        self.assertEqual(assets.same_origin(origin, "/media/123"), origin + "/media/123")
        for path in ["http://family.example/a", "https://other.example/a", "//other.example/a"]:
            with self.assertRaises(ValueError):
                assets.same_origin(origin, path)

    def test_upload_streams_exact_length_and_skip_posts_zero_bytes(self):
        seen = []

        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b'{"saved":true}'

        def opened(request, **kwargs):
            seen.append((request.get_header("Content-length"), request.get_header("Content-type"), request.data))
            if hasattr(request.data, "read"):
                self.assertEqual(request.data.read(), b"movie")
            return Response()

        with tempfile.TemporaryDirectory() as directory:
            source = pathlib.Path(directory) / "small.mp4"
            source.write_bytes(b"movie")
            with mock.patch.object(assets.OPENER, "open", side_effect=opened):
                assets.call("https://family.example", "/api/store", source, "video/mp4")
                assets.call("https://family.example", "/api/store?skip=not-needed", b"", "video/mp4")
        self.assertEqual([entry[:2] for entry in seen], [("5", "video/mp4"), ("0", "video/mp4")])
        self.assertTrue(seen[0][2].closed)

    def test_download_rejects_oversized_or_incomplete_sources(self):
        class Response:
            headers = {"Content-Length": "90"}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b"x" * 60

        with tempfile.TemporaryDirectory() as directory, mock.patch.object(assets.OPENER, "open", return_value=Response()), mock.patch.object(assets, "MAX_SOURCE_BYTES", 100):
            with self.assertRaisesRegex(ValueError, "exceeds"):
                assets.download("https://family.example", "/media/a", pathlib.Path(directory) / "a", time.monotonic() + 5)

    def test_large_copies_upload_bounded_chunks_and_complete_once(self):
        calls = []
        source = bytes(range(120))
        def remote(origin, path, body=None, mime=None):
            calls.append((path, body, mime))
            if path.endswith("/start"):
                data = json.loads(body)
                self.assertEqual(data["revision"], "rev-1")
                self.assertEqual(data["size"], len(source))
                self.assertEqual(base64.b64decode(data["head"]), source[:128])
                return {"ticket": "opaque+/ticket", "partSize": 8, "parts": 15}
            return {"saved": True}
        with tempfile.TemporaryDirectory() as directory:
            target = pathlib.Path(directory) / "large.mp4"
            target.write_bytes(source)
            with mock.patch.object(assets, "MULTIPART_THRESHOLD", 64), mock.patch.object(assets, "PART_BYTES", 8), mock.patch.object(assets, "call", side_effect=remote):
                result = assets.upload("https://family.example", "/api/media/a/video-assets/low?revision=rev-1", target, "video/mp4", {"revision": "rev-1"})
        self.assertTrue(result["saved"])
        parts = [(path, body) for path, body, _ in calls if "/part?" in path]
        self.assertEqual(b"".join(body for _, body in parts), source)
        self.assertTrue(all(len(body) == 8 for _, body in parts))
        self.assertEqual([urllib.parse.parse_qs(urllib.parse.urlparse(path).query)["partNumber"][0] for path, _ in parts], [str(n) for n in range(1, 16)])
        self.assertEqual(calls[-1][0], "/api/media/a/video-assets/low/multipart/complete")
        self.assertFalse(any(path.endswith("/abort") for path, _, _ in calls))

    def test_partial_large_upload_is_aborted_without_completion(self):
        calls = []
        def remote(origin, path, body=None, mime=None):
            calls.append(path)
            if path.endswith("/start"):
                return {"ticket": "ticket", "partSize": 8, "parts": 15}
            if "partNumber=2" in path:
                raise urllib.error.URLError("Disconnected")
            return {"saved": True}
        with tempfile.TemporaryDirectory() as directory:
            target = pathlib.Path(directory) / "large.mp4"
            target.write_bytes(bytes(range(120)))
            with mock.patch.object(assets, "MULTIPART_THRESHOLD", 64), mock.patch.object(assets, "PART_BYTES", 8), mock.patch.object(assets, "call", side_effect=remote):
                with self.assertRaises(urllib.error.URLError):
                    assets.upload("https://family.example", "/api/media/a/video-assets/faststart", target, "video/mp4", {"revision": "original"})
        self.assertTrue(calls[-1].endswith("/abort"))
        self.assertFalse(any(path.endswith("/complete") for path in calls))

    def test_already_prepared_revision_does_not_start_duplicate_parts(self):
        with tempfile.TemporaryDirectory() as directory:
            target = pathlib.Path(directory) / "large.mp4"
            target.write_bytes(bytes(range(120)))
            with mock.patch.object(assets, "MULTIPART_THRESHOLD", 64), mock.patch.object(assets, "call", return_value={"saved": False, "item": {"id": "a"}}) as remote:
                result = assets.upload("https://family.example", "/api/media/a/video-assets/faststart", target, "video/mp4", {"revision": "original"})
            self.assertFalse(result["saved"])
            self.assertEqual(remote.call_count, 1)

    def test_corrupt_complete_source_is_skipped_but_transient_probe_failure_is_not(self):
        item = {"id": "id", "src": "/media/id", "revision": "rev", "poster": True, "low": True, "size": 100}
        corrupt = subprocess.CalledProcessError(1, ["ffprobe"], stderr=b"moov atom not found\nInvalid data found when processing input")
        with mock.patch.object(assets, "download", return_value=100), mock.patch.object(assets, "probe", side_effect=corrupt), mock.patch.object(assets, "call", return_value={"saved": True}) as remote:
            self.assertEqual(assets.process("https://family.example", item, time.monotonic() + 10), 0)
            self.assertEqual(remote.call_count, 2)
            self.assertTrue(all("skip=unsupported" in call.args[1] for call in remote.call_args_list))
        with mock.patch.object(assets, "download", return_value=100), mock.patch.object(assets, "probe", side_effect=TimeoutError("busy")), mock.patch.object(assets, "call") as remote:
            with self.assertRaises(TimeoutError):
                assets.process("https://family.example", item, time.monotonic() + 10)
            remote.assert_not_called()

    def test_one_failed_source_does_not_stop_later_items_in_the_batch(self):
        batch = {"version": 1, "items": [{"id": "broken"}, {"id": "healthy"}], "next": None}
        output = io.StringIO()
        with mock.patch("sys.argv", ["prepare-video-assets.py", "--origin", "https://family.example"]), mock.patch.object(assets, "call", return_value=batch), mock.patch.object(assets, "process", side_effect=[ValueError("bad source"), 1]) as worker, contextlib.redirect_stdout(output):
            with self.assertRaises(SystemExit):
                assets.main()
        self.assertEqual(worker.call_count, 2)
        self.assertNotIn("broken", output.getvalue())
        self.assertIn('"assets_saved": 1', output.getvalue())


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg and ffprobe required")
class VideoEncodingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix="keha-video-test-")
        cls.folder = pathlib.Path(cls.directory.name)
        cls.source = cls.folder / "original.mp4"
        subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=25:duration=2",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-crf", "0", "-threads", "2",
            "-c:a", "aac", "-y", str(cls.source)
        ], check=True, capture_output=True, timeout=30)
        cls.original = hashlib.sha256(cls.source.read_bytes()).hexdigest()
        cls.details = assets.probe(cls.source, time.monotonic() + 30)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def assert_original_intact(self):
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(), self.original)

    def test_faststart_moves_metadata_without_changing_any_audio_or_video_packet(self):
        self.assertFalse(assets.faststart(self.source))
        output = self.folder / "faststart.mp4"
        self.assertIsNone(assets.encode(self.source, "faststart", self.details, output, time.monotonic() + 30))
        self.assertTrue(assets.faststart(output))
        def packets(path):
            return json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_packets", "-show_data_hash", "sha256", "-show_entries", "packet=stream_index,data_hash", "-of", "json", str(path)], check=True, capture_output=True, timeout=10).stdout)["packets"]
        self.assertEqual(packets(self.source), packets(output))
        self.assertEqual(assets.encode(output, "faststart", assets.probe(output, time.monotonic() + 10), self.folder / "unused.mp4", time.monotonic() + 10), "already-faststart")
        self.assert_original_intact()

    def test_poster_is_bounded_and_does_not_modify_original(self):
        output = self.folder / "poster.jpg"
        self.assertIsNone(assets.encode(self.source, "poster", self.details, output, time.monotonic() + 30))
        details = assets.probe(output, time.monotonic() + 10)
        self.assertEqual(assets.display_size(details["streams"][0]), (640, 360))
        self.assertLess(output.stat().st_size, 2 * 1024 * 1024)
        self.assert_original_intact()

    def test_renditions_are_smaller_faststart_and_keep_duration_audio_and_aspect(self):
        for kind, expected in [("low", (640, 360)), ("medium", (960, 540))]:
            output = self.folder / (kind + ".mp4")
            self.assertIsNone(assets.encode(self.source, kind, self.details, output, time.monotonic() + 45))
            details = assets.probe(output, time.monotonic() + 10)
            streams = details["streams"]
            self.assertEqual(assets.display_size(streams[0]), expected)
            self.assertEqual(streams[0]["codec_name"], "h264")
            self.assertEqual(streams[1]["codec_name"], "aac")
            self.assertEqual(streams[1]["channels"], self.details["streams"][1]["channels"])
            self.assertAlmostEqual(float(details["format"]["duration"]), float(self.details["format"]["duration"]), delta=.1)
            self.assertLess(output.stat().st_size, self.source.stat().st_size * .85)
            self.assertTrue(assets.faststart(output))
        self.assert_original_intact()


if __name__ == "__main__":
    unittest.main()
