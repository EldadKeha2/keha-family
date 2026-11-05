# Family nursery

`#nursery` lists the main family roster as small framed baby albums. Cards are derived from `FamilyApp.getPeople()` and exclude both `extended` relatives and `extra` names introduced through tags. New canonical members therefore appear without a separate nursery registration. `#nursery/<person-id>` opens that member's album, in Hebrew or either English variant.

Baby photos use the existing image upload, HF object storage, media metadata, caption, tagging, sharing, soft deletion and undo machinery. They have a separate `nursery:<person-id>` collection, so uploading a baby photo does not change the adult profile picture or populate another member's album. Selecting multiple files, camera capture, drag and drop, and pasting images follow the existing gallery behavior. Albums show ten photos per page, newest first; the newest image is the index cover. Existing exports include these collections automatically.

`GET /api/nursery` reads only nursery cover/count summaries. `GET /api/nursery/<id>?page=1` reads a bounded album page. `POST /api/nursery/<id>/upload` accepts the same verified image formats and 50 MB limit as other photo uploads. Canonical membership is checked before uploading bytes. Extended relatives and tag-only names cannot create a nursery album through the API.

Client upload jobs retain the member selected when opening the file picker. Slow album or summary refreshes cannot replace more recent uploads. The common media viewer retains its familiar description, tagging, download, sharing and recoverable deletion controls.

The desktop navigation uses individually framed tabs with an olive active state. On the phone home screen and menu, nursery and memorial are regular half-width tiles; the family tree remains the wide first tile.
