import { boundedBody, HttpError, json, sha256 } from './http.mjs';
import { getObject, putObject } from './hf.mjs';

// A release binds picture, audio and captions to one specific render. The editable
// family site can provision that render without making the masters public in git.
const editions = new Map([
  [
    'shlomo/16',
    {
      size: 48062811,
      sha: '7fa4fe9eaed825f09f0c3e86c555cfb448f3a915a7ff53b78df7c876fb162b7d',
      filename: 'Shlomo_Keha_Aliyah_v16.mp4',
    },
  ],
  [
    'shlomo/12',
    {
      size: 52023167,
      sha: '9105636252cd80a1fb6d3faf44972b537591266aa3f1335fd872948060182e8a',
      filename: 'Shlomo_Keha_Aliyah_v12.mp4',
    },
  ],
  [
    'shlomo/9',
    {
      size: 39531806,
      sha: 'deaec2cd19cd8aa31c6a8f12d8347d4df2d8be67194eabb7f9be530a03f60b8e',
      filename: 'Shlomo_Keha_Aliyah_v9.mp4',
    },
  ],
  [
    'shlomo/8',
    {
      size: 40949089,
      sha: 'fa4b5271d6e12baa06b5ddb7714fee12373679a20907c0bdd6ad8c9429d1b38f',
      filename: 'Shlomo_Keha_Aliyah_v8.mp4',
    },
  ],
  [
    'shlomo/7',
    {
      size: 34454430,
      sha: 'e032f791dd82c758e22d647e9259c746c1fb50c0affaf2e0403e8d6d10cd1f72',
      filename: 'Shlomo_Keha_Aliyah_v7.mp4',
    },
  ],
  [
    'shlomo/6',
    {
      size: 34454938,
      sha: 'fd4b5a618664e84f7ae0d9902e263fb097f758bcf440e0ff2d58a4cb694f2202',
      filename: 'Shlomo_Keha_Aliyah_v6.mp4',
    },
  ],
  [
    'shlomo/5',
    {
      size: 34327239,
      sha: 'f51553a8ae8fe858237f65760562d157fcfbb77aa0574b4fbd4e7534d12d2d0e',
      filename: 'Shlomo_Keha_Aliyah_v5.mp4',
    },
  ],
  [
    'shlomo/4',
    {
      size: 27618631,
      sha: '8c7868864d92ff3798abab4b08560f4536082b9767cc0159c2f8bfa5aea9c11c',
      filename: 'Shlomo_Keha_Aliyah_v4.mp4',
    },
  ],
  [
    'shlomo/3',
    {
      size: 19373845,
      sha: '452e73cccce449e3607db00fd2fb96fd470295759b0c5de3d6a8959acc277f25',
      filename: 'Shlomo_Keha_Aliyah_v3.mp4',
    },
  ],
  [
    'yona/2',
    {
      size: 18513838,
      sha: '52d515cb62aa99821325e1f5254175925f85ce93c39c85c0b007c517a6d4243f',
      filename: 'Yona_Nakash_Aliyah_v2.mp4',
    },
  ],
]);

export async function journeyFilm(request, env, edition) {
  const film = editions.get(edition);
  if (!film) throw new HttpError(404, 'גרסת הסרט לא נמצאה.');
  const item = {
    kind: 'video',
    mime: 'video/mp4',
    size: film.size,
    key: `journey-films/${edition}/${film.sha}.mp4`,
  };
  if (request.method === 'POST') {
    const length = request.headers.get('Content-Length');
    if (length && Number(length) !== film.size)
      throw new HttpError(400, 'גודל הקובץ אינו תואם לגרסת הסרט.');
    const data = await boundedBody(request, film.size);
    if (data.byteLength !== film.size)
      throw new HttpError(400, 'הקובץ שהתקבל אינו שלם.');
    if ((await sha256(data)) !== film.sha)
      throw new HttpError(409, 'הקובץ אינו תואם למהדורה של הסרט והכתוביות.');
    await putObject(env, item.key, data, film.size, item.mime);
    return json({ ready: true, size: film.size });
  }
  const response = await getObject(env, item, request);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  if (new URL(request.url).searchParams.has('download'))
    headers.set(
      'Content-Disposition',
      `attachment; filename="${film.filename}"`,
    );
  return new Response(response.body, { status: response.status, headers });
}
