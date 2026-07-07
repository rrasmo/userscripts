// ==UserScript==
// @name         Google Calendar Highlight Weekends & Today
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Highlights weekends in light gray and today in light blue across all Google Calendar views (Day, Week, Month, Year, mini calendar)
// @match        https://calendar.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false;
  const LOG_PREFIX = '[GCal Highlight]';

  const log = (...args) => DEBUG && console.log(LOG_PREFIX, ...args);

  const WEEKEND_COLOR = 'rgba(198, 198, 198, 0.09)';
  const TODAY_COLOR = 'rgba(160, 200, 255, 0.1)';

  // Day/Week/Month grid cells carry a data-datekey attribute encoding the date as
  // ((year - 1970) * 16 + month) * 32 + day (confirmed by inspecting consecutive days'
  // values, e.g. June 30 2026 -> 28894, July 1 2026 -> 28897 - a +3 jump at the month
  // boundary that only this formula reproduces).
  function decodeDateKey(attrValue) {
    const key = parseInt(attrValue, 10);
    if (!Number.isFinite(key)) return null;
    const day = key % 32;
    const monthYear = Math.floor(key / 32);
    const month = monthYear % 16;
    const year = 1970 + Math.floor(monthYear / 16);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }

  // The data-datekey cell itself doesn't always render a visible background:
  // - Week/Day view nests a full-bleed (position: absolute, inset: 0) div for that.
  // - Month view has two data-datekey elements per day: an empty, front-most div (no
  //   good target), and the day-number element itself (e.g. an <h2>, a text leaf with
  //   no element children) whose PARENT is the actual full-size day box. Google draws
  //   the "today" circle as that leaf's own background (border-radius: 50%), so
  //   targeting the parent instead paints behind it - children always render over
  //   their parent's own background, so the circle is never covered.
  // Found by computed style/structure rather than class name, since Google's hashed
  // class names change across deploys.
  function getBackgroundTarget(cell) {
    if (cell.children.length === 0 && cell.textContent.trim() !== '' && cell.parentElement) {
      return cell.parentElement;
    }
    const divs = Array.from(cell.children).filter((el) => el.tagName === 'DIV');
    const fullBleed = divs.find((el) => {
      const style = getComputedStyle(el);
      return (
        style.position === 'absolute' &&
        style.top === '0px' &&
        style.left === '0px' &&
        style.right === '0px' &&
        style.bottom === '0px'
      );
    });
    return fullBleed || divs[0] || cell;
  }

  function applyColor(el, isToday, isWeekend) {
    el.style.backgroundColor = isToday ? TODAY_COLOR : isWeekend ? WEEKEND_COLOR : '';
  }

  // Year view and the sidebar mini calendar use a different, simpler component:
  // buttons with data-grid-cell="true" and an aria-label like "1, Wednesday" or, for
  // the current day, "July 7, Tuesday, today" (month name/", today" suffix only appear
  // when needed to disambiguate or mark today).
  const WEEKDAY_RE = /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/;

  function highlightDateKeyCells(today) {
    let matched = 0;
    const cells = document.querySelectorAll('[data-datekey]');
    cells.forEach((cell) => {
      const d = decodeDateKey(cell.getAttribute('data-datekey'));
      if (!d) return;
      matched += 1;
      const dow = new Date(d.year, d.month - 1, d.day).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isToday = d.year === today.getFullYear() && d.month === today.getMonth() + 1 && d.day === today.getDate();
      const target = getBackgroundTarget(cell);
      // In Month view there's no distinct full-bleed layer, so the target IS the bare
      // cell - the same element Google's own solid "today" circle renders over. Tinting
      // it there would paint our overlay on top of that circle and wash it out, so skip
      // the today tint (weekends are unaffected by this, still tint those).
      const targetIsBareCell = target === cell;
      applyColor(target, isToday && !targetIsBareCell, isWeekend);
    });
    log(`data-datekey pass: ${cells.length} cell(s), ${matched} matched`);
  }

  function highlightGridCells() {
    let matched = 0;
    const cells = document.querySelectorAll('[data-grid-cell="true"]');
    cells.forEach((cell) => {
      const label = cell.getAttribute('aria-label');
      const match = label?.match(WEEKDAY_RE);
      if (!match) return;
      matched += 1;
      const isWeekend = match[1] === 'Saturday' || match[1] === 'Sunday';
      // Year view and the mini calendar draw today's solid circle directly on this
      // same button; an inline background here would override it outright, so leave
      // today's cell untouched and rely on Google's own indicator.
      applyColor(cell, false, isWeekend);
    });
    log(`data-grid-cell pass: ${cells.length} cell(s), ${matched} matched`);
  }

  function highlight() {
    const today = new Date();
    highlightDateKeyCells(today);
    highlightGridCells();
  }

  let scheduled = false;
  function scheduleHighlight(reason) {
    if (scheduled) return;
    scheduled = true;
    log('scheduling highlight pass, reason:', reason);
    requestAnimationFrame(() => {
      scheduled = false;
      highlight();
    });
  }

  new MutationObserver((mutations) => scheduleHighlight(`mutation (${mutations.length})`)).observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-datekey', 'aria-label'],
    }
  );

  scheduleHighlight('init');

  // Catch the midnight rollover for tabs left open overnight.
  setInterval(() => scheduleHighlight('interval'), 60 * 1000);
})();
