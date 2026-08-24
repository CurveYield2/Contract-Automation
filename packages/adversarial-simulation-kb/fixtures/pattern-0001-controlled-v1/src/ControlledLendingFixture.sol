// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract ControlledLendingFixture {
    struct Position {
        uint256 collateral;
        uint256 debt;
    }

    uint256 public constant minimumHealthBps = 15_000;
    mapping(address => Position) public positions;
    mapping(address => uint256) public liquidationPayout;
    uint256 public protocolLiquidity;

    constructor(uint256 initialProtocolLiquidity) {
        protocolLiquidity = initialProtocolLiquidity;
    }

    function openPosition(uint256 collateralAmount, uint256 debtAmount) external {
        require(collateralAmount > 0 && debtAmount > 0, "POSITION");
        require(collateralAmount * 10_000 / debtAmount >= minimumHealthBps, "INITIAL_SOLVENCY");
        positions[msg.sender] = Position({collateral: collateralAmount, debt: debtAmount});
    }

    function reduceCollateral(uint256 amount) external {
        Position storage position = positions[msg.sender];
        require(position.collateral >= amount, "COLLATERAL");
        uint256 remaining = position.collateral - amount;

        // Deliberately protected RED fixture. K12's exploit assertion must fail here.
        require(position.debt == 0 || remaining * 10_000 / position.debt >= minimumHealthBps, "SOLVENCY");
        position.collateral = remaining;
    }

    function healthBps(address account) public view returns (uint256) {
        Position memory position = positions[account];
        if (position.debt == 0) return type(uint256).max;
        return position.collateral * 10_000 / position.debt;
    }

    function liquidate(address violator) external {
        Position storage position = positions[violator];
        require(position.debt > 0, "NO_DEBT");
        require(healthBps(violator) < minimumHealthBps, "HEALTHY");

        uint256 payout = position.debt + position.debt / 10;
        require(protocolLiquidity >= payout, "LIQUIDITY");

        position.collateral = 0;
        position.debt = 0;
        protocolLiquidity -= payout;
        liquidationPayout[msg.sender] += payout;
    }

    function attackerNetValue(address violator, address liquidator) external view returns (int256) {
        Position memory position = positions[violator];
        return int256(position.collateral + liquidationPayout[liquidator]) - int256(position.debt);
    }
}
