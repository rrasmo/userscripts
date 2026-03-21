// ==UserScript==
// @name         Jira Issue Fields Hover White
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Replace gray hover background on issue field content with white
// @match        https://*.atlassian.net/jira/*
// @match        https://*.atlassian.net/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const style = document.createElement('style');
  style.id = 'jira-hover-white-style';
  style.textContent = `
    /* Override Jira's default gray hover on issue field content */
    ._irr314ae:hover {
      background: white !important;
    }
  `;

  function injectStyle() {
    if (!document.getElementById(style.id)) {
      (document.head || document.documentElement).appendChild(style);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyle);
  } else {
    injectStyle();
  }

  /* Re-inject on SPA navigation (Jira is a single-page app) */
  const observer = new MutationObserver(() => {
    if (!document.getElementById(style.id) && (document.head || document.documentElement)) {
      (document.head || document.documentElement).appendChild(style);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
