// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {FeeSettlementRouter} from "../../contracts/FeeSettlementRouter.sol";
import {FeeSettlementKeeper} from "../../contracts/FeeSettlementKeeper.sol";
import {PoolFeePolicyRegistry} from "../../contracts/PoolFeePolicyRegistry.sol";
import {HooksConfig} from "@balancer-labs/v3-interfaces/contracts/vault/VaultTypes.sol";

contract Cand001TokenV1 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "BAL");
        unchecked { balanceOf[msg.sender] -= amount; }
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount && balanceOf[from] >= amount, "ALLOW");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        unchecked { balanceOf[from] -= amount; }
        balanceOf[to] += amount;
        return true;
    }
}

contract Cand001Permit2V1 {
    function approve(address, address, uint160, uint48) external {}
}

contract Cand001LiquidityRouterV1 {
    address public immutable permit2;
    constructor(address permit2_) { permit2 = permit2_; }
    function getPermit2() external view returns (address) { return permit2; }
    function addLiquidityUnbalanced(address, uint256[] memory, uint256, bool, bytes memory)
        external pure returns (uint256) { revert("JOIN_SHOULD_NOT_BE_REACHED"); }
}

contract Cand001VaultV1 {
    address public immutable token;
    constructor(address token_) { token = token_; }

    function getPoolTokens(address) external view returns (address[] memory tokens) {
        tokens = new address[](1);
        tokens[0] = token;
    }

    function getHooksConfig(address) external pure returns (HooksConfig memory hooksConfig) {
        return hooksConfig;
    }
}

contract Cand001ProtocolFeesV1 {
    uint256 public creatorAmount;
    function setCreatorAmount(uint256 amount) external { creatorAmount = amount; }
    function collectAggregateFees(address) external {}
    function getProtocolFeeAmounts(address) external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](1);
    }
    function getPoolCreatorFeeAmounts(address) external view returns (uint256[] memory amounts) {
        amounts = new uint256[](1);
        amounts[0] = creatorAmount;
    }
    function withdrawProtocolFees(address, address) external {}
    function withdrawPoolCreatorFees(address, address) external {}
    function setPoolCreatorSwapFeePercentage(address, uint256) external {}
    function getPoolCreatorSwapFeePercentage(address) external pure returns (uint256) { return 0; }
    function setProtocolSwapFeePercentage(address, uint256) external {}
    function getPoolProtocolSwapFeeInfo(address) external pure returns (uint256, bool) { return (0, false); }
}

contract Cand001RegistryV1 {
    address public creatorController = address(0xC001);
    address public creatorPayoutReceiver = address(0xC002);

    function creatorControllerOf(address) external view returns (address) { return creatorController; }
    function creatorPayoutReceiverOf(address) external view returns (address) { return creatorPayoutReceiver; }
    function creatorPartnerRevenueReceiverOf(address) external pure returns (address) { return address(0); }
    function adminPartnerRevenueReceiverOf(address) external pure returns (address) { return address(0); }

    function getPartnerPoLConfig(address)
        external pure returns (PoolFeePolicyRegistry.PartnerPoLConfig memory cfg)
    {
        cfg = PoolFeePolicyRegistry.PartnerPoLConfig({enabled:false,targetPool:address(0)});
    }
}

contract Cand001AdminSplitterV1 {
    Cand001RegistryV1 public immutable registryContract;
    constructor(Cand001RegistryV1 registry_) { registryContract = registry_; }

    function registry() external view returns (Cand001RegistryV1) { return registryContract; }

    function quoteAdminAllocation(address, uint256[] calldata amounts)
        external pure
        returns (uint256[] memory a, uint256[] memory b, uint256[] memory c, uint256[] memory d)
    {
        a = new uint256[](amounts.length);
        b = new uint256[](amounts.length);
        c = new uint256[](amounts.length);
        d = new uint256[](amounts.length);
    }
}

contract Cand001CreatorSplitterV1 {
    Cand001TokenV1 public immutable token;
    address public settlementRouter;
    uint256 public creatorAmount;

    constructor(Cand001TokenV1 token_) { token = token_; }
    function setSettlementRouter(address router_) external { settlementRouter = router_; }
    function setCreatorAmount(uint256 amount) external { creatorAmount = amount; }

    function withdrawCreatorFeesToSettlementRouter() external {
        if (creatorAmount != 0) require(token.transfer(settlementRouter, creatorAmount), "TRANSFER");
    }

    function quoteCreatorAllocation(uint256[] calldata amounts)
        external pure
        returns (
            uint256[] memory creatorPayout,
            uint256[] memory creatorAdminCut,
            uint256[] memory permanentLiquidity,
            uint256[] memory creatorPartnerPayout,
            uint256[] memory creatorPartnerAdminCut
        )
    {
        uint256 n = amounts.length;
        creatorPayout = new uint256[](n);
        creatorAdminCut = new uint256[](n);
        permanentLiquidity = new uint256[](n);
        creatorPartnerPayout = new uint256[](n);
        creatorPartnerAdminCut = new uint256[](n);
        for (uint256 i; i < n; ++i) permanentLiquidity[i] = amounts[i];
    }
}

contract Cand001AttackerV1 {
    function directCollect(address router, address pool) external returns (bool ok) {
        (ok,) = router.call(abi.encodeWithSignature("collect(address)", pool));
    }

    function collectThroughKeeper(FeeSettlementKeeper keeper, address pool) external {
        keeper.collect(pool);
    }
}

contract P4Cand001HarnessV1 {
    uint256 internal constant MAX_AMOUNT = 1e24;

    Cand001TokenV1 public token;
    Cand001Permit2V1 public permit2;
    Cand001LiquidityRouterV1 public liquidityRouter;
    Cand001VaultV1 public vault;
    Cand001ProtocolFeesV1 public protocolFees;
    Cand001RegistryV1 public registry;
    Cand001AdminSplitterV1 public adminSplitter;
    Cand001CreatorSplitterV1 public creatorSplitter;
    FeeSettlementRouter public settlementRouter;
    FeeSettlementKeeper public keeper;
    Cand001AttackerV1 public attacker;

    address public pool;
    address public feeConverterStorage;
    uint256 public expectedFallback;
    uint256 public actionCount;

    constructor() {
        token = new Cand001TokenV1();
        permit2 = new Cand001Permit2V1();
        liquidityRouter = new Cand001LiquidityRouterV1(address(permit2));
        vault = new Cand001VaultV1(address(token));
        protocolFees = new Cand001ProtocolFeesV1();
        registry = new Cand001RegistryV1();
        adminSplitter = new Cand001AdminSplitterV1(registry);
        creatorSplitter = new Cand001CreatorSplitterV1(token);
        feeConverterStorage = address(0xFEE50001);
        pool = address(0xB001);

        settlementRouter = new FeeSettlementRouter(
            address(this),
            address(protocolFees),
            address(adminSplitter),
            address(0xBEEF),
            address(vault),
            address(liquidityRouter),
            address(0x7001),
            address(token)
        );
        creatorSplitter.setSettlementRouter(address(settlementRouter));
        settlementRouter.setCreatorFeeSplitter(pool, address(creatorSplitter));
        settlementRouter.setFeeConverterStorage(feeConverterStorage);

        keeper = new FeeSettlementKeeper(address(settlementRouter));
        settlementRouter.setKeeper(address(keeper), true);
        attacker = new Cand001AttackerV1();
    }

    function _amount(uint256 raw) internal pure returns (uint256) {
        return (raw % MAX_AMOUNT) + 1;
    }

    function action_publicKeeperFallback(uint256 rawAmount) public {
        uint256 amount = _amount(rawAmount);
        protocolFees.setCreatorAmount(amount);
        creatorSplitter.setCreatorAmount(amount);
        token.mint(address(creatorSplitter), amount);

        bool directOk = attacker.directCollect(address(settlementRouter), pool);
        require(!directOk, "UNPRIVILEGED_DIRECT_COLLECT_ACCEPTED");

        uint256 beforeStorage = token.balanceOf(feeConverterStorage);
        attacker.collectThroughKeeper(keeper, pool);
        uint256 afterStorage = token.balanceOf(feeConverterStorage);

        require(afterStorage - beforeStorage == amount, "FALLBACK_NOT_EXACT");
        require(token.balanceOf(address(settlementRouter)) == 0, "ROUTER_RESIDUE");

        expectedFallback += amount;
        actionCount += 1;
    }

    function property_fallback_conservation() external view returns (bool) {
        return token.balanceOf(feeConverterStorage) == expectedFallback;
    }
}

contract P4Cand001TestV1 is P4Cand001HarnessV1 {
    function test_publicKeeperCanCommitNonStrictFallback_v1() external {
        action_publicKeeperFallback(999_999);
        require(expectedFallback == 1_000_000, "UNEXPECTED_AMOUNT");
        require(actionCount == 1, "ACTION_NOT_RECORDED");
    }

    function testFuzz_publicKeeperFallbackConserves_v1(uint256 rawAmount) external {
        action_publicKeeperFallback(rawAmount);
        require(token.balanceOf(feeConverterStorage) == expectedFallback, "CONSERVATION");
    }
}
