# PreflightSim Lite Implementation Plan

**Goal:** Deliver a deploy-ready Cloudflare + GitHub Actions Solidity compiler and stateful single-chain fork simulator accessible to ChatGPT web agents and direct REST clients.

## Task 1 — Repository and shared protocol

Create the npm workspace, TypeScript/Vitest tooling, request/result schemas, chain registry, action allowlist, and no-broadcast validation.

Acceptance: schema tests reject unknown chains, RPC URLs, signing material, and unsupported actions.

## Task 2 — Cloudflare Worker API

Implement bearer auth, R2 job storage, upload URLs, public job creation/status/result endpoints, runner endpoints, GitHub workflow dispatch, and agent job URL generation.

Acceptance: Worker unit tests cover auth, job lifecycle, ownership, dispatch failure, upload limits, and runner authorization.

## Task 3 — Trusted GitHub Actions runner

Implement project materialization, exact solc loading, OpenZeppelin extraction, compilation, Ganache fork startup, structured actions, assertions, and report generation.

Acceptance: a fixture token/staking/strategy/vault system deploys, configures, deposits, harvests, and withdraws in one preserved local simulation.

## Task 4 — Pages UI

Implement GitHub/inline project submission, workflow editor, polling, status/result display, report download, API-key storage, and privacy page.

Acceptance: production build succeeds and browser API client tests pass.

## Task 5 — Browser-agent and REST interface

Produce semantic agent submission/status pages, form-compatible REST requests, a plain API reference, and setup documentation for bearer authentication.

Acceptance: browser-agent pages never place keys in URLs, REST and form requests share validation, and no OpenAPI or OpenAI API dependency remains.

## Task 6 — CI/CD and release package

Add simulation and deployment workflows, Wrangler configs, Cloudflare/GitHub secret documentation, smoke tests, and a downloadable source ZIP.

Acceptance: all tests, typechecks, builds, and local runner fixture pass.
