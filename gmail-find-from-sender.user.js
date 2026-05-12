// ==UserScript==
// @name         Gmail Find From Sender
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hover over an inbox row to reveal a search icon in the sender column; click it to trigger "Find messages from" that sender
// @match        https://mail.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mail.google.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ATTR = 'data-gmffs-attached';
  const BTN_CLASS = 'gmffs-search-btn';

  function createSearchSvg() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z');
    svg.appendChild(path);
    return svg;
  }

  function createBtn() {
    const btn = document.createElement('div');
    btn.className = BTN_CLASS;
    btn.appendChild(createSearchSvg());
    btn.title = 'Find messages from this sender';
    Object.assign(btn.style, {
      position: 'absolute',
      right: '4px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '26px',
      height: '26px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#444746',
      borderRadius: '50%',
      background: 'transparent',
      zIndex: '10',
      flexShrink: '0',
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = '#e8eaed'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    return btn;
  }

  function findMessagesFrom(row) {
    const rect = row.getBoundingClientRect();
    const x = rect.left + 80;
    const y = rect.top + rect.height / 2;

    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 2,
    }));

    // Poll briefly for the context menu item rather than a fixed delay,
    // since menu render time varies.
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const item = Array.from(document.querySelectorAll('[role="menuitem"] div'))
        .find(el => /find emails from/i.test(el.textContent));
      if (item) {
        clearInterval(poll);
        item.click();
      } else if (attempts >= 20) {
        clearInterval(poll);
      }
    }, 50);
  }

  function attachToRow(row) {
    if (row.hasAttribute(ATTR)) return;
    row.setAttribute(ATTR, '1');

    const senderCell = row.querySelector('td.yX');
    if (!senderCell) return;

    if (getComputedStyle(senderCell).position === 'static') {
      senderCell.style.position = 'relative';
    }

    const btn = createBtn();

    row.addEventListener('mouseenter', () => {
      if (!senderCell.contains(btn)) senderCell.appendChild(btn);
    });

    row.addEventListener('mouseleave', (e) => {
      if (btn.contains(e.relatedTarget)) return;
      btn.remove();
    });

    btn.addEventListener('mouseleave', (e) => {
      if (!row.contains(e.relatedTarget)) btn.remove();
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      btn.remove();
      findMessagesFrom(row);
    });
  }

  function attachToAllRows() {
    document.querySelectorAll('tr.zA').forEach(attachToRow);
  }

  let rafPending = false;
  const observer = new MutationObserver(() => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      attachToAllRows();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  attachToAllRows();
})();
