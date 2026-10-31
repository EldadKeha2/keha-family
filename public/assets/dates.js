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
})();
