// ==UserScript==
// @name         Google Calendar Utils
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Highlights weekends in light gray and today in light blue across all Google Calendar views (Day, Week, Month, Year, mini calendar); marks office hours with gray dashed lines at 9:00 and 17:00 on weekdays in Day/Week/custom-day views; new items (grid click, '+ Create', 'c') open pre-set to the type of the last item created (Event with its Calendar, Task with its List, or Appointment schedule), drag-drawn drafts painted to match, recorded on Save / Cmd+S - Shift+click Create for the menu; 'f' / 'd' to go to the next / previous period (never in input fields)
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

  // --- Remember last created item type ---
  // New items open pre-set to the type of the last item created (Event, Task or
  // Appointment schedule), plus the last Calendar used for Events and the last List
  // used for Tasks. This covers grid slot clicks, the '+ Create' button and the 'c'
  // shortcut.
  // - Grid clicks and the Create menu open a quick-create dialog with one tab per
  //   type (#tabEvent, #tabTimeBlockTask, #tabAppointmentSlotsV2Entry). All three
  //   panels stay in the DOM, so hidden dropdowns can be set before their tab shows.
  // - '+ Create' normally opens a menu. A plain click now skips it and opens the
  //   last type directly; Shift+click still shows the menu. Picking a menu item
  //   yourself is respected and the tab is left alone.
  // - 'c' opens the full event-edit page, which has no Task or Appointment option,
  //   so for those types 'c' opens the quick dialog (Task) or the schedule page
  //   (Appointment) instead.
  // - Click-dragging on the grid draws a draft block before the dialog exists, and
  //   Google paints it in the default calendar's color. While dragging it's painted
  //   in the color the last created item's draft had (recorded on save); once the
  //   dialog opens and the tab / calendar are switched, Google repaints it itself.
  // The type is recorded on Save (button or Cmd/Ctrl+S, or Enter in the quick
  // dialog's title), so only items actually created count.
  const STORAGE_KEY = 'gcu-last-created';
  const TAB_IDS = { event: 'tabEvent', task: 'tabTimeBlockTask', appointment: 'tabAppointmentSlotsV2Entry' };
  const MENU_KEYS = { event: 'event', task: 'task_time_block' };
  const SAVE_BUTTON_SELECTOR = 'button[jsname="x8hlje"]';
  const CREATE_BUTTON_SELECTOR = 'button[jsname="todz4c"]';
  const NEW_EVENT_EDIT_RE = /\/r\/eventedit\/?$/;
  const NEW_APPOINTMENT_RE = /\/r\/appointment\/?$/;
  const EXPLICIT_CHOICE_MS = 3000;
  const PENDING_EVENT_EDIT_MS = 10000;

  function loadLastCreated() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveLastCreated(update) {
    const next = { ...loadLastCreated(), ...update };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    log('remembered last created:', next);
  }

  const isVisible = (el) => !!el && el.getClientRects().length > 0;

  function findCreateDialog() {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    return Array.from(dialogs).find((d) => isVisible(d) && d.querySelector(`#${TAB_IDS.event}`)) || null;
  }

  function selectedDialogType(dialog) {
    const tab = dialog.querySelector('[role="tab"][aria-selected="true"]');
    return Object.keys(TAB_IDS).find((type) => TAB_IDS[type] === tab?.id) || null;
  }

  // Quick dialog: the Event panel is data-tab-type="1", Task is "13". With a single
  // writable calendar / task list Google shows a plain label instead of a dropdown,
  // in which case there's nothing to read or set.
  function findCalendarCombo(root) {
    const panel = root.querySelector('[role="tabpanel"][data-tab-type="1"]') || root;
    return panel.querySelector('[role="combobox"][aria-label="Calendar"]');
  }

  function findTaskListCombo(root) {
    return root.querySelector('[role="combobox"][aria-label="Task list"]');
  }

  // Comboboxes either point at their listbox via aria-controls or sit next to it in
  // the same wrapper (the listbox's label differs, e.g. "List of calendars").
  function findListbox(combo) {
    const id = combo.getAttribute('aria-controls');
    const byId = id && document.getElementById(id);
    if (byId) return byId;
    let el = combo.parentElement;
    for (let i = 0; i < 4 && el; i += 1, el = el.parentElement) {
      const lb = el.querySelector('[role="listbox"]');
      if (lb) return lb;
    }
    return null;
  }

  function readComboValue(combo) {
    const option = combo && findListbox(combo)?.querySelector('[role="option"][aria-selected="true"]');
    if (!option) return null;
    return { value: option.getAttribute('data-value'), label: option.textContent.trim() };
  }

  // Clicking an option works even while the listbox is closed or its row collapsed.
  // Returns whether the value actually changed.
  function setComboValue(combo, wanted) {
    const options = Array.from(findListbox(combo)?.querySelectorAll('[role="option"]') || []);
    const option =
      options.find((o) => wanted.value && o.getAttribute('data-value') === wanted.value) ||
      options.find((o) => o.textContent.trim() === wanted.label);
    if (!option) {
      log('remembered option not found:', wanted);
      return false;
    }
    if (option.getAttribute('aria-selected') === 'true') return false;
    option.click();
    return true;
  }

  // --- Draft block ---
  // Google's draft has no distinguishing attribute (data-dragsource-type differs per
  // view), so any event chip that wasn't on the grid while no create dialog was open
  // and no drag was in progress is treated as the draft.
  const CHIP_SELECTOR = '[data-eventchip]';
  const knownChips = new WeakSet();
  let dragging = false;

  function trackKnownChips() {
    if (dragging || findCreateDialog()) return;
    document.querySelectorAll(CHIP_SELECTOR).forEach((chip) => knownChips.add(chip));
  }

  const findDraftChips = () =>
    Array.from(document.querySelectorAll(CHIP_SELECTOR)).filter((c) => !knownChips.has(c) && isVisible(c));

  // The colored element is the chip itself in Day/Week views and an inner
  // [data-stacked-layout-chip] in Month view; either way it carries an inline
  // background-color. Appointment drafts have none (their stripes come from classes),
  // so fall back to the first descendant with a visible computed background.
  function paintedElement(chip) {
    return [chip, ...chip.querySelectorAll('*')].find((el) => el.style.backgroundColor) || null;
  }

  function readDraftColor() {
    const chip = findDraftChips()[0];
    if (!chip) return null;
    const painted = paintedElement(chip);
    if (painted) return painted.style.backgroundColor;
    const filled = Array.from(chip.querySelectorAll('*')).find(
      (el) => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'
    );
    return filled ? getComputedStyle(filled).backgroundColor : null;
  }

  function paintDraftChips() {
    const { type, draftColors } = loadLastCreated();
    const color = type && draftColors?.[type];
    if (!color) return;
    findDraftChips().forEach((chip) => {
      const painted = paintedElement(chip) || chip;
      if (painted.style.backgroundColor !== color) painted.style.backgroundColor = color;
      if (painted === chip) chip.style.borderColor = color;
    });
  }

  function recordCreation(saveButton) {
    const dialog = findCreateDialog();
    if (dialog && (!saveButton || dialog.contains(saveButton))) {
      const type = selectedDialogType(dialog);
      if (!type) return;
      const update = { type };
      if (type === 'event') update.calendar = readComboValue(findCalendarCombo(dialog)) || undefined;
      if (type === 'task') update.taskList = readComboValue(findTaskListCombo(dialog)) || undefined;
      const color = readDraftColor();
      if (color) update.draftColors = { ...loadLastCreated().draftColors, [type]: color };
      saveLastCreated(update);
    } else if (NEW_EVENT_EDIT_RE.test(location.pathname)) {
      const calendar = readComboValue(document.querySelector('[role="combobox"][aria-label="Calendar"]'));
      saveLastCreated(calendar ? { type: 'event', calendar } : { type: 'event' });
    } else if (NEW_APPOINTMENT_RE.test(location.pathname)) {
      saveLastCreated({ type: 'appointment' });
    }
  }

  // Opens the quick dialog (or the appointment page) for a type via the Create menu's
  // items, which work when clicked directly even while the menu is closed.
  function openCreateFor(type) {
    const eventItem = document.querySelector(`[role="menuitem"][data-key="${MENU_KEYS.event}"]`);
    const menu = eventItem?.closest('[role="menu"]');
    if (!menu) return false;
    const item =
      type === 'appointment'
        ? Array.from(menu.querySelectorAll('[role="menuitem"]')).find((i) => !i.hasAttribute('data-key'))
        : menu.querySelector(`[role="menuitem"][data-key="${MENU_KEYS[type]}"]`);
    if (!item) return false;
    item.click();
    return true;
  }

  let explicitChoiceUntil = 0;
  let pendingEventEditUntil = 0;
  // { dialog, tabDone, calendarDone, listDone, preconfigured, userEdited }
  let dialogSession = null;
  // { preconfigured, userEdited } for the full event-edit page opened with 'c'.
  let eventEditSession = null;

  // Runs on every DOM mutation pass: pre-configures each newly opened quick dialog
  // once, and the full event-edit page when it was opened with 'c'.
  function applyLastCreated() {
    const last = loadLastCreated();
    const dialog = findCreateDialog();
    if (!dialog) {
      dialogSession = null;
    } else {
      if (!dialogSession || dialogSession.dialog !== dialog) {
        dialogSession = {
          dialog,
          tabDone: false,
          calendarDone: false,
          listDone: false,
          preconfigured: false,
          userEdited: false,
        };
        // A Create menu item the user picked themselves wins over the remembered type.
        if (Date.now() < explicitChoiceUntil) dialogSession.tabDone = true;
        explicitChoiceUntil = 0;
      }
      const s = dialogSession;
      if (!s.tabDone) {
        s.tabDone = true;
        const tab = last.type && dialog.querySelector(`#${TAB_IDS[last.type]}`);
        if (tab && tab.getAttribute('aria-selected') !== 'true') {
          tab.click();
          s.preconfigured = true;
        }
      }
      if (!s.calendarDone && last.calendar) {
        const combo = findCalendarCombo(dialog);
        if (combo) {
          s.calendarDone = true;
          if (setComboValue(combo, last.calendar)) s.preconfigured = true;
        }
      }
      if (!s.listDone && last.taskList) {
        const combo = findTaskListCombo(dialog);
        if (combo) {
          s.listDone = true;
          if (setComboValue(combo, last.taskList)) s.preconfigured = true;
        }
      }
    }

    if (!NEW_EVENT_EDIT_RE.test(location.pathname)) eventEditSession = null;
    if (pendingEventEditUntil && NEW_EVENT_EDIT_RE.test(location.pathname)) {
      if (Date.now() > pendingEventEditUntil) {
        pendingEventEditUntil = 0;
      } else {
        const combo = document.querySelector('[role="combobox"][aria-label="Calendar"]');
        if (combo) {
          pendingEventEditUntil = 0;
          const changed = !!last.calendar && setComboValue(combo, last.calendar);
          eventEditSession = { preconfigured: changed, userEdited: false };
        }
      }
    }
  }

  // --- Discard prompt ---
  // Google treats the script's own preselection as an edit, so closing an untouched
  // form (X, Esc or clicking outside) would ask "Discard unsaved changes?". When
  // the script changed something and the user hasn't edited anything since, that
  // prompt is confirmed automatically. Any real input, change, pick (tab, option,
  // checkbox, date...) or drag of the draft block counts as a user edit, and then
  // Google's prompt is left alone.
  const CLOSE_BUTTON_SELECTOR = 'button[aria-label="Close"]';
  // Clicks that pick something. Focusing a field or opening a section (e.g. "Add
  // guests") isn't an edit; typing into it fires 'input'.
  const PICK_SELECTOR =
    '[role="tab"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="checkbox"], [role="switch"], [role="radio"], [role="gridcell"], [data-grid-cell], [aria-checked], input[type="checkbox"]';
  const DISCARD_BUTTON_SELECTOR = '[role="alertdialog"] button[data-mdc-dialog-action="ok"]';
  const DISCARD_WAIT_MS = 1000;

  const activeFormSession = () => dialogSession || eventEditSession;

  function markUserEdited() {
    const s = activeFormSession();
    if (s && !s.userEdited) {
      s.userEdited = true;
      log('form edited by user');
    }
  }

  // Polls briefly after a close attempt, since the prompt may be shown by toggling
  // an existing element rather than inserting one (not caught by the observer).
  function autoDiscardAfterClose() {
    const s = activeFormSession();
    if (!s || !s.preconfigured || s.userEdited) return;
    const deadline = Date.now() + DISCARD_WAIT_MS;
    const check = () => {
      if (s !== activeFormSession() || s.userEdited) return;
      const discard = Array.from(document.querySelectorAll(DISCARD_BUTTON_SELECTOR)).find(isVisible);
      if (discard) {
        log('auto-discarding prompt for untouched pre-configured form');
        discard.click();
      } else if (Date.now() < deadline) {
        setTimeout(check, 30);
      }
    };
    setTimeout(check, 0);
  }

  window.addEventListener('input', (e) => e.isTrusted && markUserEdited(), true);
  window.addEventListener('change', (e) => e.isTrusted && markUserEdited(), true);

  window.addEventListener(
    'mousedown',
    (e) => {
      if (!e.isTrusted || !(e.target instanceof Element) || !activeFormSession()) return;
      const target = e.target;
      if (target.closest('[role="alertdialog"]')) return;
      if (target.closest(CLOSE_BUTTON_SELECTOR)) return;
      const dialog = dialogSession?.dialog;
      if (dialog && !dialog.contains(target)) {
        // Dragging the draft moves / resizes it; any other click outside closes.
        if (target.closest(CHIP_SELECTOR) && !knownChips.has(target.closest(CHIP_SELECTOR))) markUserEdited();
        else autoDiscardAfterClose();
        return;
      }
      if (target.closest(PICK_SELECTOR)) markUserEdited();
    },
    true
  );

  window.addEventListener(
    'click',
    (e) => {
      if (e.isTrusted && e.target instanceof Element && e.target.closest(CLOSE_BUTTON_SELECTOR)) {
        autoDiscardAfterClose();
      }
    },
    true
  );

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.isTrusted && e.key === 'Escape') autoDiscardAfterClose();
    },
    true
  );

  document.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const save = target.closest(SAVE_BUTTON_SELECTOR);
      if (save) {
        recordCreation(save);
        return;
      }

      if (target.closest('[role="menuitem"]')?.closest('[role="menu"]')?.querySelector(`[data-key="${MENU_KEYS.event}"]`)) {
        explicitChoiceUntil = Date.now() + EXPLICIT_CHOICE_MS;
        return;
      }

      if (target.closest(CREATE_BUTTON_SELECTOR) && !e.shiftKey) {
        const { type } = loadLastCreated();
        if (type && openCreateFor(type)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    true
  );

  // Every chip on the grid when a drag starts is a real one; anything appearing after
  // is the draft. Google may rewrite the draft's inline style as it resizes, so it's
  // repainted on every move. Listening on window (capture) because Google stops
  // mouseup at the window, so it never reaches document.
  window.addEventListener(
    'mousedown',
    (e) => {
      if (!e.isTrusted || e.button !== 0 || !(e.target instanceof Element)) return;
      if (!e.target.closest('[role="main"]') || e.target.closest(`${CHIP_SELECTOR}, [role="dialog"]`)) return;
      document.querySelectorAll(CHIP_SELECTOR).forEach((chip) => knownChips.add(chip));
      dragging = true;
    },
    true
  );

  let paintScheduled = false;
  window.addEventListener(
    'mousemove',
    () => {
      if (!dragging || paintScheduled) return;
      paintScheduled = true;
      requestAnimationFrame(() => {
        paintScheduled = false;
        if (dragging) paintDraftChips();
      });
    },
    true
  );

  const endDrag = () => (dragging = false);
  window.addEventListener('mouseup', endDrag, true);
  window.addEventListener('pointerup', endDrag, true);

  function refresh() {
    highlight();
    if (dragging) paintDraftChips();
    else trackKnownChips();
    applyLastCreated();
  }

  let scheduled = false;
  function scheduleHighlight(reason) {
    if (scheduled) return;
    scheduled = true;
    log('scheduling highlight pass, reason:', reason);
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
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

  // Cmd/Ctrl+S saves the quick dialog or the full edit / appointment page, and Enter
  // in the quick dialog's title saves it too, like clicking Save. 'c' natively opens
  // the full event-edit page; for Tasks / Appointment schedules open those instead.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.isTrusted || e.altKey || e.shiftKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        recordCreation(null);
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter') {
        const dialog = findCreateDialog();
        if (dialog && e.target.tagName === 'INPUT' && dialog.contains(e.target)) {
          const save = Array.from(dialog.querySelectorAll(SAVE_BUTTON_SELECTOR)).find(isVisible);
          if (save) recordCreation(save);
        }
        return;
      }
      if (e.key !== 'c' || isTypingInEditable(e) || findCreateDialog()) return;
      const { type } = loadLastCreated();
      if (type === 'task' || type === 'appointment') {
        if (openCreateFor(type)) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else {
        pendingEventEditUntil = Date.now() + PENDING_EVENT_EDIT_MS;
      }
    },
    true
  );

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
