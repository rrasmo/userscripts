// ==UserScript==
// @name         Jira Hide Agents & Apps Sections
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hides the Agents and Apps sections on Jira work items
// @match        https://*.atlassian.net/jira/*
// @match        https://*.atlassian.net/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function hideSections() {
    const agentsContainer = document.querySelector('[data-testid="issue-ai-agent-sessions.ui.agent-panel.title-container"]');
    if (agentsContainer?.parentElement) {
      agentsContainer.parentElement.style.display = 'none';
    }

    const appsContainer = document.querySelector('[data-testid="issue-view-layout-templates-views.ui.context.visible-hidden.ui.ecosystem-context-group.container.automation-issue-audit-log-panel"]');
    if (appsContainer?.parentElement?.parentElement) {
      appsContainer.parentElement.parentElement.style.display = 'none';
    }
  }

  new MutationObserver(hideSections).observe(document.documentElement, { childList: true, subtree: true });

  hideSections();
})();
