# Original Phase-0 Browser Wake v2

v2 preserves the isolated original Phase-0 browser wake logic from v1 and applies one compatibility repair only:

- GitHub-hosted Chrome runs headful under Xvfb (`BROWSER_HEADLESS=false` and `xvfb-run`).

This is the historical compatibility fix from Contract-Automation commit `491d9d57350cd4732bf9c37e9f84d0d871d47398`, which addressed ChatGPT browser-challenge behavior seen with headless Chrome.

No rolling session cache, project/routine logic, reviewer repair, chat creation orchestration, reasoning slider automation, or later browser recovery stack is included.
