# Photo album shortcuts

Personal photo thumbnails and the shared photo viewer show three small icon buttons: baby, wedding rings and family. Gallery thumbnails, gallery viewing and shared photo links show the family icon. A green background and check indicate membership; selecting an unmarked icon adds the existing photo immediately. Selecting a marked icon is a no-op. People without an eligible nursery or wedding album retain disabled icons with explanatory accessible labels.

`POST /api/media/<id>/collections` accepts `{collection, scope}`. Family photos use `photos`; nursery and wedding targets use the canonical `nursery:<person>` and `wedding:<unit>` identities. The server verifies that nursery/wedding requests originate from that person's owned or tagged album, and that a wedding belongs to the same person. Existing write-token, origin and transaction protections apply. Nonphotos are rejected.

The `media_collections` table holds unique references to the original media ID. Native categories are also reported as membership, without a migration over existing photos. Media files, captions, tags and face labels are shared. Lists and nursery summaries combine native and linked photos without duplicates. Album revisions update for shared edits, deletion and restoration. Soft deletion hides the photo everywhere; undo restores all memberships. Export includes `mediaCollections`.

Pending saves are keyed by photo and album. Repeated taps cannot duplicate a save; failure leaves an unmarked button available for retry. Out-of-order successful adds are reconciled, and a response for a previous photo cannot mark the next one. A narrow phone layout reserves room for the icon row without increasing the photo area and existing controls' combined height.
