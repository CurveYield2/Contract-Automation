# PreflightSim job

<!-- preflightsim-job -->

```json
{
  "preflightsimJob": {
    "mode": "compile",
    "project": {
      "type": "inline",
      "files": {
        "Counter.sol": "pragma solidity 0.8.30; contract Counter { uint256 public value; }"
      }
    },
    "compilerVersion": "0.8.30",
    "optimizer": {
      "enabled": true,
      "runs": 200
    },
    "viaIR": false,
    "workflow": {
      "steps": []
    }
  }
}
```

Do not include private keys, seed phrases, RPC URLs, signed transactions, scripts, shell commands, or broadcast instructions.
