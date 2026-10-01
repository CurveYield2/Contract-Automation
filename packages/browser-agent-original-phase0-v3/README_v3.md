# Original Phase-0 Browser Wake v3

v3 keeps the isolated original Phase-0 browser wake and the v2 headful-Xvfb compatibility fix.

The only additional change is delivery verification. A wake is no longer considered sent merely because the custom text exists somewhere on the page. Success requires the composer to clear and an independent post-send signal: a newly visible sent-message turn, a message-count advance, or ChatGPT generation starting. Failed verification emits non-secret UI diagnostics and returns failure.

This version exists to eliminate the false-positive observed in v2 where the wake text remained in the composer and the workflow incorrectly returned posted=true.
