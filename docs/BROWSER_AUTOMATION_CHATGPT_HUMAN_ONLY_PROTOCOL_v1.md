# ChatGPT Browser Automation Human-Only Protocol v1

## ABSOLUTE INVARIANT — READ THIS BEFORE TOUCHING CHATGPT AUTOMATION

**ALL NON-HUMAN CHATGPT READ AND WRITE METHODS ARE BANNED.**

This is a hard repository invariant for every browser agent, wake agent, watchdog, repair agent, reviewer launcher, and development agent that interacts with `https://chatgpt.com`.

A change that violates this rule is invalid even if it appears to work.

## Why

Direct/non-human ChatGPT reads and writes trigger Cloudflare/browser defenses and have produced false failures after otherwise valid human-style UI interactions.

The known human-confirmed durable baseline is Home-Exit Playwright VERIFY4. Its visible composer/send interaction succeeded; backend/API verification later triggered Cloudflare. Therefore backend/API/hidden-DOM verification is not an acceptable success mechanism.

## Prohibited on chatgpt.com

Never use any of the following to read, write, verify, or infer ChatGPT conversation/project state:

- direct `/backend-api/*` requests;
- `fetch()`, XHR, request contexts, or HTTP clients against ChatGPT;
- Playwright request/response interception or network-body inspection;
- `page.evaluate()`, `evaluateAll()`, injected JavaScript, or DOM-triggered form submission;
- extracting ChatGPT content through `innerText`, `textContent`, `allTextContents`, `inputValue`, or equivalent hidden/programmatic content reads;
- setting ChatGPT input values with `fill()`, DOM assignment, synthetic form submission, or JavaScript clipboard APIs;
- backend/model/conversation health probes;
- using a backend response status as proof that a wake was delivered;
- using a hidden DOM/network read as watchdog productivity evidence.

## Allowed human-style interaction surface

Automation may only interact with the visible browser UI in ways a person can perform:

- navigate the visible browser to a ChatGPT URL;
- locate a **visible rendered control or rendered text target** only for the purpose of ordinary UI interaction or presence confirmation;
- hover and move the pointer to the visible target;
- mouse down/up normal clicks;
- sequential keyboard typing;
- normal keyboard shortcuts;
- OS/X clipboard copy/paste followed by normal keyboard paste/copy;
- inspect only whether an expected visible control/rendered marker is present; do not extract its content;
- use the browser's current URL as navigation state;
- preserve local browser session storage/cookies without reading ChatGPT conversation content.

Visible-target selectors are permitted only as the automation equivalent of a person locating a rendered control. They must never be used to scrape, summarize, hash, count, or otherwise read hidden/conversation content.

## Wake success boundary

A ChatGPT wake is successful only after:

1. the visible composer is focused through normal UI interaction;
2. the exact wake is pasted/typed through normal keyboard input;
3. the visible Send control is clicked normally, or Enter is pressed normally;
4. the resulting durable `https://chatgpt.com/c/...` URL exists;
5. the expected wake marker is visibly present as a rendered user message.

Do **not** perform a post-send backend probe or network-response check.

## Phase 1 Project invariant

Phase 1 must:

1. create or recover exactly one campaign Project using the visible ChatGPT UI;
2. use the normal sidebar Project overflow menu;
3. choose **Share Project**;
4. choose **Share Link**;
5. read the copied private Project URL from the OS clipboard;
6. create a fresh chat inside that Project;
7. send the exact controller-generated Phase 1 wake through normal pointer/keyboard interaction;
8. persist both the Project URL and durable chat URL in the campaign browser registration.

Phase 1 is not complete without the persisted Project URL.

## Phase 2+ / replacement invariant

Never create another Project for the same campaign.

Open the exact persisted Phase 1 Project URL through the browser, create a new chat inside that Project when a replacement/successor chat is required, and use the human-only wake path.

## Watchdog invariant

The audit watchdog must not scrape ChatGPT conversation content.

Canonical Audit-Controller state is the machine-readable source of audit progress. ChatGPT checks are limited to coarse visible UI readiness such as whether the rendered composer is available or the rendered Stop control is visible. Pokes/replacement wakes use the same human-only UI write path.

## Enforcement

Live ChatGPT automation must have regression tests that reject prohibited patterns from the active driver. If a future UI change requires a new interaction, repair the visible human interaction path. Do not reintroduce backend/API/hidden-DOM fallbacks.
