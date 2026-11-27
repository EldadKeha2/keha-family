import {createHash} from 'node:crypto';
import {readFile, rm, writeFile} from 'node:fs/promises';

const assets = new URL('../public/assets/', import.meta.url);
const index = new URL('../public/index.html', import.meta.url);
const source = await readFile(new URL('faces.js', assets));
const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
const filename = `faces-${hash}.js`;
const html = await readFile(index, 'utf8');
const script = /<script src="assets\/(faces(?:-[a-f0-9]{16})?\.js)(?:\?[^"\s]*)?" defer><\/script>/g;
const matches = [...html.matchAll(script)];
if (matches.length !== 1) throw new Error('Expected one face-picker script in public/index.html');

await writeFile(new URL(filename, assets), source);
const next = html.replace(script, `<script src="assets/${filename}" defer></script>`);
if (next !== html) await writeFile(index, next);
const previous = matches[0][1];
if (previous !== 'faces.js' && previous !== filename) await rm(new URL(previous, assets), {force: true});
