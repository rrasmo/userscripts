// ==UserScript==
// @name         Google Sheets Dismiss Pre-built Tables Popup
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-dismisses the "Start with pre-built tables" popup in Google Sheets
// @match        https://docs.google.com/spreadsheets/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function dismissPopup() {
    const closeBtn = document.querySelector('.docs-tiled-sidebar-header [aria-label="Close"]');
    if (closeBtn) closeBtn.click();
  }

  new MutationObserver(dismissPopup).observe(document.documentElement, { childList: true, subtree: true });

  dismissPopup();
})();
