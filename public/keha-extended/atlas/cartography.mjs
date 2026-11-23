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

// Both projections store a longitude span and the Mercator ordinate at the top.
export function locatorBox(view, region, locator) {
  const mapUnit = region.span / WIDTH, scale = 300 / locator.span;
  return {
    x:(region.west + view.x*mapUnit - locator.west)*scale,
    y:(locator.top - region.top + view.y*mapUnit)*scale,
    w:view.w*mapUnit*scale, h:view.h*mapUnit*scale
  };
}

export function airDistance([lat1, lon1], [lat2, lon2]) {
  const rad = Math.PI/180;
  const a = Math.sin((lat2-lat1)*rad/2)**2
    + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,a)));
}

export const groups = {
  family:'המשפחה שלנו', other:'נושאי קהא נוספים', maybe:'זיהוי מוצע', context:'הקשר גאוגרפי'
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

export function marker(m, place, group, measure) {
  const label = escapeText(m.label);
  const major = ['saada','sanaa','aden','taiz','shaar','khawlan','haydan','jer','eqron'].includes(m.id);
  const attrs = `class="atlas-marker${major?' atlas-major':''}" data-place="${m.to}" data-group="${group}" role="button" tabindex="0" aria-label="${escapeText(m.label+' · '+place.level)}" aria-pressed="false" transform="translate(${m.x} ${m.y})"`;
  if (m.area) {
    const w = Math.ceil(measure(m.label))+32;
    return `<g ${attrs}><rect class="atlas-area" x="${-w/2}" y="-15" width="${w}" height="30" rx="5"/>
      <g transform="translate(${w/2-12} 0)">${glyph(group,4.5)}</g>
      <text class="atlas-area-label" direction="rtl" text-anchor="middle" x="-6" y="5.2">${label}</text></g>`;
  }
  const r = m.id==='saada'?10:major?8:6.5;
  const line = Math.hypot(m.dx,m.dy)>18 ? `<path class="atlas-leader" d="M0 0L${m.dx} ${m.dy}"/>` : '';
  return `<g ${attrs}><circle r="17" class="atlas-hit"/>${line}
    <circle r="${r+6}" class="atlas-selection"/>${m.unc?`<circle r="${r+3.5}" class="atlas-uncertain"/>`:''}${glyph(group,r)}
    <text class="atlas-place-label" direction="rtl" text-anchor="${m.side==='R'?'end':'start'}" x="${m.dx}" y="${m.dy+5}">${label}</text></g>`;
}
