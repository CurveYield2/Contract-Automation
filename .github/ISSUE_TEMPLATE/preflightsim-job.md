---
name: PreflightSim job
description: Submit a trusted compile or fork-simulation request
labels: [preflightsim-job]
---

<!-- preflightsim-job -->

```json
{
  "preflightsimJob": {
    "mode": "compile",
    "project": {
      "type": "github",
      "repository": "OWNER/PUBLIC_REPOSITORY",
      "ref": "main"
    },
    "compilerVersion": "0.8.30",
    "optimizer": { "enabled": true, "runs": 200 },
    "viaIR": false,
    "workflow": { "steps": [] }
  }
}
```
