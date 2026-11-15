"""Prepare revision-scoped viewing copies on a worker, never in visitors' browsers.

The download/edit source is never replaced. No media, names or URLs are logged.
Only ordinary SDR videos get smaller viewing renditions; unusual streams retain
their original playback. All outputs are private temporary files until saved.
"""
import argparse
import base64
import json
import math
import pathlib
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

MAX_SOURCE_BYTES = 500 * 1024 * 1024
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MULTIPART_THRESHOLD = 64 * 1024 * 1024
PART_BYTES = 8 * 1024 * 1024
VARIANTS = ("poster", "faststart", "low", "medium")


def same_origin(origin, path):
    url = urllib.parse.urljoin(origin + "/", path)
    source, target = urllib.parse.urlparse(origin), urllib.parse.urlparse(url)
    if target.scheme != "https" or (source.scheme, source.netloc) != (target.scheme, target.netloc):
        raise ValueError("Unexpected media origin")
    return url


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        same_origin(request.full_url, newurl)
        return super().redirect_request(request, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(SameOriginRedirect())


def call(origin, path, body=None, mime="application/octet-stream"):
    """Stream uploads from disk with an exact Content-Length; responses are small."""
    url = same_origin(origin, path)
    for attempt in range(3):
        headers = {"User-Agent": "Keha-Video-Preparation/1"}
        stream = None
        try:
            data = body
            if isinstance(body, pathlib.Path):
                stream = body.open("rb")
                data = stream
                length = body.stat().st_size
            else:
                length = len(body) if body is not None else 0
            if body is not None:
                headers.update({"Origin": origin, "X-Family-Token": "family-public-v1", "Content-Type": mime, "Content-Length": str(length)})
            with OPENER.open(urllib.request.Request(url, data=data, headers=headers), timeout=120) as response:
                data = response.read(MAX_RESPONSE_BYTES + 1)
                if len(data) > MAX_RESPONSE_BYTES:
                    raise ValueError("Unexpected response size")
                return json.loads(data)
        except urllib.error.HTTPError as error:
            if error.code not in (429, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(1 + attempt)
        finally:
            if stream:
                stream.close()


def download(origin, src, target, deadline):
    url = same_origin(origin, src)
    with OPENER.open(urllib.request.Request(url, headers={"User-Agent": "Keha-Video-Preparation/1"}), timeout=90) as response:
        declared = int(response.headers.get("Content-Length", "0"))
        if declared > MAX_SOURCE_BYTES:
            raise ValueError("Source exceeds supported size")
        size = 0
        with target.open("wb") as output:
            while True:
                if time.monotonic() >= deadline:
                    raise TimeoutError("Preparation budget exhausted")
                block = response.read(1024 * 1024)
                if not block:
                    break
                size += len(block)
                if size > MAX_SOURCE_BYTES:
                    raise ValueError("Source exceeds supported size")
                output.write(block)
    if not size or declared and declared != size:
        raise ValueError("Incomplete video download")
    return size


def upload(origin, path, body, mime, metadata=None, deadline=None):
    """Keep each derived upload below the proxy request-size ceiling."""
    if not isinstance(body, pathlib.Path) or body.stat().st_size <= MULTIPART_THRESHOLD:
        return call(origin, path, body, mime)
    base = path.split("?", 1)[0] + "/multipart/"
    with body.open("rb") as stream:
        head = base64.b64encode(stream.read(128)).decode("ascii")
    request = {**(metadata or {}), "size": body.stat().st_size, "head": head}
    session = call(origin, base + "start", json.dumps(request).encode(), "application/json")
    if session.get("saved") is False and "item" in session:
        return session  # Another preparation completed this revision first.
    ticket = session.get("ticket")
    if not isinstance(ticket, str) or not ticket or len(ticket) > 32768:
        raise ValueError("Invalid multipart preparation response")
    confirmed = False
    try:
        part_size = session.get("partSize")
        if part_size != PART_BYTES or session.get("parts") != math.ceil(request["size"] / part_size):
            raise ValueError("Unexpected multipart chunk size")
        with body.open("rb") as stream:
            for index in range(1, session["parts"] + 1):
                if deadline is not None and time.monotonic() >= deadline:
                    raise TimeoutError("Preparation budget exhausted")
                chunk = stream.read(part_size)
                query = urllib.parse.urlencode({"ticket": ticket, "partNumber": index})
                call(origin, base + "part?" + query, chunk, "application/octet-stream")
        result = call(origin, base + "complete", json.dumps({"ticket": ticket}).encode(), "application/json")
        confirmed = True
        return result
    finally:
        if not confirmed:
            try:
                # The backend also protects an already committed asset when a
                # completion response was lost. This cannot remove the source.
                call(origin, base + "abort", json.dumps({"ticket": ticket}).encode(), "application/json")
            except Exception:
                pass  # Preserve the original upload error; expiry bounds cleanup.


def run(args, deadline, seconds=180):
    remaining = min(seconds, deadline - time.monotonic())
    if remaining <= 0:
        raise TimeoutError("Preparation budget exhausted")
    return subprocess.run(args, check=True, capture_output=True, timeout=remaining)


def probe(path, deadline):
    return json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], deadline, 20).stdout)


def number(value, fallback=0):
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else fallback
    except (TypeError, ValueError):
        return fallback


def display_size(stream):
    width, height = number(stream.get("width")), number(stream.get("height"))
    sar = str(stream.get("sample_aspect_ratio", "1:1")).split(":")
    if len(sar) == 2 and number(sar[0]) > 0 and number(sar[1]) > 0:
        width *= number(sar[0]) / number(sar[1])
    rotation = number(stream.get("tags", {}).get("rotate"))
    for entry in stream.get("side_data_list", []):
        if "rotation" in entry:
            rotation = number(entry["rotation"])
    if abs(round(rotation)) % 180 == 90:
        width, height = height, width
    return width, height


def dimensions(stream, edge):
    width, height = display_size(stream)
    if min(width, height) < 2:
        raise ValueError("Invalid dimensions")
    scale = min(1, edge / max(width, height))
    return max(2, int(width * scale) // 2 * 2), max(2, int(height * scale) // 2 * 2)


def ordinary_sdr(streams):
    videos = [s for s in streams if s.get("codec_type") == "video"]
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    if len(videos) != 1 or len(audio) > 1 or any(s.get("codec_type") not in ("video", "audio") for s in streams):
        return False
    stream = videos[0]
    if stream.get("color_transfer") in ("smpte2084", "arib-std-b67") or stream.get("color_space") in ("bt2020nc", "bt2020c"):
        return False
    if stream.get("pix_fmt") not in ("yuv420p", "yuvj420p", "yuv422p", "yuvj422p", "yuv444p", "yuvj444p", "nv12"):
        return False
    return not audio or number(audio[0].get("channels"), 99) <= 2


def faststart(path):
    """Inspect top-level MP4 atoms without reading the video payload into RAM."""
    total = path.stat().st_size
    with path.open("rb") as source:
        offset = 0
        while offset + 8 <= total:
            source.seek(offset)
            size, kind = struct.unpack(">I4s", source.read(8))
            header = 8
            if size == 1:
                raw = source.read(8)
                if len(raw) != 8:
                    return False
                size, header = struct.unpack(">Q", raw)[0], 16
            elif size == 0:
                size = total - offset
            if size < header or offset + size > total:
                return False
            if kind == b"moov":
                return True
            if kind == b"mdat":
                return False
            offset += size
    return False


def encode(source, kind, details, target, deadline):
    streams = details.get("streams", [])
    videos = [s for s in streams if s.get("codec_type") == "video"]
    duration = number(details.get("format", {}).get("duration"))
    if not videos or duration <= 0:
        return "unsupported"
    if kind == "faststart":
        if "mp4" not in details.get("format", {}).get("format_name", ""):
            return "unsupported"
        if faststart(source):
            return "already-faststart"
        run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(source), "-map", "0", "-map_metadata", "0", "-map_chapters", "0", "-c", "copy", "-movflags", "+faststart", "-y", str(target)], deadline, 90)
        return None if faststart(target) and target.stat().st_size <= source.stat().st_size + 2 * 1024 * 1024 else "not-needed"
    if not ordinary_sdr(streams):
        return "unsupported"
    stream = videos[0]
    edge = 640 if kind in ("poster", "low") else 1280
    width, height = dimensions(stream, edge)
    scale = "scale=" + str(width) + ":" + str(height) + ":flags=lanczos,setsar=1"
    if kind == "poster":
        run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(min(.1, duration / 2)), "-i", str(source), "-map", "0:v:0", "-frames:v", "1", "-vf", scale, "-q:v", "2", "-update", "1", "-y", str(target)], deadline, 30)
        return None
    # Sources already at or below this size/bitrate need no lower-quality copy.
    rate = 550_000 if kind == "low" else 1_600_000
    bitrate = number(details.get("format", {}).get("bit_rate"))
    if max(display_size(stream)) <= edge and bitrate and bitrate <= rate * 1.2:
        return "not-needed"
    run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(source), "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "0", "-vf", scale, "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-maxrate", str(rate), "-bufsize", str(rate * 2), "-pix_fmt", "yuv420p", "-threads", "2", "-c:a", "aac", "-b:a", "96000" if kind == "low" else "128000", "-movflags", "+faststart", "-y", str(target)], deadline, 240)
    output = probe(target, deadline)
    result_duration = number(output.get("format", {}).get("duration"))
    if abs(result_duration - duration) > max(.25, duration * .002):
        raise ValueError("Viewing copy duration changed")
    if target.stat().st_size >= source.stat().st_size * .85:
        return "not-smaller"
    return None


def process(origin, item, deadline):
    requested = [kind for kind in VARIANTS if item.get(kind)]
    if not requested:
        return 0
    with tempfile.TemporaryDirectory(prefix="keha-video-") as directory:
        folder = pathlib.Path(directory)
        source = folder / "source.media"
        actual_size = download(origin, item["src"], source, deadline)
        if item.get("size") and actual_size != item["size"]:
            raise ValueError("Source changed during preparation")
        try:
            details = probe(source, deadline)
        except subprocess.CalledProcessError as error:
            # Only a complete download positively identified as an invalid
            # container is permanently skipped. Timeouts/network/tool errors
            # remain pending, and the batch continues to the following item.
            message = (error.stderr or b"").decode("utf-8", "replace").lower()
            if not any(marker in message for marker in ("moov atom not found", "invalid data found when processing input")):
                raise
            for kind in requested:
                query = urllib.parse.urlencode({"revision": item["revision"], "skip": "unsupported"})
                try:
                    call(origin, "/api/media/" + item["id"] + "/video-assets/" + kind + "?" + query, b"", "video/mp4")
                except urllib.error.HTTPError as stale:
                    if stale.code in (404, 409):
                        break
                    raise
            return 0
        saved = 0
        for kind in requested:
            output = folder / (kind + (".jpg" if kind == "poster" else ".mp4"))
            reason = encode(source, kind, details, output, deadline)
            query = {"revision": item["revision"]}
            if reason:
                query["skip"] = reason
                body = b""
            else:
                metadata = probe(output, deadline) if kind != "poster" else None
                stream = next((s for s in (metadata or details).get("streams", []) if s.get("codec_type") == "video"), {})
                width, height = dimensions(stream, 640) if kind == "poster" else display_size(stream)
                query.update({"width": round(width), "height": round(height)})
                if metadata:
                    query.update({key: number(metadata.get("format", {}).get(key)) for key in ("duration", "bit_rate")})
                    query["bitrate"] = query.pop("bit_rate")
                body = output
            path = "/api/media/" + item["id"] + "/video-assets/" + kind + "?" + urllib.parse.urlencode(query)
            try:
                result = upload(origin, path, body, "image/jpeg" if kind == "poster" else "video/mp4", query, deadline)
                saved += bool(result.get("saved")) and not reason
            except urllib.error.HTTPError as error:
                if error.code in (404, 409):
                    break  # Deleted or edited while encoding: never publish stale pixels.
                raise
            finally:
                output.unlink(missing_ok=True)
        return saved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", required=True)
    parser.add_argument("--max-seconds", type=int, default=1200)
    parser.add_argument("--max-items", type=int, default=30)
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    same_origin(origin, "/api/video-assets")
    deadline = time.monotonic() + max(1, args.max_seconds)
    backend_deadline = min(deadline, time.monotonic() + 600)
    while True:
        try:
            batch = call(origin, "/api/video-assets?limit=5")
            if batch.get("version") != 1:
                raise ValueError("Unexpected preparation backend version")
            break
        except urllib.error.HTTPError as error:
            if error.code not in (404, 503) or time.monotonic() >= backend_deadline:
                raise
            time.sleep(5)
    processed = saved = failed = 0
    while batch.get("items") and processed < args.max_items and time.monotonic() < deadline:
        for item in batch["items"]:
            if processed >= args.max_items or time.monotonic() >= deadline:
                break
            try:
                saved += process(origin, item, deadline)
            except (TimeoutError, subprocess.TimeoutExpired):
                # Keep unfinished revisions pending for the next bounded run.
                failed += 1
            except Exception as error:
                failed += 1
                print(json.dumps({"video_error": type(error).__name__, "status": getattr(error, "code", None)}), flush=True)
            processed += 1
            print(json.dumps({"processed": processed, "assets_saved": saved, "failed": failed}), flush=True)
        if not batch.get("next") or time.monotonic() >= deadline:
            break
        batch = call(origin, "/api/video-assets?limit=5&after=" + str(batch["next"]))
    print(json.dumps({"processed": processed, "assets_saved": saved, "failed": failed}), flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
