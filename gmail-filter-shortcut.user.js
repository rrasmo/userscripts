// ==UserScript==
// @name         Gmail Filter Shortcut
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Press 't' to search for all emails from the sender of the open email; 'g p/o/u/f' to jump to Promotions/Social/Updates/Forums; Cmd+U to click Unsubscribe on the open email; Cmd+. to toggle the left sidebar (never in input fields)
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

  function findUnsubscribeButton() {
    // The "Unsubscribe" pill sits in the message header next to the sender name;
    // it's a leaf node (no child elements) so matching on trimmed text avoids
    // also matching ancestor containers that happen to contain the same text.
    const nodes = document.querySelectorAll('[role="main"] *');
    for (const el of nodes) {
      if (el.children.length) continue;
      if ((el.textContent || '').trim().toLowerCase() !== 'unsubscribe') continue;
      if (!isVisible(el)) continue;
      return el.closest('[role="button"]') || el;
    }
    return null;
  }

  function clickUnsubscribe() {
    const btn = findUnsubscribeButton();
    if (!btn) return false;
    simulateClick(btn);
    return true;
  }

  function findMainMenuButton() {
    // The hamburger icon that toggles the left sidebar has no visible text,
    // just an aria-label, and that label doesn't change between open/closed states.
    return document.querySelector('[aria-label="Main menu"]');
  }

  function toggleSidebar() {
    const btn = findMainMenuButton();
    if (!btn) return false;
    simulateClick(btn);
    return true;
  }

  // Second key of a 'g <key>' chord -> inbox category tab, mirroring Gmail's own 'g i' for Primary
  const CATEGORY_LABELS = {
    p: 'promotions',
    o: 'social',
    u: 'updates',
    f: 'forums',
  };

  function simulateClick(el) {
    // Gmail's UI is built on Closure's jsaction event delegation, which
    // ignores a bare el.click() — it needs a real pointer/mouse sequence.
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ctor(type, base));
    });
  }

  function isVisible(el) {
    // Gmail keeps the category tabs in the DOM even on non-Inbox views (Sent,
    // a single thread, etc.), just hidden, so presence alone isn't enough.
    return !!el.offsetParent;
  }

  function findCategoryTab(label) {
    const tabs = document.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      const text = (tab.textContent || '').trim().toLowerCase();
      if (text.includes(label) && isVisible(tab)) return tab;
    }
    return null;
  }

  function findInboxLink() {
    return document.querySelector('a[href*="#inbox"]');
  }

  function goToCategoryTab(label) {
    const existingTab = findCategoryTab(label);
    if (existingTab) {
      simulateClick(existingTab);
      return true;
    }

    // Category tabs only render on the Inbox view, so go there first, then
    // wait for the tab to appear before clicking it.
    const inboxLink = findInboxLink();
    if (!inboxLink) return false;
    inboxLink.click();

    const start = Date.now();
    const interval = setInterval(() => {
      const tab = findCategoryTab(label);
      if (tab) {
        clearInterval(interval);
        simulateClick(tab);
      } else if (Date.now() - start > 3000) {
        clearInterval(interval);
      }
    }, 100);
    return true;
  }

  let awaitingCategoryKey = false;
  let awaitingCategoryTimer = null;

  function resetAwaitingCategoryKey() {
    awaitingCategoryKey = false;
    clearTimeout(awaitingCategoryTimer);
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (isTypingInEditable(e)) return;

      if (e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'u') {
        if (isMessageOpen() && clickUnsubscribe()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (e.metaKey && !e.ctrlKey && !e.altKey && e.key === '.') {
        if (toggleSidebar()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (awaitingCategoryKey) {
        const label = CATEGORY_LABELS[e.key.toLowerCase()];
        resetAwaitingCategoryKey();
        if (label && goToCategoryTab(label)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        awaitingCategoryKey = true;
        awaitingCategoryTimer = setTimeout(resetAwaitingCategoryKey, 1000);
        return;
      }

      if (e.key !== 't' && e.key !== 'T') return;
      if (!isMessageOpen()) return;
      if (searchBySender()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
