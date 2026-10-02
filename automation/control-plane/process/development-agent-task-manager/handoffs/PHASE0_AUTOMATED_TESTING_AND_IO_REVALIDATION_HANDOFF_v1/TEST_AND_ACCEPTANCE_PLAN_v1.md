# Test and Acceptance Plan v1

## A. Phase-0 testing-engine unit tests

### Inventory

- exact ABI function becomes inventory row;
- overloaded functions keep unique IDs/selectors;
- receive/fallback handled intentionally;
- internal/private functions not falsely marked external test surfaces;
- every Source Intelligence callable is accounted for;
- typed exclusion reason required.

### Argument generation

Cover:

- uint/int widths;
- address;
- bool;
- fixed/dynamic bytes;
- string;
- arrays;
- tuples;
- nested ABI types if supported;
- boundary-value seeds;
- payable/nonpayable value behavior.

### Actor generation

At least:

- deployer/admin candidate;
- ordinary EOA;
- second unrelated EOA;
- contract actor when harness supports it;
- known dependency addresses where safe.

### Coverage feedback

Tests must prove:

- corpus retains new-coverage inputs;
- equivalent no-new-coverage inputs can be discarded;
- fallback coverage mode activates when source coverage unavailable;
- run is marked invalid/blocked if no coverage feedback class is active.

### Stateful sequences

Prove:

- only real function calls are selected;
- sequence mutation changes functions/args/actors;
- same seed reproduces sequence;
- minimization shortens a failing sequence when possible.

## B. Artifact tests

For each canonical artifact:

- source SHA required;
- build identity required;
- schema version required;
- campaign/generation required;
- raw refs resolve;
- no path traversal;
- no source mismatch;
- no signal marked validated finding;
- summary counts equal underlying artifacts.

## C. Cross-phase tests

### Phase 0 → Phase 4

Synthetic machine signal must:

- appear in canonical Phase-0 signal artifact;
- appear by reference in Phase-4 machine-signal input;
- not require reviewer to copy raw trace;
- remain neutral until reviewer interpretation.

### Phase 5 → Phase 6

Positive test:

- candidate ID matches;
- campaign/source matches;
- reproduction type matches;
- expected machine observation matches;
- structural binding passes;
- boundary execution runs;
- Phase-6 row receives binding status/evidence;
- semantic harness assessment remains required.

Negative tests:

- wrong source SHA;
- wrong campaign ID;
- wrong candidate ID;
- wrong reproduction type;
- wrong expected observation;
- missing request;
- request path outside campaign;
- generic request with no v26 reproduction;
- request result present but target binding failed.

### Obligation lifecycle

Test:

- generated future obligation gets stable ID;
- due phase gets exact prefilled row;
- dropping row fails validation;
- carry updates same ledger ID;
- terminal disposition closes same ID;
- sealed receipt matches ledger;
- final index excludes properly closed obligations and carries still-open/blockers.

### Final evidence

Synthetic limitation introduced in an early phase must survive to:

- Phase-10 final index;
- Phase-10 residual limitations input;
- generated final report as applicable.

## D. Fresh-successor tests

For every fresh boundary:

- final report file may be absent before work;
- packet file may be absent before work;
- work form/schema must exist;
- wake uses controller-owned labels;
- wake never instructs reviewer to submit/create packet/report;
- predecessor sealed receipt exists;
- current assignment has exact derived paths.

## E. Authority-validator tests

The validator must fail on:

- title mismatch;
- section mismatch;
- contract/schema field mismatch;
- form/schema field mismatch;
- missing itemRequiredField;
- undeclared controller-generated output;
- derived selector referencing undeclared output;
- bookkeeping mapping referencing undeclared output;
- non-obligation field in obligation mapping;
- Phase-0 finalizer-required output missing from contract;
- substantive obligation routed to Phase 7;
- future obligation routed to phase without disposition surface;
- missing final-report required heading;
- duplicate controller input/output declarations.

## F. Required GitHub qualification

Before merge:

- repository Node test suite;
- static/lint checks;
- build checks;
- Lite structured regression;
- V7 Execution Infrastructure Qualification;
- paired Audit-Controller authority validation;
- mutable Anvil/runner checks where existing qualification invokes them.

After merge:

- rerun/confirm main-branch qualification;
- verify authority ZIP sync;
- inspect live authority folder;
- re-run static I/O matrix against the synchronized authority.

## G. Completion acceptance

All must be true:

- tests green;
- cross-phase audit clean;
- no unresolved interface mismatch;
- no hidden controller output;
- no dead required agent field;
- no downstream consumer missing producer;
- no machine execution claim without exact binding;
- no random bytes counted as real-function exploration;
- no Phase-0 machine signal promoted directly to finding.
