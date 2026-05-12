# Userscripts

Miscellaneous browser userscripts. Install with [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey / Greasemonkey).

## Requirements

- A userscript manager: [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari, Edge)

## Installation

1. Install Tampermonkey from your browser’s extension store.
2. Open a `.user.js` file in this repo.
3. Tampermonkey will detect the script and offer to install it. Confirm to add it.

To update: re-open the script file and install again when you pull changes.

## Scripts


| Script                            | Description                                                                                                             | Runs on                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Confluence Sidebar TOC**        | Right sidebar table of contents for Confluence pages. Shows headings, scroll spy, and works on wide and narrow screens. | `https://*.atlassian.net/wiki/`*                                     |
| **Jira Shortcuts**                | **Cmd+Enter** to submit the Create Issue dialog; **Cmd+Opt+O** to open Notifications.                                   | `https://*.atlassian.net/jira/`*, `https://*.atlassian.net/browse/`* |
| **Jira Issue Fields Hover White** | Replaces the default gray hover background on issue field content with white.                                           | `https://*.atlassian.net/jira/`*, `https://*.atlassian.net/browse/`* |
| **Jira Project Favicon**          | Changes the browser favicon to the current Jira project's icon.                                                         | `https://*.atlassian.net/jira/`*, `https://*.atlassian.net/browse/`* |
| **Jira Hide Agents & Apps**       | Hides the Agents and Apps sections on Jira work items.                                                                  | `https://*.atlassian.net/jira/`*, `https://*.atlassian.net/browse/`* |


