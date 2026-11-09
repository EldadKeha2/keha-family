"""Prepare shared gallery assets away from visitors' browsers. Originals stay intact."""
import argparse
import concurrent.futures
import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 120_000_000
MAX_SOURCE_BYTES = 50 * 1024 * 1024


def variants(data):
    """Normalize orientation once and encode two bounded display sizes."""
    with Image.open(io.BytesIO(data)) as image:
        if getattr(image, "is_animated", False):
            return {}
        image.draft("RGB", (2048, 2048))
        ImageOps.exif_transpose(image, in_place=True)
        image.thumbnail((2048, 2048), Image.Resampling.LANCZOS, reducing_gap=3.0)
        image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
        result = {}
        for name, edge, quality in [("preview", 2048, 85), ("thumbnail", 640, 82)]:
            small = image.copy()
            small.thumbnail((edge, edge), Image.Resampling.LANCZOS, reducing_gap=3.0)
            for encoder_quality in [quality, 76, 68]:
                output = io.BytesIO()
                small.save(output, "WEBP", quality=encoder_quality, method=4)
                if len(output.getvalue()) < min(len(data) * .9, 120000 if name == "thumbnail" else 800000):
                    break
            result[name] = output.getvalue()
            small.close()
        return result


def call(origin, path, body=None):
    url = urllib.parse.urljoin(origin + "/", path)
    if urllib.parse.urlparse(url).netloc != urllib.parse.urlparse(origin).netloc:
        raise ValueError("Unexpected photo origin")
    headers = {"User-Agent": "Keha-Photo-Preparation/1"}
    if body is not None:
        headers.update({"Origin": origin, "X-Family-Token": "family-public-v1", "Content-Type": "image/webp"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=90) as response:
                data = response.read(MAX_SOURCE_BYTES + 1)
                if len(data) > MAX_SOURCE_BYTES:
                    raise ValueError("Photo exceeds source limit")
                return data
        except urllib.error.HTTPError as error:
            if error.code not in [429, 502, 503, 504] or attempt == 2:
                raise
            time.sleep(1 + attempt)


def process(origin, item):
    data = call(origin, item["src"])
    encoded = variants(data)
    saved = 0
    for name in ["thumbnail", "preview"]:
        if not item.get(name) or name not in encoded or len(encoded[name]) >= len(data):
            continue
        path = "/api/media/" + item["id"] + "/" + name + "?revision=" + urllib.parse.quote(item["revision"])
        try:
            response = json.loads(call(origin, path, encoded[name]))
            saved += int(response.get("saved", False))
        except urllib.error.HTTPError as error:
            if error.code not in [404, 409]:
                raise
    return saved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", required=True)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--max-seconds", type=int, default=1200)
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    if urllib.parse.urlparse(origin).scheme != "https":
        raise ValueError("HTTPS origin required")
    started = time.monotonic()
    # A push starts this job alongside the site's own deployment. Active
    # Durable Objects may retain the previous code for five minutes after it.
    backend_deadline = started + 900
    while True:
        try:
            batch = json.loads(call(origin, "/api/photo-assets?limit=20"))
            if batch.get("version", 0) < 2:
                if time.monotonic() > backend_deadline:
                    raise RuntimeError("Waiting for the matching photo backend")
                time.sleep(5)
                continue
            break
        except urllib.error.HTTPError as error:
            if error.code not in [404, 503] or time.monotonic() > backend_deadline:
                raise
            time.sleep(5)
    items = []
    while batch["items"]:
        items.extend(batch["items"])
        if not batch.get("next"):
            break
        batch = json.loads(call(origin, "/api/photo-assets?limit=25&after=" + str(batch["next"])))
    items.sort(key=lambda item: item["size"], reverse=True)
    processed = saved = failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, max(1, args.workers))) as pool:
        for offset in range(0, len(items), 20):
            if time.monotonic() - started >= args.max_seconds:
                break
            jobs = [pool.submit(process, origin, item) for item in items[offset:offset+20]]
            for job in concurrent.futures.as_completed(jobs):
                processed += 1
                try:
                    saved += job.result()
                except Exception as error:
                    failed += 1
                    # Log categories only, never family names, photo URLs or bytes.
                    print(json.dumps({"photo_error": type(error).__name__, "status": getattr(error, "code", None)}), flush=True)
            print(json.dumps({"processed": processed, "assets_saved": saved, "failed": failed}), flush=True)
    remaining = json.loads(call(origin, "/api/photo-assets?limit=1"))["pending"]
    print(json.dumps({"processed": processed, "assets_saved": saved, "failed": failed, "remaining": remaining}), flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
