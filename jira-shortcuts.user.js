// ==UserScript==
// @name         Jira Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Cmd+Enter to submit Create Issue; Cmd+Opt+O to open Notifications
// @match        https://*.atlassian.net/jira/*
// @match        https://*.atlassian.net/browse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  document.addEventListener(
    'keydown',
    (e) => {
      console.log('Key pressed:', e.key);
      console.log('Meta key:', e.metaKey);
      console.log('Ctrl key:', e.ctrlKey);
      console.log('Alt key:', e.altKey);
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        console.log('Creating Issue');
        const createBtn = document.querySelector(
          '[data-testid="create-issue-dialog.footer.create-button"], ' +
          '[data-testid="issue-create.common.ui.footer.create-button"], ' +
          '[data-testid="issue-create.ui.modal.footer.create-button"]'
        );
        if (createBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          createBtn.click();
        }
      } else if (
        (e.key === 'o' || e.key === 'O' || e.key === 'ø') &&
        (e.metaKey || e.ctrlKey) &&
        e.altKey
      ) {
        console.log('Opening Notifications');
        const notificationsBtn = document.querySelector(
          '[data-testid="atlassian-navigation--secondary-actions--notifications--menu-trigger"] button'
        );
        if (notificationsBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          notificationsBtn.click();
        }
      }
    },
    true
  );
})();
