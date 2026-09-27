<!--M:ai-review-independence:b1474987c762a13890691afbd5e5448709a94d0c77f9cd4f3130a298b53b8691-->
### `ai-review-independence`
Trigger: Use when assigning or evaluating multiple browser-agent audit lanes whose independence, clean-room visibility, or correlated model risk matters

## Objective

Classify reviewer independence honestly and preserve clean-room separation.

## Review Contract

- Record product surface and model, platform session ID when exposed or `NOT_EXPOSED_BY_AUTOMATION_API`, campaign-generated stable session ID, prompt digest, prior-material visibility, and independence classification.
- Keep the first four analytical lanes blind to prior findings until their sealed submission is accepted.
- Describe same-family sessions as isolated correlated AI reviews.
- Preserve concrete disagreements and route them to the adversarial lane and final coordinator.


## Required Output

A sealed lane manifest plus an independence statement bound to the exact source commit.
