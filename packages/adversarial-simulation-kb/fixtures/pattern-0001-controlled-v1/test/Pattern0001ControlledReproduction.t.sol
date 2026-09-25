// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ControlledLendingFixture} from "../src/ControlledLendingFixture.sol";

contract ControlledActor {
    ControlledLendingFixture internal immutable fixture;

    constructor(ControlledLendingFixture fixture_) {
        fixture = fixture_;
    }

    function open(uint256 collateralAmount, uint256 debtAmount) external {
        fixture.openPosition(collateralAmount, debtAmount);
    }

    function reduce(uint256 amount) external {
        fixture.reduceCollateral(amount);
    }

    function liquidate(address violator) external {
        fixture.liquidate(violator);
    }
}

contract Pattern0001ControlledReproductionTest {
    function test_K12_controlled_reproduction_health20000_to14000_net100_to110_protocol1000_to890() public {
        ControlledLendingFixture fixture = new ControlledLendingFixture(1000);
        ControlledActor violator = new ControlledActor(fixture);
        ControlledActor liquidator = new ControlledActor(fixture);

        violator.open(200, 100);

        uint256 initialHealthBps = fixture.healthBps(address(violator));
        int256 initialAttackerNetValue = fixture.attackerNetValue(address(violator), address(liquidator));
        uint256 initialProtocolLiquidity = fixture.protocolLiquidity();

        require(initialHealthBps == 20_000, "INITIAL_HEALTH");
        require(initialAttackerNetValue == 100, "INITIAL_NET_VALUE");
        require(initialProtocolLiquidity == 1000, "INITIAL_PROTOCOL_LIQUIDITY");

        // RED against the protected fixture: this call must revert there.
        // GREEN against the deliberately vulnerable controlled fixture: it commits health < 150%.
        violator.reduce(60);

        uint256 postReductionHealthBps = fixture.healthBps(address(violator));
        require(postReductionHealthBps == 14_000, "POST_REDUCTION_HEALTH");
        require(postReductionHealthBps < fixture.minimumHealthBps(), "UNHEALTHY_STATE_NOT_COMMITTED");

        liquidator.liquidate(address(violator));

        int256 finalAttackerNetValue = fixture.attackerNetValue(address(violator), address(liquidator));
        uint256 finalProtocolLiquidity = fixture.protocolLiquidity();

        require(finalAttackerNetValue == 110, "FINAL_NET_VALUE");
        require(finalAttackerNetValue > initialAttackerNetValue, "NO_ATTACKER_GAIN");
        require(finalProtocolLiquidity == 890, "FINAL_PROTOCOL_LIQUIDITY");
        require(finalProtocolLiquidity < initialProtocolLiquidity, "NO_PROTOCOL_EXTRACTION");
    }
}
