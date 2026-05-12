// ==UserScript==
// @name         Gmail Filter Shortcut
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Press 't' to open "Filter messages like this" for the open email (only when a message is open, never in input fields)
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
    // const moreBtn = document.querySelector('[aria-label="More message options"]');
    // if (moreBtn) return true;
    const div = document.querySelector('.cgjhk');
    if (div) return true;
    // Fallback: thread view often has a specific panel or URL hash with thread id
    const threadPanel = document.querySelector('[role="main"] [data-message-id], [role="main"] .h7');
    return !!threadPanel;
  }

  function openFilterLikeThis() {
    console.log('opening filter like this');
    // "Filter messages like this" lives under the "More" (⋮) dropdown
    const moreBtn = document.querySelector('[aria-label="More message options"]');
    if (!moreBtn) return false;
    console.log('more button found');
    moreBtn.click();

    // Wait for menu to render, then click "Filter messages like this"
    setTimeout(() => {
      const filterItem = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], div[role="button"]'))
        .find(el => {
          const text = (el.textContent || el.innerText || '').trim();
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          return /filter messages like (this|these)/i.test(text) || /filter messages like (this|these)/.test(label);
        });
      if (filterItem) {
        console.log('filter item found');
        filterItem.click();
        // First Esc closes the search options panel; second Esc blurs the search box
        const dispatchEsc = () => document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true,
        }));
        setTimeout(() => { dispatchEsc(); setTimeout(dispatchEsc, 100); }, 100);
      }
    }, 150);

    return true;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      console.log('t key pressed');
      if (isTypingInEditable(e)) return;
      console.log('not typing in editable');
      if (!isMessageOpen()) return;
      console.log('is message open');
      if (openFilterLikeThis()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
