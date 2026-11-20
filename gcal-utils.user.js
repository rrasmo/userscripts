// ==UserScript==
// @name         Google Calendar Utils
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Highlights weekends in light gray and today in light blue across all Google Calendar views (Day, Week, Month, Year, mini calendar); marks office hours with gray dashed lines at 9:00 and 17:00 on weekdays in Day/Week/custom-day views; 'f' / 'd' to go to the next / previous period (never in input fields)
// @match        https://calendar.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false;
  const LOG_PREFIX = '[GCal Utils]';

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

  // --- Office hours markers ---
  // Gray dashed horizontal lines at OFFICE_START and OFFICE_END across every weekday
  // (Mon-Fri) column of the time grid (Day, Week and custom-day views). The grid is
  // laid out in the primary timezone and each time-grid column spans exactly 24h, so
  // hours map straight to a vertical offset (secondary timezones are only extra
  // labels and don't affect this).
  const OFFICE_START = 9;
  const OFFICE_END = 17;
  const OFFICE_CLASS = 'gcu-office-hours';
  const OFFICE_LINE_STYLE = '1px dashed gray';
  // Time-grid columns are tall (24h); all-day / header cells and Month view cells
  // also carry data-datekey but are much shorter.
  const MIN_TIME_COLUMN_HEIGHT = 480;
  const NON_TIME_GRID_VIEW_RE = /\/r\/(month|year|agenda|schedule)/;

  function findWeekdayTimeColumns() {
    if (NON_TIME_GRID_VIEW_RE.test(location.pathname)) return [];
    return Array.from(document.querySelectorAll('[data-datekey]')).filter((cell) => {
      if (cell.offsetHeight < MIN_TIME_COLUMN_HEIGHT || cell.offsetWidth === 0) return false;
      const d = decodeDateKey(cell.getAttribute('data-datekey'));
      if (!d) return false;
      const dow = new Date(d.year, d.month - 1, d.day).getDay();
      return dow >= 1 && dow <= 5;
    });
  }

  function markOfficeHours() {
    const columns = new Set(findWeekdayTimeColumns());
    document.querySelectorAll(`.${OFFICE_CLASS}`).forEach((el) => {
      if (!columns.has(el.parentElement)) el.remove();
    });

    columns.forEach((column) => {
      let lines = column.querySelectorAll(`:scope > .${OFFICE_CLASS}`);
      if (lines.length !== 2) {
        lines.forEach((el) => el.remove());
        if (getComputedStyle(column).position === 'static') column.style.position = 'relative';
        lines = [OFFICE_START, OFFICE_END].map(() => {
          const line = document.createElement('div');
          line.className = OFFICE_CLASS;
          Object.assign(line.style, {
            position: 'absolute',
            left: '0px',
            right: '0px',
            height: '0px',
            borderTop: OFFICE_LINE_STYLE,
            pointerEvents: 'none',
            zIndex: '5',
          });
          column.appendChild(line);
          return line;
        });
      }

      // Columns are 24 whole-pixel hours plus a 1px bottom gridline (e.g. 24 * 48 + 1),
      // so derive the hour height in whole pixels rather than using percentages, which
      // would drift off the hour gridlines by a fraction of a pixel. Recomputed on
      // every pass so it follows zoom / density changes (style isn't observed, so no
      // loop).
      const hour = Math.floor(column.offsetHeight / 24);
      lines[0].style.top = `${OFFICE_START * hour}px`;
      lines[1].style.top = `${OFFICE_END * hour}px`;
    });
  }

  function highlight() {
    const today = new Date();
    highlightDateKeyCells(today);
    highlightGridCells();
    markOfficeHours();
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

  // --- Keyboard shortcuts ---

  function isTypingInEditable(e) {
    const target = e.target;
    const tag = target.tagName && target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (target.isContentEditable) return true;
    if (target.getAttribute && target.getAttribute('role') === 'textbox') return true;
    return false;
  }

  // The top bar's arrow buttons have aria-labels like "Next week" / "Previous month"
  // depending on the current view. The sidebar mini calendar has its own
  // "Next month" / "Previous month" buttons, so look inside the top header first.
  function clickPeriodButton(direction) {
    const prefix = direction === 'next' ? 'Next' : 'Previous';
    const selector = `button[aria-label^="${prefix}"]`;
    const header = document.querySelector('header[role="banner"], header');
    const btn = header?.querySelector(selector) || document.querySelector(selector);
    if (!btn) {
      log(`no "${prefix}" button found`);
      return false;
    }
    btn.click();
    return true;
  }

  const PERIOD_KEYS = { f: 'next', d: 'previous' };

  document.addEventListener(
    'keydown',
    (e) => {
      if (isTypingInEditable(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const direction = PERIOD_KEYS[e.key];
      if (!direction) return;
      if (clickPeriodButton(direction)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
