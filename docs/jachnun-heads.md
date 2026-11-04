# Catch the Jachnun: prepared heads

Reviewed on 4 November 2026. The game uses fixed copies of selected profile photographs with individual crop coordinates. Live profile changes or deletions do not alter these copies. Only the selected character’s photo is loaded; the chain and life markers reuse the same in-memory crop.

The photographs are copied byte for byte. Cropping is performed by the game canvas, using `public/assets/jachnun-heads.mjs`. New or replacement heads require an intentional update to that list and its matching asset.

| Person ID | Original media | Fixed asset |
| --- | --- | --- |
| amir | /media/37c6fa1e2d4b4749acd64752a3ed8c84 | amir.png |
| amit | /media/d2b9cb1d2a0e4d92ba025721512980aa | amit.jpg |
| ariel-n | /media/eb9fd952b7b9484dbb49eb98f6391422 | ariel-n.png |
| ben | /media/d7f6685a369c4d2c85aec37497949c83 | ben.png |
| chantal | /media/359c5c663f004de4aa80248a84d57687 | chantal.png |
| eldad | /media/6c940bef65584e938b7052b5d245cab5 | eldad.jpg |
| emmy | /media/608e5d00671c4861b538efca0f325deb | emmy.jpg |
| idan | /media/9e5e5c840af84fc69b0143fc1f432f12 | idan.jpg |
| lihi | /media/982f23d63f8244c0aeabe96bcbae7095 | lihi.png |
| neri | /media/255f56e5e2d9448b8256f1260f9dcbb1 | neri.png |
| orel | /media/5d57e6696b2c4c7b88e5e87dc5fab4d5 | orel.png |
| orit | /media/948a01911814447baf7fbf1a3018e0f5 | orit.png |
| ruby | /media/69f0c8e35a7f451cb7e77980f78b5c6d | ruby.png |
| ruti | /media/d26940434443420e8f19793bed402e92 | ruti.png |
| sam | /media/1021a6b648bb48c1a4c1e9952d28e4b3 | sam.png |
| tammy | /media/fe976491df1544b68d6d2878a8fdb68c | tammy.png |
| tomer | /media/3ff8f11c0ee64f4baa609ffb7281a272 | tomer.png |
| yarden | /media/d91889e75b1443788a996c5281cd713f | yarden.png |
| yona | /media/1c4f834f75894fa198b9d5477d495b13 | yona.png |

Head requests require a name and are sent through the existing transactional mail provider to `eldakeha@gmail.com`. The server fixes the recipient, validates the name, deduplicates retries and limits request volume. The form reports success only after the provider accepts the message. Requests do not create mailing-list subscriptions.
