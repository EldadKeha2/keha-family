import { boundedBody, HttpError, json, sha256 } from './http.mjs';
import { getObject, putObject } from './hf.mjs';

// A release binds picture, audio and captions to one specific render. The editable
// family site can provision that render without making the masters public in git.
const editions = new Map([
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
