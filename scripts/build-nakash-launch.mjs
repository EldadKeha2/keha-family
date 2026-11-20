import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {BRANCHES} from '../public/nakash/family-data.mjs';
import {appleLaunchImages, launchAssets, themedFamilies} from '../src/nakash-launch.mjs';

const assets = fileURLToPath(new URL('../public/', import.meta.url));
const original = await readFile(join(assets, 'assets/app-icons/icon.svg'), 'utf8');

for (const {id, color} of BRANCHES.filter(family => themedFamilies.has(family.id))) {
  const output = join(assets, launchAssets(id));
  await mkdir(output, {recursive:true});
  // Browser tabs use the transparent header medallion, including at small sizes.
  const tabMedallion = await readFile(join(assets, 'nakash', 'brand-' + id + '.svg'));
  await writeFile(join(output, 'tab-medallion.svg'), tabMedallion);
  await sharp(tabMedallion, {density:144}).resize(32, 32).png().toFile(join(output, 'tab-medallion-32.png'));

  // Keep the original medallion geometry and ring. Only its palette changes.
  const emblem = Buffer.from(original
    .replaceAll('#f7f3e9', color).replaceAll('#eef0e2', '#fbf8ef')
    .replaceAll('#87632f', color).replaceAll('#52684c', color)
    .replaceAll('#c4b17f', color));
  const icon = size => sharp(emblem, {density:144}).resize(size, size).png();
  const canvas = (width, height) => sharp({create:{width, height, channels:3, background:color}});
  for (const size of [180, 192, 512]) {
    await icon(size).toFile(join(output, 'icon-' + size + '.png'));
  }
  // The full ring must stay within Android's central 80% maskable safe zone.
  const maskable = await icon(450).toBuffer();
  await canvas(512, 512).composite([{input:maskable, gravity:'centre'}]).png().toFile(join(output, 'maskable-512.png'));
  const badges = new Map();
  for (const {width, height, scale, href} of appleLaunchImages(id)) {
    if (!badges.has(scale)) badges.set(scale, await icon(112 * scale).toBuffer());
    await canvas(width, height).composite([{input:badges.get(scale), gravity:'centre'}])
      .png().toFile(join(output, basename(href)));
  }
}
