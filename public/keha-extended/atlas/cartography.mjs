export const WIDTH = 920;
export const HEIGHT = 550;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function frame(zoom = 1, x = 0, y = 0) {
  const k = clamp(zoom, 1, 6);
  const w = WIDTH / k, h = HEIGHT / k;
  return {k, x:clamp(x, 0, WIDTH-w), y:clamp(y, 0, HEIGHT-h), w, h};
}

export function zoomAt(view, zoom, fx = .5, fy = .5) {
  const next = frame(zoom);
  return frame(next.k, view.x + fx*(view.w-next.w), view.y + fy*(view.h-next.h));
}

const mercator = lat => 180 / Math.PI * Math.asinh(Math.tan(lat * Math.PI / 180));

export function locatorBox(view, region, locator) {
  const mapUnit = region.span / WIDTH, scale = 300 / locator.span;
  // The printed base map uses equally spaced latitudes. Other views use Mercator.
  const ordinate = y => region.north === undefined ? region.top-y*mapUnit :
    mercator(region.north+(region.south-region.north)*y/HEIGHT);
  const upper=ordinate(view.y);
  return {
    x:(region.west + view.x*mapUnit - locator.west)*scale,
    y:(locator.top-upper)*scale,
    w:view.w*mapUnit*scale, h:(upper-ordinate(view.y+view.h))*scale
  };
}

export function airDistance([lat1, lon1], [lat2, lon2]) {
  const rad = Math.PI/180;
  const a = Math.sin((lat2-lat1)*rad/2)**2
    + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,a)));
}

export const groups = {
  family:'משפחת קהא שלנו', other:'נושאי קהא נוספים', maybe:'זיהוי מוצע', context:'הקשר גאוגרפי'
};

export function escapeText(value) {
  return String(value??'').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

export function glyph(group, r=7) {
  if (group==='other') return `<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" rx="1.8" class="atlas-solid"/>`;
  if (group==='maybe') return `<path d="M0 ${-r-1} ${r+1} 0 0 ${r+1} ${-r-1} 0Z" class="atlas-hollow"/>`;
  if (group==='context') return `<circle r="${r-1}" class="atlas-hollow"/>`;
  return `<circle r="${r+1}" class="atlas-solid"/><circle r="${r*.32}" fill="#fff9e9"/>`;
}

export function symbol(group) {
  return `<svg class="atlas-symbol" data-group="${group}" viewBox="-11 -11 22 22" aria-hidden="true">${glyph(group)}</svg>`;
}

export function baseMarker(m, place) {
  const attrs = `data-place="${escapeText(m.to)}" role="button" tabindex="0" aria-label="${escapeText(m.label+' · '+place.level)}" aria-pressed="false" transform="translate(${m.x} ${m.y})"`;
  if (m.letter) return `<g class="atlas-base-letter" ${attrs}><title>${escapeText(m.label)}</title><circle r="10"/><text y="4.7" text-anchor="middle">${escapeText(m.letter)}</text></g>`;
  const kind=m.id==='saada'?'city':m.status;
  const shapes={city:'<path d="M0-10 2.8-3.3 10-3.2 4.2 1.2 6.1 8.8 0 4.7 -6.1 8.8 -4.2 1.2 -10-3.2 -2.8-3.3Z"/>',
    known:'<circle r="4.9"/>',candidate:'<path d="M0-5 5 0 0 5 -5 0Z"/>',ref:'<rect x="-4.3" y="-4.3" width="8.6" height="8.6" rx="1"/>'};
  const main=['saada','haydan','talh','sorm','saf1','naz','majz'].includes(m.id);
  return `<g class="atlas-base-point ${kind}${main?' principal':''}" ${attrs}><title>${escapeText(place.title)}</title>
    <circle class="atlas-hit" r="11"/><circle class="atlas-selection" r="10"/>
    ${Math.abs(m.dx)>25?`<path class="base-leader" d="M0 0 L${m.dx*.47} ${(m.dy-3)*.47}"/>`:''}
    <g class="base-glyph">${shapes[kind]}</g><text class="base-name" x="${m.dx}" y="${m.dy}" direction="rtl" text-anchor="middle" style="--base-label-size:${m.size}px">${escapeText(m.label)}</text></g>`;
}

// Short names leave room for legible labels on a phone. The accessible name and evidence keep the full wording.
const phoneLabels = {
  sharmat:'שרמאת · סחר', miq:'מקבאב · סחר', mah:'אזור מוהצר', khawlan:'כ׳ולאן', mer:'מרבגה',
  modernSh:'שרמאת כיום', modernMiq:'מקבאב כיום', hila:'חילה · חאשד'
};
export function marker(m, place, group, measure, compact=false) {
  const labelText = compact ? (phoneLabels[m.id] || m.label) : m.label;
  const label = escapeText(labelText);
  const major = ['saada','sanaa','aden','shaar','khawlan','haydan','jer','eqron'].includes(m.id);
  const attrs = `class="atlas-marker${major?' atlas-major':''}" data-place="${m.to}" data-group="${group}" role="button" tabindex="0" aria-label="${escapeText(m.label+' · '+place.level)}" aria-pressed="false" transform="translate(${m.x} ${m.y})"`;
  if (m.area) {
    const w = Math.ceil(measure(labelText,compact?24:16))+(compact?44:32);
    const h = compact?37:30;
    return `<g ${attrs}><rect class="atlas-area" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="5"/>
      <g transform="translate(${w/2-(compact?15:12)} 0)">${glyph(group,compact?6:4.5)}</g>
      <text class="atlas-area-label" direction="rtl" text-anchor="middle" x="-6" y="${compact?7.5:5.2}">${label}</text></g>`;
  }
  const r = (m.id==='saada'?10:major?8:6.5)*(compact?1.27:1);
  const line = Math.hypot(m.dx,m.dy)>18 ? `<path class="atlas-leader" d="M0 0L${m.dx} ${m.dy}"/>` : '';
  return `<g ${attrs}><circle r="17" class="atlas-hit"/>${line}
    <circle r="${r+6}" class="atlas-selection"/>${m.unc?`<circle r="${r+3.5}" class="atlas-uncertain"/>`:''}${glyph(group,r)}
    <text class="atlas-place-label" direction="rtl" text-anchor="${m.side==='R'?'end':'start'}" x="${m.dx}" y="${m.dy+5}">${label}</text></g>`;
}
