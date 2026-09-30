# Phase0 qualified runner rebind v1

This temporary verification branch pairs with Audit-Controller branch repair/phase0-qualified-rebind-v1. The existing cross-repository regression workflow tests that exact matching controller candidate on the public execution plane.

Qualified runner: 061d5570f058a4019d990ae50edc3d25e7a20270.
Canonical qualification run: 36783414101, PASS including required live Phase6 and Phase7 sections.

Current state: the policy test requires the new binding while the admitted controller pin remains old. Obtain the expected failing test before modifying the pin. Then change only qualification binding fields and current synthetic test fixtures, rerun complete controller npm test/check through the same workflow, verify the cloned controller commit, and merge the exact tested controller head. This branch is a verification trigger; it must not be merged into main or become an additional control specification. Close with recorded disposition when controller rebind is complete.
