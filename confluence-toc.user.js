// ==UserScript==
// @name         Confluence Sidebar TOC
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Right sidebar table of contents for Confluence pages
// @match        https://*.atlassian.net/wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.com
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  const SIDEBAR_WIDTH = 260;
  const WIDE_BREAKPOINT = 1400;

  GM_addStyle(`
    /* Sidebar container - top is set dynamically via JS */
    #tm-toc-sidebar {
      position: fixed;
      // top: var(--tm-toc-top, 56px);
      top: 104px;
      right: 0;
      width: ${SIDEBAR_WIDTH}px;
      height: calc(100vh - var(--tm-toc-top, 56px));
      background: #fff;
      border-left: 1px solid #dfe1e6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      transition: none;
    }

    #tm-toc-trigger {
      display: none;
      position: fixed;
      top: var(--tm-toc-top, 56px);
      right: 0;
      width: 10px;
      height: calc(100vh - var(--tm-toc-top, 56px));
      z-index: 99;
    }

    /* Wide screens: always visible, push content */
    @media (min-width: ${WIDE_BREAKPOINT}px) {
      #tm-toc-sidebar {
        transform: translateX(0);
      }
      /* Prevent page content from going under the sidebar */
      html.tm-toc-active {
        margin-right: ${SIDEBAR_WIDTH}px;
      }
    }

    /* Narrow screens: hidden off-screen, slide in on hover */
    @media (max-width: ${WIDE_BREAKPOINT - 1}px) {
      #tm-toc-sidebar {
        transform: translateX(100%);
      }
      #tm-toc-sidebar.visible {
        transform: translateX(0);
      }
      #tm-toc-trigger {
        display: block;
      }
    }

    /* Inner content area */
    #tm-toc-inner {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }

    #tm-toc-header {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b778c;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #dfe1e6;
    }

    .tm-toc-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .tm-toc-list li {
      margin: 0;
      padding: 0;
    }
    .tm-toc-list a {
      display: block;
      padding: 5px 8px;
      color: #42526e;
      text-decoration: none;
      border-left: 2px solid transparent;
      line-height: 1.4;
      border-radius: 0 4px 4px 0;
      transition: none;
    }
    .tm-toc-list a:hover {
      color: #0052cc;
      border-left-color: #0052cc;
      background: #ebecf0;
    }
    .tm-toc-list a.active {
      color: #0052cc;
      border-left-color: #0052cc;
      font-weight: 600;
      background: #deebff;
    }
    .tm-toc-list a[data-level="1"] { padding-left: 8px; }
    .tm-toc-list a[data-level="2"] { padding-left: 8px; }
    .tm-toc-list a[data-level="3"] { padding-left: 24px; font-size: 12px; }
    .tm-toc-list a[data-level="4"] { padding-left: 40px; font-size: 12px; }
    .tm-toc-list a[data-level="5"] { padding-left: 56px; font-size: 11px; }
    .tm-toc-list a[data-level="6"] { padding-left: 72px; font-size: 11px; }

    #tm-toc-inner::-webkit-scrollbar { width: 4px; }
    #tm-toc-inner::-webkit-scrollbar-thumb { background: #c1c7d0; border-radius: 4px; }
  `);

  // Hover trigger zone for narrow screens
  const trigger = document.createElement('div');
  trigger.id = 'tm-toc-trigger';
  document.body.appendChild(trigger);

  // function detectHeaderHeight() {
  //   // Confluence Cloud has a site nav + a page toolbar (Edit, Share, etc.)
  //   const candidates = document.querySelectorAll(
  //     'nav[aria-label="Site"], #AksiteHeader, [data-testid="grid-topNav"], header[role="banner"], .aui-header, ' +
  //     '[data-testid="title-bar"], [data-testid="content-header-container"], #title-heading, .page-header-actions'
  //   );
  //   let maxBottom = 0;
  //   candidates.forEach((el) => {
  //     const bottom = el.getBoundingClientRect().bottom;
  //     if (bottom > maxBottom) maxBottom = bottom;
  //   });
  //   return maxBottom;
  // }

  function buildTOC() {
    const existing = document.getElementById('tm-toc-sidebar');
    if (existing) existing.remove();
    document.documentElement.classList.remove('tm-toc-active');

    // Set top offset based on actual header height
    // const topOffset = detectHeaderHeight();
    // document.documentElement.style.setProperty('--tm-toc-top', topOffset + 'px');

    const content = document.querySelector(
      '#content-body, [data-testid="renderer-wrapper"], .ak-renderer-document, #main-content'
    );
    if (!content) return;

    const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length < 2) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'tm-toc-sidebar';

    const inner = document.createElement('div');
    inner.id = 'tm-toc-inner';

    const header = document.createElement('div');
    header.id = 'tm-toc-header';
    header.textContent = 'Contents';

    const list = document.createElement('ul');
    list.className = 'tm-toc-list';

    headings.forEach((h, i) => {
      if (!h.id) h.id = 'tm-toc-heading-' + i;
      const level = parseInt(h.tagName[1]);
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      a.dataset.level = level;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
      li.appendChild(a);
      list.appendChild(li);
    });

    inner.appendChild(header);
    inner.appendChild(list);
    sidebar.appendChild(inner);
    document.body.appendChild(sidebar);
    document.documentElement.classList.add('tm-toc-active');

    // Narrow screen hover behavior
    trigger.addEventListener('mouseenter', () => sidebar.classList.add('visible'));
    sidebar.addEventListener('mouseleave', () => sidebar.classList.remove('visible'));

    // Highlight active heading on scroll
    const links = list.querySelectorAll('a');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.remove('active'));
            const active = list.querySelector(`a[href="#${CSS.escape(entry.target.id)}"]`);
            if (active) active.classList.add('active');
          }
        });
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0.1 }
    );
    headings.forEach((h) => observer.observe(h));
  }

  // SPA navigation watcher
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(buildTOC, 1500);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'complete') {
    setTimeout(buildTOC, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(buildTOC, 1500));
  }
})();
