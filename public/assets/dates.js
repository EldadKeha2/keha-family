(() => {
  'use strict';
  function parse(value) {
    const match = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(String(value).trim());
    if (!match) return null;
    const [day, month, year] = match.slice(1).map(Number);
    if (year < 1000) return null;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? {day, month, year, date} : null;
  }
  function age(value, today = new Date()) {
    const born = parse(value);
    if (!born || born.year === 1111 || born.date > today) return null;
    let years = today.getFullYear() - born.year;
    if (today.getMonth() + 1 < born.month || (today.getMonth() + 1 === born.month && today.getDate() < born.day)) years--;
    return years >= 0 ? years : null;
  }
  window.FamilyDates = {parse, age};

  // Keep numeric validation, but expose a keyboard with a space key on phones.
  const groups = '.date-fields, .photo-date-fields, .photo-edit-date-fields';
  const phone = () => navigator.userAgentData?.mobile === true || /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent || '');
  const previousValues = new WeakMap();
  let activeGroup = null;
  function dateFields(group) {
    return ['day', 'month', 'year'].map(part => [...group.querySelectorAll('input')].find(input =>
      input.name === part || input.id.toLowerCase().endsWith(part)));
  }
  function prepare(group) {
    if (!phone()) return;
    for (const input of dateFields(group)) if (input) input.inputMode = 'text';
  }
  function fieldGroup(input) {
    return input?.tagName === 'INPUT' ? input.closest(groups) : null;
  }
  function currentField(event) {
    const input = event.target, group = fieldGroup(input);
    if (!phone() || !group || group !== activeGroup || document.activeElement !== input ||
        input.disabled || input.readOnly || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return null;
    const fields = dateFields(group), index = fields.indexOf(input);
    return index < 0 ? null : {input, fields, index};
  }
  function advance({fields, index}) {
    const next = fields[index + 1];
    if (!next || next.disabled || next.readOnly) return;
    next.focus({preventScroll: true});
    next.select();
  }
  document.querySelectorAll(groups).forEach(prepare);
  // Capture also covers date editors that are created after page load.
  document.addEventListener('pointerdown', event => {
    const group = fieldGroup(event.target);
    if (group) prepare(group);
  }, true);
  document.addEventListener('focusin', event => {
    const input = event.target, group = fieldGroup(input);
    if (!phone() || !group) { activeGroup = null; return; }
    prepare(group);
    previousValues.set(input, input.value);
    if (input === dateFields(group)[0]) activeGroup = group;
    else if (group !== activeGroup) activeGroup = null;
  }, true);
  document.addEventListener('keydown', event => {
    if (event.isComposing || (event.key !== ' ' && event.key !== 'Spacebar')) return;
    const field = currentField(event);
    if (!field) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) advance(field);
  }, true);
  document.addEventListener('beforeinput', event => {
    const field = currentField(event);
    if (!field) return;
    previousValues.set(field.input, field.input.value);
    if (event.isComposing || !/^ +$/.test(event.data || '') || !event.inputType?.startsWith('insert') || !event.cancelable) return;
    event.preventDefault();
    event.stopPropagation();
    advance(field);
  }, true);
  document.addEventListener('input', event => {
    const field = currentField(event);
    if (!field) return;
    // Some phone keyboards skip keydown or send a non-cancelable beforeinput.
    if (!event.isComposing && /^ +$/.test(event.data || '') && event.inputType?.startsWith('insert')) {
      field.input.value = previousValues.get(field.input) ?? '';
      event.stopPropagation();
      advance(field);
    } else previousValues.set(field.input, field.input.value);
  }, true);
})();
