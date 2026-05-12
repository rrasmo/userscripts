// ==UserScript==
// @name         Jira Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Cmd+Enter to submit Create Issue; Cmd+Opt+O to open Notifications; Shift+Esc to dismiss Toast
// @match        https://*.atlassian.net/jira/*
// @match        https://*.atlassian.net/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function createIssue(e) {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return false;
    const createBtn = document.querySelector(
      '[data-testid="create-issue-dialog.footer.create-button"], ' +
      '[data-testid="issue-create.common.ui.footer.create-button"], ' +
      '[data-testid="issue-create.ui.modal.footer.create-button"]'
    );
    if (!createBtn) return false;
    console.log('Creating Issue');
    createBtn.click();
    return true;
  }

  function openNotifications(e) {
    if (!(e.key === 'o' || e.key === 'O' || e.key === 'ø') || !(e.metaKey || e.ctrlKey) || !e.altKey) return false;
    const notificationsBtn = document.querySelector(
      '[data-testid="atlassian-navigation--secondary-actions--notifications--menu-trigger"] button'
    );
    if (!notificationsBtn) return false;
    console.log('Opening Notifications');
    notificationsBtn.click();
    return true;
  }

  function dismissToast(e) {
    if (e.key !== 'Escape' || !e.shiftKey) return false;
    const dismissBtn = document.querySelector(
      '[data-testid="platform.ui.flags.common.ui.common-flag-v2-dismiss"]'
    );
    if (!dismissBtn) return false;
    console.log('Dismissing Toast');
    dismissBtn.click();
    return true;
  }

  document.addEventListener(
    'keydown',
    (e) => {
      const handlers = [createIssue, openNotifications, dismissToast];
      const handled = handlers.some((handler) => handler(e));
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
})();
