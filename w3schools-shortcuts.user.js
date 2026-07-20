// ==UserScript==
// @name         W3Schools Next/Previous Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Press D to go to the Next page, S to go to the Previous page
// @match        https://www.w3schools.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=w3schools.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function goNext(e) {
    if (e.key !== 'd' && e.key !== 'D') return false;
    const nextLink = document.querySelector('.nextprev a.w3-right');
    if (!nextLink) return false;
    console.log('Going to Next page');
    nextLink.click();
    return true;
  }

  function goPrevious(e) {
    if (e.key !== 's' && e.key !== 'S') return false;
    const prevLink = document.querySelector('.nextprev a.w3-left');
    if (!prevLink) return false;
    console.log('Going to Previous page');
    prevLink.click();
    return true;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      const handlers = [goNext, goPrevious];
      const handled = handlers.some((handler) => handler(e));
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
})();
