import {normalizeSearch, searchVariants, searchNames, personRank, personSearchPriority} from '../public/assets/site-search-core.mjs';
import {photoLabelName, photoLabelKey, photoLabels} from '../public/assets/photo-labels-catalog.mjs';

function counts(items, values) {
  const result = new Map();
  for (const item of items) {
    for (const value of new Set(values(item).filter(Boolean))) result.set(value, (result.get(value) || 0) + 1);
  }
  return result;
}

export function searchNakash(people, media, branches, params, scope) {
  const get = (key, fallback = '') => params.get(key) || fallback;
  const query = get('q').trim().slice(0, 200);
  const type = get('type', 'all'), branch = get('branch'), year = get('year'), label = get('label');
  const selectedId = get('person'), sort = get('sort', 'relevance');
  const personById = new Map(people.map(person => [person.id, person]));
  const person = personById.get(selectedId);
  const variants = person && searchNames(person).map(normalizeSearch).includes(normalizeSearch(query)) ? [] : searchVariants(query);
  const terms = variants.map(variant => variant.split(' '));
  const matchesText = value => !terms.length || terms.some(words => words.every(word => normalizeSearch(value).includes(word)));
  const entries = [];
  if (query || selectedId) {
    for (const p of people) {
      if (p.placeholder || selectedId && p.id !== selectedId) continue;
      const rank = personRank(p, query);
      if (!selectedId && !rank && !matchesText(p.about || '')) continue;
      entries.push({id:p.id,type:'person',title:p.name,titleEn:p.nameEn,href:p.profileHref||'#person/'+encodeURIComponent(p.id),person:p,people:[p],
        year:Number(String(p.birthday || '').split('.').at(-1)) || null,date:'',excerpt:p.about || '',score:rank+50+(2-personSearchPriority(p,query,scope))*200,labels:[],branches:[p.branch]});
    }
    for (const item of media) {
      const tagged = (item.people || item.tags || []).map(value => personById.get(typeof value === 'string' ? value : value.id)).filter(Boolean);
      if (selectedId && !tagged.some(p => p.id === selectedId)) continue;
      const title = item.caption || item.name || item.filename || '';
      const labels = photoLabels(item.labels);
      if (!matchesText([title, item.caption, ...labels, ...tagged.flatMap(searchNames)].join(' '))) continue;
      entries.push({id:item.id,type:item.kind || item.type,title,titleEn:item.nameEn,media:item,people:tagged,
        year:item.takenDate?.year || null,date:item.createdAt || '',excerpt:item.caption || '',score:30,
        labels:labels.map(photoLabelKey),branches:[...new Set([...(item.branches||[]),...tagged.map(p => p.branch)])]});
    }
  }

  const accepts = (item, except) => (except === 'type' || type === 'all' || item.type === type)
    && (except === 'branch' || !branch || item.branches.includes(branch))
    && (except === 'year' || !year || String(item.year) === year)
    && (except === 'label' || !label || item.labels.includes(label));
  const facet = (key, values) => counts(entries.filter(item => accepts(item, key)), values);
  const types = facet('type', item => [item.type]);
  const branchCounts = facet('branch', item => item.branches);
  const years = facet('year', item => [item.year === 1111 ? null : item.year]);
  const labels = facet('label', item => item.labels);
  const items = entries.filter(item => accepts(item));
  const dateKey = item => item.year && item.year !== 1111 ? String(item.year) : item.date;
  items.sort((a, b) => sort === 'newest' ? dateKey(b).localeCompare(dateKey(a)) : sort === 'oldest' ? dateKey(a).localeCompare(dateKey(b)) :
    b.score - a.score || dateKey(b).localeCompare(dateKey(a)) || a.id.localeCompare(b.id));
  const size = Math.max(1,Math.min(48, Math.trunc(Number(get('size', 24))) || 24));
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.max(1, Math.min(pages, Math.trunc(Number(get('page', 1))) || 1));
  return {query, person:person || null, items:items.slice((page-1)*size,page*size).map(({score, labels, branches, ...item}) => item),
    count:items.length, page, pages, size, facets:{
      types:[...types].map(([id,count]) => ({id,count})),
      branches:branches.filter(item => branchCounts.has(item.id)).map(item => ({id:item.id,title:item.label || item.title,titleEn:item.titleEn,count:branchCounts.get(item.id)})),
      years:[...years].sort(([a],[b]) => b-a).map(([id,count]) => ({id:String(id),title:String(id),count})),
      labels:[...labels].map(([id,count]) => ({id,title:photoLabelName(id)||id,count})),
    }};
}
