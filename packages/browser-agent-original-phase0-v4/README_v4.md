# Original Phase-0 Browser Wake v4

v4 preserves the isolated original wake, the v2 headful-Xvfb compatibility repair, and the v3 strict sent-message verification.

The only additional compatibility change is composer input: if the historical Playwright locator fill does not persist text in the current ChatGPT editor, the same focused composer receives browser-native keyboard text insertion. Delivery is still rejected unless the composer clears and an independent sent-message transition is observed.
