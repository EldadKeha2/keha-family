# Family storybook and recordings

`#stories` opens the ornamented storybook. Its five chapters are `roots`,
`people`, `family`, `childhood`, and `funny`. Choosing a chapter animates a page
turn before scrolling to the selected memories. Reduced-motion preferences
skip the animation. The centre book restores all chapters.

Stories keep the existing `/api/stories` endpoints and attachments. Category
and `personIds` are now saved alongside authored content; the year is optional.
Legacy rows without a category appear under family memories. Editing through
an older client preserves the existing chapter and tags. `expectedUpdatedAt`
continues to prevent concurrent overwrites.

`#voices` is an independent audio archive. It supports original MP3, M4A, WAV,
OGG, AAC, FLAC and audio WebM uploads, tagged people, optional year, description,
author, native audio playback, seeking, downloading, and metadata editing.
It does not add audio to photo/video albums.

- `GET /api/voices` returns public recording metadata with an ETag.
- `POST /api/voices/upload?uploadId=<32 hex>&filename=<name>` streams original
  bytes, up to 90 MiB, into existing storage. The public write marker and usual
  same-origin validation apply. `X-Family-Recording` contains base64 UTF-8 JSON
  (`title`, `body`, `author`, `year`, `personIds`).
- `POST /api/voices/<id>` edits metadata and tags with `expectedUpdatedAt`.
- `GET|HEAD /api/voices/<id>/audio` proxies bytes and Range requests without
  revealing storage credentials. `?download=1` adds attachment disposition.

Recordings live in a separate Durable Object SQLite table, included in exports.
All person IDs and metadata are checked before storage. Upload IDs deduplicate
retries; every transfer stages a unique key, so concurrent retries cannot
overwrite registered audio. Staged bytes survive ambiguous state-service
failures, which might hide a successful registration.

Validation covers legacy stories, nullable years, chapters and tags, stale
edits, storage rollback, byte-identical audio, range/HEAD/download requests,
retries, invalid files and origins, keyboard tagging, chapter transitions,
English labels, reduced motion and explicit loading failures.
