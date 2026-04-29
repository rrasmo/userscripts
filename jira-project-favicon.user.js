// ==UserScript==
// @name         Jira Project Favicon
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Changes the favicon to the current Jira project's icon
// @match        https://*.atlassian.net/jira/*
// @match        https://*.atlassian.net/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  let currentProjectKey = null;

  const log = (...args) => console.log('[jira-project-favicon]', ...args);

  function extractProjectKey() {
    const path = location.pathname;
    log('extractProjectKey path:', path);
    let match = path.match(/\/jira\/.+?\/projects\/([A-Z][A-Z0-9_]*)/i);
    if (match) return match[1].toUpperCase();
    // /browse/KEY-123 (issue view)
    match = path.match(/\/browse\/([A-Z][A-Z0-9_]*?)-\d+/i);
    if (match) return match[1].toUpperCase();
    return null;
  }

  function setFavicon(url) {
    const existing = [...document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon']")];
    log('removing existing favicons:', existing.map(el => el.href));
    existing.forEach(el => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = url;
    document.head.appendChild(link);
    log('favicon set to:', url);
  }

  async function updateFavicon() {
    const projectKey = extractProjectKey();
    log('updateFavicon projectKey:', projectKey, '| currentProjectKey:', currentProjectKey);
    if (!projectKey) { log('no project key found, skipping'); return; }
    if (projectKey === currentProjectKey) { log('same project key, skipping'); return; }
    currentProjectKey = projectKey;

    try {
      const url = `/rest/api/3/project/${projectKey}`;
      log('fetching:', url);
      const res = await fetch(url);
      log('response status:', res.status);
      if (!res.ok) { log('fetch failed'); return; }
      const data = await res.json();
      log('avatarUrls:', data.avatarUrls);
      const iconUrl = data.avatarUrls?.['32x32'] || data.avatarUrls?.['48x48'] || data.avatarUrls?.['16x16'];
      if (iconUrl) setFavicon(iconUrl);
      else log('no iconUrl found in avatarUrls');
    } catch (e) { log('error:', e); }
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      log('URL changed:', lastUrl, '->', location.href);
      lastUrl = location.href;
      updateFavicon();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  log('script loaded, initial URL:', location.href);
  updateFavicon();
})();
