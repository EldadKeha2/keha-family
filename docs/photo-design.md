# Photo design studio

The magic wand uses the shared photo viewer in every gallery, including fullscreen. Designs always POST to the existing `edit?saveAs=copy` endpoint. The photo, face coordinates, original version and existing album membership are preserved. The editor has no overwrite action.

The Fun tab adds seven illustrated scenes, eight emoji heads, eight drawn props (including an editable speech bubble) and 32 movable emoji stickers. Stickers retain normalized position, size and rotation across preview and full-resolution export. Saved or detected face regions provide starting positions, with manual drag/resize and an All faces action. Undo and redo include stickers, scene selection and cutout brush strokes.

Background replacement lazily runs Google's MediaPipe Selfie Segmenter in a dedicated worker. The bundled 249,537-byte float16 model has one `selfie` confidence channel. Its source is `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`; the existing MediaPipe licence applies. The worker reuses the pinned 0.10.35 runtime already used by face detection. Requests are limited to same-origin static assets and the exact public WASM URL, with integrity verification and no credentials or referrer. Image pixels are never sent to an external editing API. There is no video/image generation subscription or API key requirement.

Erase and Restore brushes refine imperfect subject masks. If automatic separation is unavailable, the original foreground remains intact until the visitor manually erases its background. An in-progress automatic mask blocks saving, and closing the editor terminates its worker. All compositing and effects are rendered into the new image's pixels; nothing is merely a CSS preview.
