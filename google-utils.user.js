// ==UserScript==
// @name         Google Utils
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  'g' to show the top search bar (even when scrolled away), focus the search box and select its text, for a quick new search (never in input fields)
// @match        https://www.google.com/
// @match        https://www.google.com/?*
// @match        https://www.google.com/webhp*
// @match        https://www.google.com/search*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false;
  const LOG_PREFIX = '[Google Utils]';

  const log = (...args) => DEBUG && console.log(LOG_PREFIX, ...args);

  function isTypingInEditable(e) {
    const target = e.target;
    const tag = target.tagName && target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (target.isContentEditable) return true;
    if (target.getAttribute && target.getAttribute('role') === 'textbox') return true;
    return false;
  }

  function getSearchBox() {
    return document.querySelector('textarea[name="q"], input[name="q"]:not([type="hidden"])');
  }

  // On the results page the top bar is a position: fixed element that Google slides
  // out of view on scroll by setting a negative inline `top`. Found by walking up from
  // the search box to the nearest fixed/sticky ancestor, since Google's class names
  // change across deploys.
  function showTopBar(searchBox) {
    for (let el = searchBox.parentElement; el && el !== document.body; el = el.parentElement) {
      const position = getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        el.style.top = '0px';
        log('Top bar shown', el);
        return;
      }
    }
    log('No fixed top bar found (e.g. homepage)');
  }

  function focusSearch() {
    const searchBox = getSearchBox();
    if (!searchBox) {
      log('Search box not found');
      return false;
    }
    showTopBar(searchBox);
    searchBox.focus({ preventScroll: true });
    searchBox.select();
    return true;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (isTypingInEditable(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'g') return;
      if (focusSearch()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
