// ==UserScript==
// @name         Gmail Filter Shortcut
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Press 't' to search for all emails from the sender of the open email (only when a message is open, never in input fields)
// @match        https://mail.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mail.google.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function isTypingInEditable(e) {
    const target = e.target;
    const tag = target.tagName && target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if (target.isContentEditable) return true;
    if (target.getAttribute && target.getAttribute('role') === 'textbox') return true;
    return false;
  }

  function isMessageOpen() {
    // Gmail shows the "More" (three-dots) toolbar only when a thread/message is open
    const div = document.querySelector('.cgjhk');
    if (div) return true;
    // Fallback: thread view often has a specific panel or URL hash with thread id
    const threadPanel = document.querySelector('[role="main"] [data-message-id], [role="main"] .h7');
    return !!threadPanel;
  }

  function getSenderEmail() {
    // Gmail renders the sender's name in a span carrying the real address
    // in an "email" attribute, e.g. <span email="temu@commerce.temuemail.com" class="gD" ...>
    // (.gD is specific to the "from" field, unlike recipient spans which use .g2)
    const candidates = document.querySelectorAll('[role="main"] span.gD[email]');
    if (!candidates.length) return null;
    // The last one on the page corresponds to the most recently opened/expanded message
    const el = candidates[candidates.length - 1];
    return el.getAttribute('email');
  }

  function searchBySender() {
    const email = getSenderEmail();
    if (!email) return false;
    location.hash = `search/from%3A${encodeURIComponent(email)}`;
    return true;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingInEditable(e)) return;
      if (!isMessageOpen()) return;
      if (searchBySender()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
