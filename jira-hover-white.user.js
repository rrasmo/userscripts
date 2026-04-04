// ==UserScript==
// @name         Jira Issue Fields Hover White
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Replace gray hover background on issue field content with white
// @match        https://*.atlassian.net/jira/*
// @match        https://*.atlassian.net/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function applyStyle(el) {
    el.style.setProperty('background', 'white', 'important');
    el.addEventListener('mouseover', () => el.style.setProperty('background', 'white', 'important'));
  }

  function findAndStyle() {
    const btn = document.querySelector('button[aria-label="Edit Description, edit"]');
    if (btn && btn.nextElementSibling) {
      applyStyle(btn.nextElementSibling);
    }
  }

  const observer = new MutationObserver(findAndStyle);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', findAndStyle);
  } else {
    findAndStyle();
  }
})();
