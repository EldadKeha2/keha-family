import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/assets/dates.js', import.meta.url), 'utf8');
function fixture(userAgent = 'Android Mobile') {
  const document = new EventTarget(), groups = [];
  document.querySelectorAll = () => groups;
  document.activeElement = null;
  const emit = (type, target, data = {}, cancelable = true) => {
    const event = new Event(type, {cancelable});
    Object.defineProperty(event, 'target', {value: target});
    Object.assign(event, data);
    document.dispatchEvent(event);
    return event;
  };
  function group(prefix = 'photoEditDate') {
    const container = {querySelectorAll: () => fields};
    const fields = ['day', 'month', 'year'].map((part, index) => ({
      tagName: 'INPUT', id: prefix + part, name: '', inputMode: 'numeric',
      value: ['16', '10', '1980'][index], disabled: false, readOnly: false,
      closest: () => container, select() {},
      focus() { document.activeElement = this; emit('focusin', this); }
    }));
    groups.push(container);
    return fields;
  }
  const fields = group();
  const navigator = {userAgent};
  vm.runInNewContext(source, {window: {}, document, navigator});
  return {document, fields, group, emit, navigator};
}

test('phone spaces advance day to month to year and preserve all date values', () => {
  for (const ua of ['Android Mobile', 'iPhone', 'iPod']) {
    const f = fixture(ua), [day, month, year] = f.fields;
    assert.ok(f.fields.every(input => input.inputMode === 'text'));
    day.focus();
    assert.equal(f.emit('keydown', day, {key: ' '}).defaultPrevented, true);
    assert.equal(f.document.activeElement, month);
    assert.equal(f.emit('beforeinput', month, {data: ' ', inputType: 'insertText'}).defaultPrevented, true);
    assert.equal(f.document.activeElement, year);
    f.emit('keydown', year, {key: ' '});
    assert.equal(f.document.activeElement, year);
    assert.deepEqual(f.fields.map(input => input.value), ['16', '10', '1980']);
  }
});

test('mobile input fallback restores a number sanitized by the browser and advances once', () => {
  const f = fixture(), [day, month, year] = f.fields;
  day.focus();
  f.emit('beforeinput', day, {data: '7', inputType: 'insertText'});
  day.value = '7'; f.emit('input', day, {data: '7', inputType: 'insertText'});
  assert.equal(f.emit('beforeinput', day, {data: ' ', inputType: 'insertText'}, false).defaultPrevented, false);
  day.value = ''; f.emit('input', day, {data: ' ', inputType: 'insertText'}, false);
  assert.equal(day.value, '7'); assert.equal(f.document.activeElement, month);
  f.emit('beforeinput', day, {data: ' ', inputType: 'insertText'});
  assert.equal(f.document.activeElement, month);
  month.value = ''; f.emit('input', month, {data: ' ', inputType: 'insertText'}, false);
  assert.equal(month.value, '10'); assert.equal(f.document.activeElement, year);
});

test('navigation begins at day, ends on leaving the group, and covers dynamically added dates', () => {
  const f = fixture();
  f.fields[1].focus();
  assert.equal(f.emit('keydown', f.fields[1], {key: ' '}).defaultPrevented, false);
  f.fields[0].focus();
  const outside = {tagName: 'TEXTAREA'};
  f.document.activeElement = outside; f.emit('focusin', outside);
  assert.equal(f.emit('keydown', outside, {key: ' '}).defaultPrevented, false);
  f.fields[1].focus();
  assert.equal(f.emit('keydown', f.fields[1], {key: ' '}).defaultPrevented, false);
  for (const prefix of ['birth', 'wedding', 'photoDate', 'photoEditDate']) {
    const fields = f.group(prefix);
    f.emit('pointerdown', fields[0]);
    assert.ok(fields.every(input => input.inputMode === 'text'));
    fields[0].focus(); f.emit('keydown', fields[0], {key: ' '});
    assert.equal(f.document.activeElement, fields[1]);
    f.emit('keydown', fields[1], {key: ' '});
    assert.equal(f.document.activeElement, fields[2]);
  }
});

test('desktop, held keys, composition, modifiers, other typing and disabled fields keep their behavior', () => {
  for (const ua of ['Windows NT 10.0', 'Macintosh', 'X11 Linux x86_64']) {
    const f = fixture(ua); f.fields[0].focus();
    assert.ok(f.fields.every(input => input.inputMode === 'numeric'));
    assert.equal(f.emit('keydown', f.fields[0], {key: ' '}).defaultPrevented, false);
    assert.equal(f.document.activeElement, f.fields[0]);
  }
  const f = fixture(), [day, month] = f.fields;
  day.focus();
  for (const flags of [{key: 'Tab'}, {key: '1'}, {key: ' ', isComposing: true}, {key: ' ', ctrlKey: true}, {key: ' ', altKey: true}, {key: ' ', metaKey: true}]) {
    assert.equal(f.emit('keydown', day, flags).defaultPrevented, false);
    assert.equal(f.document.activeElement, day);
  }
  f.emit('keydown', day, {key: ' ', repeat: true});
  assert.equal(f.document.activeElement, day);
  month.disabled = true; f.emit('keydown', day, {key: ' '});
  assert.equal(f.document.activeElement, day);
  month.disabled = false; day.readOnly = true;
  assert.equal(f.emit('keydown', day, {key: ' '}).defaultPrevented, false);
});
