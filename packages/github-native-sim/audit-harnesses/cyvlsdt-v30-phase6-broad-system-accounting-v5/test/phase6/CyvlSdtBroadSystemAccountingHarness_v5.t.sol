// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {CurveYieldGovernanceToken} from "contracts/CurveYieldGovernanceToken.sol";
import {CurveYieldVlSDTToken} from "contracts/CurveYieldVlSDTToken.sol";
import {CurveYieldVlSDTRevenueStaking} from "contracts/CurveYieldVlSDTRevenueStaking.sol";
import {CurveYieldVlSDTLocker} from "contracts/CurveYieldVlSDTLocker.sol";
import {CurveYieldVlSDTBoostStaking} from "contracts/CurveYieldVlSDTBoostStaking.sol";
import {CurveYieldVlSDTBoostMerchant} from "contracts/CurveYieldVlSDTBoostMerchant.sol";
import {CurveYieldVault} from "contracts/CurveYieldVault.sol";
import {CurveYieldRevenueStrategyV7} from "contracts/CurveYieldRevenueStrategyV20.sol";
import {CurveYieldRevenueConverter} from "contracts/CurveYieldRevenueConverter.sol";
import {CurveYieldUsdcToSdtConverter} from "contracts/CurveYieldUsdcToSdtConverter.sol";
import {CurveYieldGovernanceMintController} from "contracts/CurveYieldGovernanceMintController.sol";
import {CurveYieldCyGovYieldStaking} from "contracts/CurveYieldCyGovYieldStaking.sol";
import {CurveYieldCyGovFraxswapConverter} from "contracts/CurveYieldCyGovFraxswapConverter.sol";
import {CurveYieldCyGovDiscountedSaleConverter} from "contracts/CurveYieldCyGovDiscountedSaleConverterV9.sol";

interface VmV5 {
    function warp(uint256) external;
}

contract Phase6MintableTokenV5 is ERC20 {
    uint8 private immutable _tokenDecimals;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _tokenDecimals = d; }
    function decimals() public view override returns (uint8) { return _tokenDecimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract Phase6FakeFeeDistributorV5 {
    address public immutable rewardToken;
    constructor(address token) { rewardToken = token; }
    function REWARD_TOKEN() external view returns (address) { return rewardToken; }
}

contract Phase6FakeStakeDaoRouterV5 {
    using SafeERC20 for IERC20;
    IERC20 public immutable yieldToken;
    uint256 public pendingYield;
    uint256 public totalSeeded;
    uint256 public totalDelivered;
    constructor(address token) { yieldToken = IERC20(token); }
    function seedYield(uint256 amount) external { pendingYield += amount; totalSeeded += amount; }
    function execute(bytes[] calldata calls) external returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        uint256 amount = pendingYield;
        if (amount != 0) {
            pendingYield = 0;
            totalDelivered += amount;
            yieldToken.safeTransfer(msg.sender, amount);
        }
    }
}

contract Phase6FakeMarketplaceV5 {
    fallback() external payable {
        assembly { mstore(0, 0) return(0, 32) }
    }
}

contract Phase6FakeSwapAdapterV5 {
    using SafeERC20 for IERC20;
    address public immutable tokenIn;
    Phase6MintableTokenV5 public immutable tokenOut;
    uint256 public immutable numerator;
    uint256 public immutable denominator;
    uint256 public totalInput;
    uint256 public totalOutput;
    constructor(address input, address output, uint256 n, uint256 d) {
        require(input != address(0) && output != address(0) && n != 0 && d != 0, "ADAPTER_CONFIG");
        tokenIn = input; tokenOut = Phase6MintableTokenV5(output); numerator = n; denominator = d;
    }
    function quote(address input, address output, uint256 amountIn) external view returns (uint256) {
        require(input == tokenIn && output == address(tokenOut), "ADAPTER_PAIR");
        return amountIn * numerator / denominator;
    }
    function swap(address input, address output, uint256 amountIn, uint256 minOut, address recipient, uint256 deadline)
        external returns (uint256 amountOut)
    {
        require(block.timestamp <= deadline && input == tokenIn && output == address(tokenOut), "ADAPTER_SWAP");
        amountOut = amountIn * numerator / denominator;
        require(amountOut >= minOut, "ADAPTER_MIN");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        tokenOut.mint(recipient, amountOut);
        totalInput += amountIn; totalOutput += amountOut;
    }
}

contract Phase6GovernanceStakingDependencyV5 {
    address public immutable owner;
    address public governanceBoostStrategy;
    mapping(address => uint256) public configuredWeight;
    uint256 public queuedMintedParticipationRewards;
    constructor(address owner_) { owner = owner_; }
    function participationWeight(address account) external view returns (uint256) {
        uint256 weight = configuredWeight[account];
        return weight == 0 ? 1e18 : weight;
    }
    function setWeight(address account, uint256 weight) external { require(msg.sender == owner, "OWNER"); configuredWeight[account] = weight; }
    function setGovernanceBoostStrategy(address strategy) external { require(msg.sender == owner, "OWNER"); governanceBoostStrategy = strategy; }
    function queueMintedParticipationReward(uint256 amount) external { queuedMintedParticipationRewards += amount; }
    function notifyParticipationReward(uint256 amount) external { queuedMintedParticipationRewards += amount; }
}

contract Phase6FakeFraxPairV5 {
    using SafeERC20 for IERC20;
    address public immutable token0;
    address public immutable token1;
    constructor(address token0_, address token1_) { token0 = token0_; token1 = token1_; }
    function executeVirtualOrders(uint256) external {}
    function getAmountOut(uint256 amountIn, address) external pure returns (uint256) { return amountIn; }
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata) external {
        if (amount0Out != 0) IERC20(token0).safeTransfer(to, amount0Out);
        if (amount1Out != 0) IERC20(token1).safeTransfer(to, amount1Out);
    }
}

contract Phase6RevenueActorV5 {
    address public immutable controller;
    constructor(address controller_, address principal_, address payment_, address fakeSdt_, address revenueStaking_, address vault_, address boostStaking_, address boostMerchant_, address locker_) {
        controller = controller_;
        IERC20(principal_).approve(revenueStaking_, type(uint256).max);
        IERC20(principal_).approve(vault_, type(uint256).max);
        IERC20(principal_).approve(boostStaking_, type(uint256).max);
        IERC20(payment_).approve(boostMerchant_, type(uint256).max);
        IERC20(fakeSdt_).approve(locker_, type(uint256).max);
    }
    function execute(address target, bytes calldata data) external returns (bool ok, bytes memory result) {
        require(msg.sender == controller, "ACTOR_CONTROLLER");
        (ok, result) = target.call(data);
    }
}

contract Phase6TokenActorV5 {
    address public immutable controller;
    constructor(address controller_, address cyvlSdt_, address yieldStaking_, address governanceToken_, address pairedToken_, address fraxConverter_, address discountedConverter_) {
        controller = controller_;
        IERC20(cyvlSdt_).approve(yieldStaking_, type(uint256).max);
        IERC20(governanceToken_).approve(fraxConverter_, type(uint256).max);
        IERC20(governanceToken_).approve(discountedConverter_, type(uint256).max);
        IERC20(pairedToken_).approve(fraxConverter_, type(uint256).max);
    }
    function execute(address target, bytes calldata data) external returns (bool ok, bytes memory result) {
        require(msg.sender == controller, "ACTOR_CONTROLLER");
        (ok, result) = target.call(data);
    }
}

contract CyvlSdtBroadSystemAccountingHarnessV5 {
    using SafeERC20 for IERC20;
    VmV5 private constant VM = VmV5(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant CANONICAL_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address private constant CANONICAL_WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address private constant CANONICAL_WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant CANONICAL_SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
    address private constant TRICRYPTO_USDC = 0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B;
    address private constant SDT_WETH_POOL = 0xA19bf6fBf05624282cb6ed498f4761f22e084Edd;

    uint256 public constant DIRECT_STAKE_A = 1_000e18;
    uint256 public constant DIRECT_STAKE_B = 2_000e18;
    uint256 public constant DIRECT_STAKE_C = 3_000e18;
    uint256 public constant VAULT_DEPOSIT = 4_000e18;
    uint256 public constant VLSDT_FEE_REWARD = 1_000e6;
    uint256 public constant MERCHANT_REVENUE = 2_000e6;
    uint256 public constant BASELINE_TOTAL_ACTIVE = 10_000e18;
    uint256 public constant BASELINE_MERCHANT_BOOST = 1_000e18;

    Phase6MintableTokenV5 public immutable principal;
    Phase6MintableTokenV5 public immutable fakeYieldToken;
    Phase6MintableTokenV5 public immutable fakeSdt;
    Phase6MintableTokenV5 public immutable fakeVlSdt;
    Phase6MintableTokenV5 public immutable fakeVlBoost;
    Phase6MintableTokenV5 public immutable pairedToken;
    CurveYieldGovernanceToken public immutable governanceToken;
    CurveYieldVlSDTToken public immutable exactCyvlSdt;

    Phase6FakeFeeDistributorV5 public immutable fakeUsdcFeeDistributor;
    Phase6FakeFeeDistributorV5 public immutable fakeSdtFeeDistributor;
    Phase6FakeStakeDaoRouterV5 public immutable fakeStakeDaoRouter;
    Phase6FakeMarketplaceV5 public immutable fakeMarketplace;
    Phase6FakeSwapAdapterV5 public immutable fakeUsdToSdtAdapter;
    Phase6FakeSwapAdapterV5 public immutable fakeSdtToPrincipalAdapter;
    Phase6GovernanceStakingDependencyV5 public immutable governanceStakingDependency;
    Phase6FakeFraxPairV5 public immutable fakeFraxPair;

    CurveYieldVlSDTRevenueStaking public immutable revenueStaking;
    CurveYieldVlSDTLocker public immutable locker;
    CurveYieldVlSDTBoostStaking public immutable boostStaking;
    CurveYieldVlSDTBoostMerchant public immutable boostMerchant;
    CurveYieldVault public immutable vault;
    CurveYieldRevenueStrategyV7 public immutable strategy;
    CurveYieldRevenueConverter public immutable revenueConverter;
    CurveYieldUsdcToSdtConverter public immutable usdcToSdtConverter;
    CurveYieldGovernanceMintController public immutable mintController;
    CurveYieldCyGovYieldStaking public immutable yieldStaking;
    CurveYieldCyGovFraxswapConverter public immutable fraxswapConverter;
    CurveYieldCyGovDiscountedSaleConverter public immutable discountedSaleConverter;

    Phase6RevenueActorV5 public immutable directA;
    Phase6RevenueActorV5 public immutable directB;
    Phase6RevenueActorV5 public immutable directC;
    Phase6RevenueActorV5 public immutable merchantBuyer;
    Phase6TokenActorV5 public immutable tokenA;
    Phase6TokenActorV5 public immutable tokenB;
    Phase6TokenActorV5 public immutable tokenC;

    uint256 public expectedDirectA;
    uint256 public expectedDirectB;
    uint256 public expectedDirectC;
    uint256 public expectedStrategy;
    uint256 public expectedQueuedA;
    uint256 public expectedQueuedB;
    uint256 public expectedQueuedC;
    uint256 public vlSdtRevenueInjected;
    uint256 public merchantRevenueInjected;
    uint256 public totalRevenueInjected;
    uint256 public totalRevenueClaimed;
    uint256 public fakeYieldMinted;
    uint256 public successfulTransitions;
    uint256 public revertedTransitions;
    uint256 public actionCalls;

    uint256[3] public pendingRevenueWithdrawalId;
    uint256[3] public pendingRevenueWithdrawalAmount;
    bool[3] public hasPendingRevenueWithdrawal;
    uint256[3] public boostDelegationId;
    bool[3] public hasBoostDelegation;
    uint256 public lockerCommitmentId;
    bool public hasLockerCommitment;
    uint256 public emergencyWithdrawalId;
    bool public hasEmergencyWithdrawal;
    uint256 public governanceReservationId;
    uint256 public governanceReservationAmount;
    uint256 public governanceReservationExecutableAt;
    bool public hasGovernanceReservation;
    uint256 public merchantListingId;
    bool public hasMerchantListing;
    bool public deterministicScenarioRun;

    constructor() {
        principal = new Phase6MintableTokenV5("Audit cyvlSDT Principal", "aCYVL", 18);
        fakeYieldToken = new Phase6MintableTokenV5("Audit USDC Yield", "aUSDC", 6);
        fakeSdt = new Phase6MintableTokenV5("Audit SDT", "aSDT", 18);
        fakeVlSdt = new Phase6MintableTokenV5("Audit vlSDT", "avlSDT", 18);
        fakeVlBoost = new Phase6MintableTokenV5("Audit vlBoost", "avlBOOST", 18);
        pairedToken = new Phase6MintableTokenV5("Audit Frax Paired", "aPAIR", 18);
        governanceToken = new CurveYieldGovernanceToken(address(this), "Audit Governance", "aCYGOV");
        exactCyvlSdt = new CurveYieldVlSDTToken(address(this));
        exactCyvlSdt.setLocker(address(this));

        fakeUsdcFeeDistributor = new Phase6FakeFeeDistributorV5(address(fakeYieldToken));
        fakeSdtFeeDistributor = new Phase6FakeFeeDistributorV5(address(fakeSdt));
        fakeStakeDaoRouter = new Phase6FakeStakeDaoRouterV5(address(fakeYieldToken));
        fakeMarketplace = new Phase6FakeMarketplaceV5();

        revenueStaking = new CurveYieldVlSDTRevenueStaking(address(this), address(this), address(this), address(principal), address(governanceToken));
        locker = new CurveYieldVlSDTLocker(
            address(this), address(this), address(fakeSdt), address(fakeVlSdt), address(fakeVlBoost),
            address(fakeStakeDaoRouter), address(fakeUsdcFeeDistributor), address(fakeSdtFeeDistributor),
            address(fakeMarketplace), address(principal)
        );
        boostStaking = new CurveYieldVlSDTBoostStaking(address(this), address(principal), address(governanceToken), address(locker));
        boostMerchant = new CurveYieldVlSDTBoostMerchant(address(this), address(locker), address(revenueStaking), address(fakeMarketplace));
        locker.configureSystem(address(revenueStaking), address(boostMerchant), address(boostStaking));

        revenueConverter = new CurveYieldRevenueConverter(address(this), address(fakeSdt), address(principal), address(locker));
        fakeUsdToSdtAdapter = new Phase6FakeSwapAdapterV5(address(fakeYieldToken), address(fakeSdt), 1e12, 1);
        fakeSdtToPrincipalAdapter = new Phase6FakeSwapAdapterV5(address(fakeSdt), address(principal), 1, 1);
        revenueConverter.setSdtSwapAdapter(address(fakeSdtToPrincipalAdapter));
        revenueConverter.setUsdcRoute(address(fakeYieldToken), address(fakeUsdToSdtAdapter));
        usdcToSdtConverter = new CurveYieldUsdcToSdtConverter(
            address(revenueConverter), CANONICAL_USDC, CANONICAL_WBTC, CANONICAL_WETH, CANONICAL_SDT, TRICRYPTO_USDC, SDT_WETH_POOL
        );

        vault = new CurveYieldVault("Audit Revenue Vault", "aRV", address(this), address(this), 18);
        strategy = new CurveYieldRevenueStrategyV7(
            address(vault), address(principal), address(revenueStaking), address(governanceToken), address(fakeSdt),
            address(revenueConverter), address(this), 0, 0, 0
        );
        vault.setStrategy(address(strategy));

        governanceStakingDependency = new Phase6GovernanceStakingDependencyV5(address(this));
        mintController = new CurveYieldGovernanceMintController(address(this), address(governanceToken), address(governanceStakingDependency));
        yieldStaking = new CurveYieldCyGovYieldStaking(address(this), address(exactCyvlSdt), address(governanceToken), address(this));
        fakeFraxPair = new Phase6FakeFraxPairV5(address(governanceToken), address(pairedToken));
        fraxswapConverter = new CurveYieldCyGovFraxswapConverter(
            address(this), address(governanceToken), address(this), address(fakeFraxPair), 0, 0, 0
        );
        discountedSaleConverter = new CurveYieldCyGovDiscountedSaleConverter(
            address(governanceToken), address(governanceStakingDependency), address(fraxswapConverter)
        );
        // Deliberately do not activate the discounted-sale converter here: exact GovernanceStaking wiring is Phase 7.

        revenueStaking.setImmediateWithdrawFeeBps(0);
        revenueStaking.setExcessTreasuryBps(0);
        revenueStaking.addRewardToken(address(fakeYieldToken));
        revenueStaking.addRewardToken(address(fakeSdt));
        revenueStaking.setNotifier(address(locker), true);
        revenueStaking.setNotifier(address(boostMerchant), true);
        revenueStaking.setNotifier(address(this), true);
        boostMerchant.setMinimumLeaseBoost(1e18);
        boostMerchant.setPaymentToken(address(fakeYieldToken), true, 2e6, 2e6);

        fakeVlSdt.mint(address(locker), 100_000e18);
        fakeVlBoost.mint(address(locker), 100_000e18);
        fakeSdt.approve(address(revenueStaking), type(uint256).max);
        fakeYieldToken.approve(address(revenueStaking), type(uint256).max);
        fakeSdt.approve(address(revenueConverter), type(uint256).max);

        directA = new Phase6RevenueActorV5(address(this), address(principal), address(fakeYieldToken), address(fakeSdt), address(revenueStaking), address(vault), address(boostStaking), address(boostMerchant), address(locker));
        directB = new Phase6RevenueActorV5(address(this), address(principal), address(fakeYieldToken), address(fakeSdt), address(revenueStaking), address(vault), address(boostStaking), address(boostMerchant), address(locker));
        directC = new Phase6RevenueActorV5(address(this), address(principal), address(fakeYieldToken), address(fakeSdt), address(revenueStaking), address(vault), address(boostStaking), address(boostMerchant), address(locker));
        merchantBuyer = new Phase6RevenueActorV5(address(this), address(principal), address(fakeYieldToken), address(fakeSdt), address(revenueStaking), address(vault), address(boostStaking), address(boostMerchant), address(locker));

        tokenA = new Phase6TokenActorV5(address(this), address(exactCyvlSdt), address(yieldStaking), address(governanceToken), address(pairedToken), address(fraxswapConverter), address(discountedSaleConverter));
        tokenB = new Phase6TokenActorV5(address(this), address(exactCyvlSdt), address(yieldStaking), address(governanceToken), address(pairedToken), address(fraxswapConverter), address(discountedSaleConverter));
        tokenC = new Phase6TokenActorV5(address(this), address(exactCyvlSdt), address(yieldStaking), address(governanceToken), address(pairedToken), address(fraxswapConverter), address(discountedSaleConverter));

        principal.approve(address(vault), type(uint256).max);
        principal.mint(address(directA), 50_000e18);
        principal.mint(address(directB), 50_000e18);
        principal.mint(address(directC), 50_000e18);
        principal.mint(address(this), 50_000e18);
        fakeYieldToken.mint(address(merchantBuyer), 1_000_000e6);
        fakeYieldMinted += 1_000_000e6;

        exactCyvlSdt.mint(address(tokenA), 100_000e18);
        exactCyvlSdt.mint(address(tokenB), 100_000e18);
        exactCyvlSdt.mint(address(tokenC), 100_000e18);
        pairedToken.mint(address(tokenA), 100_000e18);
        pairedToken.mint(address(tokenB), 100_000e18);
        pairedToken.mint(address(tokenC), 100_000e18);
        pairedToken.mint(address(fakeFraxPair), 1_000_000e18);

        _trySetMinter(address(this));
        _trySetMinter(address(revenueStaking));
        _trySetMinter(address(boostStaking));
        _trySetMinter(address(mintController));
        _trySetMinter(address(yieldStaking));
        address(governanceToken).call(abi.encodeWithSignature("mint(address,uint256)", address(tokenA), 10_000e18));
        address(governanceToken).call(abi.encodeWithSignature("mint(address,uint256)", address(tokenB), 10_000e18));
        address(governanceToken).call(abi.encodeWithSignature("mint(address,uint256)", address(tokenC), 10_000e18));
        address(governanceToken).call(abi.encodeWithSignature("mint(address,uint256)", address(fakeFraxPair), 100_000e18));

        _initializeBaseline();
    }

    function _trySetMinter(address minter) internal {
        address(governanceToken).call(abi.encodeWithSignature("setMinter(address,bool)", minter, true));
    }

    function _initializeBaseline() internal {
        _requireActorCall(directA, address(revenueStaking), abi.encodeWithSignature("stake(uint256)", DIRECT_STAKE_A));
        expectedDirectA = DIRECT_STAKE_A;
        _requireActorCall(directB, address(revenueStaking), abi.encodeWithSignature("stake(uint256)", DIRECT_STAKE_B));
        expectedDirectB = DIRECT_STAKE_B;
        _requireActorCall(directC, address(revenueStaking), abi.encodeWithSignature("stake(uint256)", DIRECT_STAKE_C));
        expectedDirectC = DIRECT_STAKE_C;
        vault.deposit(VAULT_DEPOSIT);
        vault.earn();
        expectedStrategy = VAULT_DEPOSIT;
        require(revenueStaking.totalActiveStake() == BASELINE_TOTAL_ACTIVE, "BASELINE_TOTAL_ACTIVE");
        _verifyAllAccounting();
    }

    function _requireActorCall(Phase6RevenueActorV5 actor, address target, bytes memory data) internal returns (bytes memory result) {
        (bool ok, bytes memory returned) = actor.execute(target, data);
        require(ok, "BASELINE_ACTOR_CALL");
        return returned;
    }

    function _actorIndex(address sender) internal pure returns (uint256) { return uint160(sender) % 3; }
    function _actor(uint256 index) internal view returns (Phase6RevenueActorV5) { return index == 0 ? directA : index == 1 ? directB : directC; }
    function _tokenActor(uint256 index) internal view returns (Phase6TokenActorV5) { return index == 0 ? tokenA : index == 1 ? tokenB : tokenC; }
    function _activeExpected(uint256 i) internal view returns (uint256) { return i == 0 ? expectedDirectA : i == 1 ? expectedDirectB : expectedDirectC; }
    function _queuedExpected(uint256 i) internal view returns (uint256) { return i == 0 ? expectedQueuedA : i == 1 ? expectedQueuedB : expectedQueuedC; }
    function _setActiveExpected(uint256 i, uint256 v) internal { if (i == 0) expectedDirectA = v; else if (i == 1) expectedDirectB = v; else expectedDirectC = v; }
    function _setQueuedExpected(uint256 i, uint256 v) internal { if (i == 0) expectedQueuedA = v; else if (i == 1) expectedQueuedB = v; else expectedQueuedC = v; }
    function _whole(uint16 raw, uint256 minWhole, uint256 maxWhole, uint256 unit) internal pure returns (uint256) {
        if (maxWhole <= minWhole) return minWhole * unit;
        return (minWhole + uint256(raw) % (maxWhole - minWhole + 1)) * unit;
    }

    function _record(bool ok) internal {
        actionCalls++;
        if (ok) _afterSuccessfulTransition();
        else revertedTransitions++;
    }

    function _afterSuccessfulTransition() internal {
        successfulTransitions++;
        _verifyAllAccounting();
    }

    function _syncStrategyExpected() internal { expectedStrategy = revenueStaking.activeBalance(address(strategy)); }

    function _verifyAllAccounting() internal view {
        require(revenueStaking.activeBalance(address(directA)) == expectedDirectA, "ACTIVE_A");
        require(revenueStaking.activeBalance(address(directB)) == expectedDirectB, "ACTIVE_B");
        require(revenueStaking.activeBalance(address(directC)) == expectedDirectC, "ACTIVE_C");
        require(revenueStaking.activeBalance(address(strategy)) == expectedStrategy, "ACTIVE_STRATEGY");
        require(revenueStaking.queuedBalance(address(directA)) == expectedQueuedA, "QUEUED_A");
        require(revenueStaking.queuedBalance(address(directB)) == expectedQueuedB, "QUEUED_B");
        require(revenueStaking.queuedBalance(address(directC)) == expectedQueuedC, "QUEUED_C");
        require(property_principal_conservation(), "PRINCIPAL_CONSERVATION");
        require(property_reward_source_conservation(), "REWARD_SOURCE");
        require(property_reward_claim_conservation(), "REWARD_CLAIM");
        require(property_vault_share_supply_reconciles(), "VAULT_SHARES");
        require(property_strategy_stake_reconciles(), "STRATEGY_STAKE");
        require(property_boost_capacity_reconciles(), "BOOST_CAPACITY");
        require(property_governance_reservations_reconcile(), "GOV_RESERVATIONS");
        require(property_converter_flow_conservation(), "CONVERTER_FLOW");
        require(property_exact_token_conservation(), "TOKEN_CONSERVATION");
        require(property_transition_accounting_consistent(), "TRANSITION_ACCOUNTING");
    }

    function _principalKnownBalances() internal view returns (uint256 total) {
        total += principal.balanceOf(address(this));
        total += principal.balanceOf(address(directA)); total += principal.balanceOf(address(directB)); total += principal.balanceOf(address(directC)); total += principal.balanceOf(address(merchantBuyer));
        total += principal.balanceOf(address(revenueStaking)); total += principal.balanceOf(address(vault)); total += principal.balanceOf(address(strategy)); total += principal.balanceOf(address(boostStaking));
        total += principal.balanceOf(address(locker)); total += principal.balanceOf(address(revenueConverter)); total += principal.balanceOf(address(fakeSdtToPrincipalAdapter));
    }

    function _fakeYieldKnownBalances() internal view returns (uint256 total) {
        total += fakeYieldToken.balanceOf(address(this)); total += fakeYieldToken.balanceOf(address(fakeStakeDaoRouter)); total += fakeYieldToken.balanceOf(address(locker));
        total += fakeYieldToken.balanceOf(address(revenueStaking)); total += fakeYieldToken.balanceOf(address(boostMerchant)); total += fakeYieldToken.balanceOf(address(strategy));
        total += fakeYieldToken.balanceOf(address(revenueConverter)); total += fakeYieldToken.balanceOf(address(fakeUsdToSdtAdapter)); total += fakeYieldToken.balanceOf(address(fakeMarketplace));
        total += fakeYieldToken.balanceOf(address(directA)); total += fakeYieldToken.balanceOf(address(directB)); total += fakeYieldToken.balanceOf(address(directC)); total += fakeYieldToken.balanceOf(address(merchantBuyer));
    }

    function _injectVlSdtYield(uint256 amount) internal returns (uint256 credited) {
        fakeYieldToken.mint(address(fakeStakeDaoRouter), amount); fakeYieldMinted += amount; fakeStakeDaoRouter.seedYield(amount);
        uint256 beforeBalance = fakeYieldToken.balanceOf(address(revenueStaking));
        locker.claimVlSDTRewards();
        credited = fakeYieldToken.balanceOf(address(revenueStaking)) - beforeBalance;
        if (credited != 0) { vlSdtRevenueInjected += credited; totalRevenueInjected += credited; }
    }

    function _injectMerchantRevenue(uint256 boostAmount) internal returns (uint256 credited) {
        (,, uint256 totalPayment) = boostMerchant.quoteLease(address(fakeYieldToken), boostAmount, 1);
        fakeYieldToken.mint(address(merchantBuyer), totalPayment); fakeYieldMinted += totalPayment;
        uint256 beforeBalance = fakeYieldToken.balanceOf(address(revenueStaking));
        bytes memory result = _requireActorCall(merchantBuyer, address(boostMerchant), abi.encodeWithSignature(
            "leaseBoost(address,uint256,uint256,address,uint256,uint256)", address(fakeYieldToken), boostAmount, 1, address(merchantBuyer), totalPayment, block.timestamp + 1 days
        ));
        (uint256 payment,) = abi.decode(result, (uint256, uint256));
        credited = fakeYieldToken.balanceOf(address(revenueStaking)) - beforeBalance;
        require(credited == payment && payment == totalPayment, "MERCHANT_CREDIT");
        merchantRevenueInjected += credited; totalRevenueInjected += credited;
    }

    function testWholeNumberMultiSourceRevenueAccountingV5() external {
        require(!deterministicScenarioRun, "RUN_ONCE"); deterministicScenarioRun = true;
        require(revenueStaking.totalActiveStake() == BASELINE_TOTAL_ACTIVE, "BASELINE");
        uint256 first = _injectVlSdtYield(VLSDT_FEE_REWARD);
        require(first == VLSDT_FEE_REWARD, "VLSDT_SOURCE");
        uint256 second = _injectMerchantRevenue(BASELINE_MERCHANT_BOOST);
        require(second == MERCHANT_REVENUE, "MERCHANT_SOURCE");
        require(totalRevenueInjected == VLSDT_FEE_REWARD + MERCHANT_REVENUE, "TOTAL_SOURCE");
        _verifyAllAccounting();
    }

    function actionRevenueStakeWhole(uint16 raw) external {
        uint256 i = _actorIndex(msg.sender); Phase6RevenueActorV5 a = _actor(i); uint256 amount = _whole(raw, 1, 1000, 1e18);
        principal.mint(address(a), amount); (bool ok,) = a.execute(address(revenueStaking), abi.encodeWithSignature("stake(uint256)", amount));
        if (ok) _setActiveExpected(i, _activeExpected(i) + amount); _record(ok);
    }
    function actionRevenueWithdrawImmediateWhole(uint16 raw) external {
        uint256 i = _actorIndex(msg.sender); Phase6RevenueActorV5 a = _actor(i); uint256 active = _activeExpected(i);
        if (active < 1e18) { _record(false); return; } uint256 amount = _whole(raw, 1, active / 1e18, 1e18);
        (bool ok,) = a.execute(address(revenueStaking), abi.encodeWithSignature("withdrawImmediate(uint256,address)", amount, address(a)));
        if (ok) _setActiveExpected(i, active - amount); _record(ok);
    }
    function actionRevenueRequestWithdrawalWhole(uint16 raw) external {
        uint256 i = _actorIndex(msg.sender); if (hasPendingRevenueWithdrawal[i]) { _record(false); return; }
        Phase6RevenueActorV5 a = _actor(i); uint256 active = _activeExpected(i); if (active < 1e18) { _record(false); return; }
        uint256 amount = _whole(raw, 1, active / 1e18, 1e18); (bool ok, bytes memory result) = a.execute(address(revenueStaking), abi.encodeWithSignature("requestWithdrawal(uint256)", amount));
        if (ok) { uint256 id = abi.decode(result, (uint256)); pendingRevenueWithdrawalId[i] = id; pendingRevenueWithdrawalAmount[i] = amount; hasPendingRevenueWithdrawal[i] = true; _setActiveExpected(i, active - amount); _setQueuedExpected(i, _queuedExpected(i) + amount); }
        _record(ok);
    }
    function actionRevenueCompleteQueuedWithdrawal(uint16 raw) external {
        uint256 i = uint256(raw) % 3; if (!hasPendingRevenueWithdrawal[i]) { _record(false); return; }
        Phase6RevenueActorV5 a = _actor(i); uint256 id = pendingRevenueWithdrawalId[i]; uint256 amount = pendingRevenueWithdrawalAmount[i];
        (,, uint64 unlockTime, bool completed) = revenueStaking.withdrawalRequests(id); if (completed) { _record(false); return; } if (block.timestamp < unlockTime) VM.warp(unlockTime);
        (bool ok,) = a.execute(address(revenueStaking), abi.encodeWithSignature("completeQueuedWithdrawal(uint256,address)", id, address(a)));
        if (ok) { _setQueuedExpected(i, _queuedExpected(i) - amount); hasPendingRevenueWithdrawal[i] = false; pendingRevenueWithdrawalAmount[i] = 0; } _record(ok);
    }
    function actionRevenueClaimToken(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(uint256(raw) % 3); uint256 beforeBal = fakeYieldToken.balanceOf(address(a));
        (bool ok,) = a.execute(address(revenueStaking), abi.encodeWithSignature("claimRewards(address)", address(a)));
        if (ok) totalRevenueClaimed += fakeYieldToken.balanceOf(address(a)) - beforeBal; _record(ok);
    }
    function actionRevenueStartRewardCycle() external { (bool ok,) = address(revenueStaking).call(abi.encodeWithSignature("startRewardCycle(address)", address(fakeYieldToken))); _record(ok); }
    function actionRevenueNotifyTokenWhole(uint16 raw) external {
        uint256 amount = _whole(raw, 1, 1000, 1e18); fakeSdt.mint(address(this), amount);
        (bool ok,) = address(revenueStaking).call(abi.encodeWithSignature("notifyReward(address,uint256,uint256)", address(fakeSdt), amount, uint256(1e18))); _record(ok);
    }
    function actionRevenueClaimGovernance(uint16 raw) external { Phase6RevenueActorV5 a = _actor(uint256(raw) % 3); (bool ok,) = a.execute(address(revenueStaking), abi.encodeWithSignature("claimGovernance(address)", address(a))); _record(ok); }
    function actionRevenueGovernanceRateControlled(uint16 raw) external { (bool ok,) = address(revenueStaking).call(abi.encodeWithSignature("setGovernanceEmissionRate(uint256)", uint256(raw) * 1e12)); _record(ok); }

    function actionVaultDepositWhole(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(_actorIndex(msg.sender)); uint256 amount = _whole(raw, 1, 1000, 1e18); principal.mint(address(a), amount);
        (bool ok,) = a.execute(address(vault), abi.encodeWithSignature("deposit(uint256)", amount)); if (ok) _syncStrategyExpected(); _record(ok);
    }
    function actionVaultDepositAll(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(uint256(raw) % 3); principal.mint(address(a), _whole(raw, 1, 100, 1e18));
        (bool ok,) = a.execute(address(vault), abi.encodeWithSignature("depositAll()")); if (ok) _syncStrategyExpected(); _record(ok);
    }
    function actionVaultDepositStrictWhole(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(_actorIndex(msg.sender)); uint256 amount = _whole(raw, 1, 500, 1e18); principal.mint(address(a), amount);
        (bool ok,) = a.execute(address(vault), abi.encodeWithSignature("depositWithStrictHarvest(uint256,uint256)", amount, 0)); if (ok) _syncStrategyExpected(); _record(ok);
    }
    function actionVaultEarn() external { (bool ok,) = address(vault).call(abi.encodeWithSignature("earn()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionVaultWithdrawWhole(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(_actorIndex(msg.sender)); uint256 shares = vault.balanceOf(address(a)); if (shares < 1e18) { _record(false); return; }
        uint256 amount = _whole(raw, 1, shares / 1e18, 1e18); (bool ok,) = a.execute(address(vault), abi.encodeWithSignature("withdraw(uint256)", amount)); if (ok) _syncStrategyExpected(); _record(ok);
    }
    function actionVaultWithdrawAll(uint16 raw) external { Phase6RevenueActorV5 a = _actor(uint256(raw) % 3); (bool ok,) = a.execute(address(vault), abi.encodeWithSignature("withdrawAll()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionVaultProposeStrategyControlled(uint16) external { (bool ok,) = address(vault).call(abi.encodeWithSignature("proposeStrat(address)", address(strategy))); _record(ok); }

    function actionStrategyDeposit() external { (bool ok,) = address(strategy).call(abi.encodeWithSignature("deposit()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionStrategyHarvest() external {
        uint256 rewardBefore = revenueStaking.earned(address(strategy), address(fakeYieldToken)); (bool ok,) = address(strategy).call(abi.encodeWithSignature("harvest()"));
        if (ok) { _syncStrategyExpected(); totalRevenueClaimed += rewardBefore; } _record(ok);
    }
    function actionStrategyBeforeDepositStrict() external { (bool ok,) = address(strategy).call(abi.encodeWithSignature("beforeDepositStrict()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionStrategyBeforeDeposit() external { (bool ok,) = address(strategy).call(abi.encodeWithSignature("beforeDeposit()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionStrategyWithdrawWhole(uint16 raw) external { (bool ok,) = address(strategy).call(abi.encodeWithSignature("withdraw(uint256)", _whole(raw, 1, 100, 1e18))); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionStrategyPauseControlled() external { (bool ok,) = address(strategy).call(abi.encodeWithSignature("pause()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionStrategyUnpauseControlled() external { (bool ok,) = address(strategy).call(abi.encodeWithSignature("unpause()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionStrategyPanicControlled() external { (bool ok,) = address(strategy).call(abi.encodeWithSignature("panic()")); if (ok) _syncStrategyExpected(); _record(ok); }
    function actionStrategyConverterControlled(uint16 raw) external {
        address proposed = (raw & 1) == 0 ? address(revenueConverter) : address(usdcToSdtConverter); (bool ok,) = address(strategy).call(abi.encodeWithSignature("proposeConverter(address)", proposed));
        if (ok) { (bool cancelled,) = address(strategy).call(abi.encodeWithSignature("cancelConverter()")); ok = cancelled; } if (ok) _syncStrategyExpected(); _record(ok);
    }

    function actionLockerDepositWhole(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(_actorIndex(msg.sender)); uint256 amount = _whole(raw, 1, 100, 1e18); fakeSdt.mint(address(a), amount);
        (bool ok,) = a.execute(address(locker), abi.encodeWithSignature("deposit(uint256,address)", amount, address(a))); _record(ok);
    }
    function actionLockerClaimVlSdtRewardsWhole(uint16 raw) external {
        uint256 amount = _whole(raw, 1, 1000, 1e6); fakeYieldToken.mint(address(fakeStakeDaoRouter), amount); fakeYieldMinted += amount; fakeStakeDaoRouter.seedYield(amount);
        uint256 beforeBal = fakeYieldToken.balanceOf(address(revenueStaking)); (bool ok,) = address(locker).call(abi.encodeWithSignature("claimVlSDTRewards()"));
        if (ok) { uint256 credited = fakeYieldToken.balanceOf(address(revenueStaking)) - beforeBal; vlSdtRevenueInjected += credited; totalRevenueInjected += credited; } _record(ok);
    }
    function actionLockerModuleReserveControlled(uint16 raw) external { uint256 merchantBps = uint256(raw) % 5001; uint256 stakingBps = (uint256(raw) / 3) % 5001; (bool ok,) = address(locker).call(abi.encodeWithSignature("setModuleBoostReserveBps(uint256,uint256)", merchantBps, stakingBps)); _record(ok); }
    function actionLockerForwardMarketplaceRevenueWhole(uint16 raw) external {
        uint256 amount = _whole(raw, 1, 100, 1e6); fakeYieldToken.mint(address(locker), amount); fakeYieldMinted += amount;
        (bool ok,) = address(locker).call(abi.encodeWithSignature("forwardMarketplaceRevenue(address,uint256)", address(fakeYieldToken), amount)); _record(ok);
    }
    function actionLockerReserveBoostWhole(uint16 raw) external { uint256 amount = _whole(raw, 1, 100, 1e18); (bool ok,) = address(locker).call(abi.encodeWithSignature("reserveCurrentAvailableBoost(uint256,uint256)", amount, amount)); _record(ok); }
    function actionLockerReleaseBoostWhole(uint16 raw) external { uint256 amount = _whole(raw, 1, 100, 1e18); (bool ok,) = address(locker).call(abi.encodeWithSignature("releaseCurrentAvailableBoostReserve(uint256,uint256)", amount, amount)); _record(ok); }
    function actionLockerDelegateBoostWhole(uint16 raw) external {
        uint256 amount = _whole(raw, 1, 100, 1e18); (bool ok, bytes memory result) = address(locker).call(abi.encodeWithSignature("delegateBoost(uint256,uint256,address)", amount, block.timestamp + 2 weeks, address(directA)));
        if (ok && result.length >= 32) { lockerCommitmentId = abi.decode(result, (uint256)); hasLockerCommitment = true; } _record(ok);
    }
    function actionLockerReleaseDelegationWhole(uint16) external { if (!hasLockerCommitment) { _record(false); return; } (bool ok,) = address(locker).call(abi.encodeWithSignature("releaseModuleBoostCommitment(uint256)", lockerCommitmentId)); if (ok) hasLockerCommitment = false; _record(ok); }
    function actionLockerRequestEmergencyWithdrawalWhole(uint16 raw) external {
        (bool ok, bytes memory result) = address(locker).call(abi.encodeWithSignature("requestEmergencyWithdrawal(uint256)", _whole(raw, 1, 100, 1e18)));
        if (ok && result.length >= 64) { (emergencyWithdrawalId,) = abi.decode(result, (uint256, uint256)); hasEmergencyWithdrawal = true; } _record(ok);
    }
    function actionLockerCompleteEmergencyWithdrawal(uint16) external { if (!hasEmergencyWithdrawal) { _record(false); return; } (bool ok,) = address(locker).call(abi.encodeWithSignature("completeEmergencyWithdrawal(uint256,address)", emergencyWithdrawalId, address(this))); if (ok) hasEmergencyWithdrawal = false; _record(ok); }

    function actionBoostDepositWhole(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(_actorIndex(msg.sender)); uint256 amount = _whole(raw, 1, 500, 1e18); principal.mint(address(a), amount);
        (bool ok,) = a.execute(address(boostStaking), abi.encodeWithSignature("deposit(uint256)", amount)); _record(ok);
    }
    function actionBoostWithdrawWhole(uint16 raw) external {
        Phase6RevenueActorV5 a = _actor(_actorIndex(msg.sender)); uint256 deposited = boostStaking.depositedBalance(address(a)); uint256 reserved = boostStaking.reservedBalance(address(a)); uint256 available = deposited > reserved ? deposited - reserved : 0;
        if (available < 1e18) { _record(false); return; } uint256 amount = _whole(raw, 1, available / 1e18, 1e18); (bool ok,) = a.execute(address(boostStaking), abi.encodeWithSignature("withdraw(uint256,address)", amount, address(a))); _record(ok);
    }
    function actionBoostDelegateWhole(uint16 raw) external {
        uint256 i = _actorIndex(msg.sender); Phase6RevenueActorV5 a = _actor(i); uint256 deposited = boostStaking.depositedBalance(address(a)); if (deposited < 1e18) { _record(false); return; }
        uint256 amount = _whole(raw, 1, deposited / 1e18, 1e18); (bool ok, bytes memory result) = a.execute(address(boostStaking), abi.encodeWithSignature("delegate(uint256,uint256,address)", amount, uint256(1 + raw % 52), address(a)));
        if (ok && result.length >= 64) { (uint256 id,) = abi.decode(result, (uint256, uint256)); boostDelegationId[i] = id; hasBoostDelegation[i] = true; } _record(ok);
    }
    function actionBoostRedelegateWhole(uint16 raw) external {
        uint256 i = _actorIndex(msg.sender); if (!hasBoostDelegation[i]) { _record(false); return; } Phase6RevenueActorV5 a = _actor(i);
        (bool ok,) = a.execute(address(boostStaking), abi.encodeWithSignature("redelegate(uint256,uint256,uint256,address)", boostDelegationId[i], _whole(raw, 1, 50, 1e18), uint256(1 + raw % 52), address(a))); _record(ok);
    }
    function actionBoostReleaseDelegation(uint16 raw) external { uint256 i = uint256(raw) % 3; if (!hasBoostDelegation[i]) { _record(false); return; } Phase6RevenueActorV5 a = _actor(i); (bool ok,) = a.execute(address(boostStaking), abi.encodeWithSignature("releaseDelegation(uint256)", boostDelegationId[i])); if (ok) hasBoostDelegation[i] = false; _record(ok); }
    function actionBoostClaimGovernance(uint16 raw) external { Phase6RevenueActorV5 a = _actor(uint256(raw) % 3); (bool ok,) = a.execute(address(boostStaking), abi.encodeWithSignature("claimGovernance(address)", address(a))); _record(ok); }
    function actionBoostMultiplierControlled(uint16 raw) external { uint256 minM = 2e18 + (uint256(raw) % 4) * 1e18; uint256 maxM = minM + 2e18; (bool ok,) = address(boostStaking).call(abi.encodeWithSignature("setMultiplierRange(uint256,uint256)", minM, maxM)); _record(ok); }

    function actionMerchantLeaseWhole(uint16 raw) external {
        uint256 boostAmount = _whole(raw, 1, 500, 1e18); try boostMerchant.quoteLease(address(fakeYieldToken), boostAmount, 1) returns (uint256, uint256, uint256 payment) {
            if (payment == 0) { _record(false); return; } fakeYieldToken.mint(address(merchantBuyer), payment); fakeYieldMinted += payment; uint256 beforeBal = fakeYieldToken.balanceOf(address(revenueStaking));
            (bool ok,) = merchantBuyer.execute(address(boostMerchant), abi.encodeWithSignature("leaseBoost(address,uint256,uint256,address,uint256,uint256)", address(fakeYieldToken), boostAmount, 1, address(merchantBuyer), payment, block.timestamp + 1 days));
            if (ok) { uint256 credited = fakeYieldToken.balanceOf(address(revenueStaking)) - beforeBal; merchantRevenueInjected += credited; totalRevenueInjected += credited; } _record(ok);
        } catch { _record(false); }
    }
    function actionMerchantCreateListingWhole(uint16 raw) external {
        (bool ok, bytes memory result) = address(boostMerchant).call(abi.encodeWithSignature("createMarketplaceListing(address,uint256,uint256,uint256,uint256)", address(fakeYieldToken), _whole(raw, 1, 100, 1e18), uint256(1), uint256(4), block.timestamp + 7 days));
        if (ok && result.length >= 32) { merchantListingId = abi.decode(result, (uint256)); hasMerchantListing = true; } _record(ok);
    }
    function actionMerchantUpdateListingWhole(uint16 raw) external { if (!hasMerchantListing) { _record(false); return; } (bool ok,) = address(boostMerchant).call(abi.encodeWithSignature("refreshMarketplaceListing(uint256,uint256)", merchantListingId, _whole(raw, 1, 100, 1e18))); _record(ok); }
    function actionMerchantCancelListing(uint16) external { if (!hasMerchantListing) { _record(false); return; } (bool ok,) = address(boostMerchant).call(abi.encodeWithSignature("cancelMarketplaceListing(uint256)", merchantListingId)); if (ok) hasMerchantListing = false; _record(ok); }
    function actionMerchantAcceptOfferWhole(uint16 raw) external { (bool ok,) = address(boostMerchant).call(abi.encodeWithSignature("fillProfitableOffer(uint256,uint256,uint256,uint256)", uint256(raw), _whole(raw, 1, 100, 1e18), 0, uint256(52))); _record(ok); }

    function actionGovReserveWhole(uint16 raw) external {
        if (hasGovernanceReservation) { _record(false); return; } uint256 amount = _whole(raw, 1, 100, 1e18); uint256 executableAt = block.timestamp + 1 days;
        (bool ok, bytes memory result) = address(governanceToken).call(abi.encodeWithSignature("reserveMint(uint256,uint256)", amount, executableAt));
        if (ok && result.length >= 32) { governanceReservationId = abi.decode(result, (uint256)); governanceReservationAmount = amount; governanceReservationExecutableAt = executableAt; hasGovernanceReservation = true; } _record(ok);
    }
    function actionGovIncreaseReservationWhole(uint16 raw) external {
        if (!hasGovernanceReservation) { _record(false); return; } uint256 requested = governanceReservationAmount + _whole(raw, 1, 25, 1e18);
        (bool ok, bytes memory result) = address(governanceToken).call(abi.encodeWithSignature("increaseMintReservationUpTo(uint256,uint256,uint256)", governanceReservationId, requested, governanceReservationExecutableAt));
        if (ok && result.length >= 64) { (uint256 resultingId, uint256 added) = abi.decode(result, (uint256, uint256)); governanceReservationId = resultingId; governanceReservationAmount += added; } _record(ok);
    }
    function actionGovCancelReservation(uint16) external { if (!hasGovernanceReservation) { _record(false); return; } (bool ok,) = address(governanceToken).call(abi.encodeWithSignature("cancelMintReservation(uint256)", governanceReservationId)); if (ok) hasGovernanceReservation = false; _record(ok); }
    function actionGovMintReserved(uint16) external {
        if (!hasGovernanceReservation) { _record(false); return; } if (block.timestamp < governanceReservationExecutableAt) VM.warp(governanceReservationExecutableAt);
        (bool ok,) = address(governanceToken).call(abi.encodeWithSignature("mintReserved(uint256,address,uint256)", governanceReservationId, address(this), governanceReservationAmount)); if (ok) hasGovernanceReservation = false; _record(ok);
    }
    function actionMintControllerOneTimeWhole(uint16 raw) external { (bool ok,) = address(mintController).call(abi.encodeWithSignature("proposeOneTimeGovernanceMint(uint256)", _whole(raw, 1, 100, 1e18))); _record(ok); }
    function actionMintControllerPeriodicWhole(uint16 raw) external { (bool ok,) = address(mintController).call(abi.encodeWithSignature("proposePeriodicGovernanceMint(uint256,uint256)", _whole(raw, 1, 100, 1e18), uint256(7 days + (raw % 24) * 1 days))); _record(ok); }
    function actionMintControllerCancelPeriodic() external { (bool ok,) = address(mintController).call(abi.encodeWithSignature("cancelPeriodicGovernanceMintConfig()")); _record(ok); }

    function actionYieldStakeWhole(uint16 raw) external {
        Phase6TokenActorV5 a = _tokenActor(_actorIndex(msg.sender)); uint256 bal = exactCyvlSdt.balanceOf(address(a)); if (bal < 1e18) { _record(false); return; }
        uint256 amount = _whole(raw, 1, bal / 1e18, 1e18); (bool ok,) = a.execute(address(yieldStaking), abi.encodeWithSignature("stake(uint256)", amount)); _record(ok);
    }
    function actionYieldWithdrawWhole(uint16 raw) external {
        Phase6TokenActorV5 a = _tokenActor(_actorIndex(msg.sender)); uint256 shares = yieldStaking.userShares(address(a)); if (shares < 1e18) { _record(false); return; }
        uint256 amount = _whole(raw, 1, shares / 1e18, 1e18); (bool ok,) = a.execute(address(yieldStaking), abi.encodeWithSignature("withdraw(uint256,address)", amount, address(a))); _record(ok);
    }
    function actionYieldWithdrawAll(uint16 raw) external { Phase6TokenActorV5 a = _tokenActor(uint256(raw) % 3); (bool ok,) = a.execute(address(yieldStaking), abi.encodeWithSignature("withdrawAll(address)", address(a))); _record(ok); }
    function actionYieldClaim(uint16 raw) external { Phase6TokenActorV5 a = _tokenActor(uint256(raw) % 3); (bool ok,) = a.execute(address(yieldStaking), abi.encodeWithSignature("claim(address)", address(a))); _record(ok); }
    function actionYieldCheckpoint() external { (bool ok,) = address(yieldStaking).call(abi.encodeWithSignature("checkpoint()")); _record(ok); }
    function actionYieldConfigControlled(uint16 raw) external {
        bool branch = (raw & 1) == 0; (bool ok,) = address(yieldStaking).call(branch ? abi.encodeWithSignature("setWithdrawFeeBps(uint256)", uint256(raw) % 401) : abi.encodeWithSignature("setDailyDecayRate(uint256)", uint256(raw) % 11)); _record(ok);
    }

    function actionTokenTransferWhole(uint16 raw) external {
        uint256 i = _actorIndex(msg.sender); Phase6TokenActorV5 from = _tokenActor(i); Phase6TokenActorV5 to = _tokenActor((i + 1) % 3); uint256 bal = exactCyvlSdt.balanceOf(address(from)); if (bal < 1e18) { _record(false); return; }
        (bool ok,) = from.execute(address(exactCyvlSdt), abi.encodeWithSignature("transfer(address,uint256)", address(to), _whole(raw, 1, bal / 1e18, 1e18))); _record(ok);
    }
    function actionTokenApproveWhole(uint16 raw) external { uint256 i = _actorIndex(msg.sender); Phase6TokenActorV5 from = _tokenActor(i); Phase6TokenActorV5 spender = _tokenActor((i + 1) % 3); (bool ok,) = from.execute(address(exactCyvlSdt), abi.encodeWithSignature("approve(address,uint256)", address(spender), _whole(raw, 1, 1000, 1e18))); _record(ok); }
    function actionTokenTransferFromWhole(uint16 raw) external {
        uint256 i = _actorIndex(msg.sender); Phase6TokenActorV5 ownerActor = _tokenActor(i); Phase6TokenActorV5 spender = _tokenActor((i + 1) % 3); Phase6TokenActorV5 receiver = _tokenActor((i + 2) % 3); uint256 allowance = exactCyvlSdt.allowance(address(ownerActor), address(spender)); uint256 bal = exactCyvlSdt.balanceOf(address(ownerActor)); uint256 maxAmount = allowance < bal ? allowance : bal;
        if (maxAmount < 1e18) { _record(false); return; } (bool ok,) = spender.execute(address(exactCyvlSdt), abi.encodeWithSignature("transferFrom(address,address,uint256)", address(ownerActor), address(receiver), _whole(raw, 1, maxAmount / 1e18, 1e18))); _record(ok);
    }
    function actionTokenBurnWhole(uint16 raw) external { Phase6TokenActorV5 a = _tokenActor(_actorIndex(msg.sender)); uint256 bal = exactCyvlSdt.balanceOf(address(a)); if (bal < 1e18) { _record(false); return; } (bool ok,) = a.execute(address(exactCyvlSdt), abi.encodeWithSignature("burn(uint256)", _whole(raw, 1, bal / 1e18, 1e18))); _record(ok); }
    function actionRevenueConvertWhole(uint16 raw) external {
        uint256 amount = _whole(raw, 1, 1000, 1e18); fakeSdt.mint(address(this), amount); uint256 beforeBal = principal.balanceOf(address(directA));
        (bool ok,) = address(revenueConverter).call(abi.encodeWithSignature("convert(address,uint256,uint256,address,uint256)", address(fakeSdt), amount, 0, address(directA), block.timestamp + 1 days));
        if (ok) require(principal.balanceOf(address(directA)) >= beforeBal, "CONVERT_DIRECTION"); _record(ok);
    }
    function actionRevenueRouteControlled(uint16 raw) external {
        address route = (raw & 1) == 0 ? address(fakeUsdToSdtAdapter) : address(usdcToSdtConverter); (bool ok,) = address(revenueConverter).call(abi.encodeWithSignature("setUsdcRoute(address,address)", address(fakeYieldToken), route));
        if (ok && route != address(fakeUsdToSdtAdapter)) { (bool restored,) = address(revenueConverter).call(abi.encodeWithSignature("setUsdcRoute(address,address)", address(fakeYieldToken), address(fakeUsdToSdtAdapter))); ok = restored; } _record(ok);
    }

    function actionFraxswapPrimaryBuyWhole(uint16 raw) external { Phase6TokenActorV5 a = _tokenActor(_actorIndex(msg.sender)); (bool ok,) = a.execute(address(fraxswapConverter), abi.encodeWithSignature("buyPrimary(uint256,uint256,uint256)", _whole(raw, 1, 100, 1e18), 0, block.timestamp + 1 days)); _record(ok); }
    function actionFraxswapPrimarySellWhole(uint16 raw) external { Phase6TokenActorV5 a = _tokenActor(_actorIndex(msg.sender)); (bool ok,) = a.execute(address(fraxswapConverter), abi.encodeWithSignature("sellPrimary(uint256,uint256,uint256)", _whole(raw, 1, 100, 1e18), 0, block.timestamp + 1 days)); _record(ok); }
    function actionFraxswapFeeConfigControlled(uint16 raw) external { (bool ok,) = address(fraxswapConverter).call(abi.encodeWithSignature("setFeeExempt(address,bool)", address(_tokenActor(uint256(raw) % 3)), (raw & 1) == 0)); _record(ok); }
    function actionDiscountedSalePrimarySellWhole(uint16 raw) external { Phase6TokenActorV5 a = _tokenActor(_actorIndex(msg.sender)); (bool ok,) = a.execute(address(discountedSaleConverter), abi.encodeWithSignature("sellPrimary(uint256,uint256,uint256)", _whole(raw, 1, 100, 1e18), 0, block.timestamp + 1 days)); _record(ok); }
    function actionDiscountedSaleCheckpoint() external { (bool ok,) = address(discountedSaleConverter).call(abi.encodeWithSignature("checkpoint(address)", address(_tokenActor(_actorIndex(msg.sender))))); _record(ok); }
    function actionDiscountedSaleConverterControlled(uint16 raw) external { uint256 rate = 50 + uint256(raw) % 2951; (bool ok,) = address(discountedSaleConverter).call(abi.encodeWithSignature("setAnnualBaseCreditRate(uint256)", rate)); _record(ok); }

    function property_principal_conservation() public view returns (bool) {
        uint256 active = expectedDirectA + expectedDirectB + expectedDirectC + expectedStrategy;
        uint256 queued = expectedQueuedA + expectedQueuedB + expectedQueuedC;
        return _principalKnownBalances() == principal.totalSupply()
            && revenueStaking.totalActiveStake() == active
            && revenueStaking.totalQueuedStake() == queued
            && active + queued <= principal.balanceOf(address(revenueStaking));
    }
    function property_reward_source_conservation() public view returns (bool) {
        return totalRevenueInjected == vlSdtRevenueInjected + merchantRevenueInjected
            && fakeStakeDaoRouter.totalDelivered() <= fakeStakeDaoRouter.totalSeeded()
            && _fakeYieldKnownBalances() == fakeYieldToken.totalSupply()
            && fakeYieldToken.totalSupply() == fakeYieldMinted;
    }
    function property_reward_claim_conservation() public view returns (bool) { return totalRevenueClaimed <= totalRevenueInjected; }
    function property_vault_share_supply_reconciles() public view returns (bool) {
        uint256 known = vault.balanceOf(address(this)) + vault.balanceOf(address(directA)) + vault.balanceOf(address(directB)) + vault.balanceOf(address(directC)) + vault.balanceOf(address(merchantBuyer));
        return known == vault.totalSupply();
    }
    function property_strategy_stake_reconciles() public view returns (bool) { return revenueStaking.activeBalance(address(strategy)) == expectedStrategy; }
    function property_boost_capacity_reconciles() public view returns (bool) {
        if (boostStaking.totalDeposited() > principal.balanceOf(address(boostStaking))) return false;
        (bool okC, bytes memory c) = address(locker).staticcall(abi.encodeWithSignature("boostStakingBoostCapacity()"));
        (bool okU, bytes memory u) = address(locker).staticcall(abi.encodeWithSignature("boostStakingBoostUsed()"));
        if (okC && okU && c.length >= 32 && u.length >= 32) return abi.decode(u, (uint256)) <= abi.decode(c, (uint256));
        return true;
    }
    function property_governance_reservations_reconcile() public view returns (bool) {
        uint256 supply = governanceToken.totalSupply(); uint256 cap_ = governanceToken.cap(); if (supply > cap_) return false;
        (bool ok, bytes memory result) = address(governanceToken).staticcall(abi.encodeWithSignature("totalReservedMint()"));
        if (ok && result.length >= 32) return abi.decode(result, (uint256)) <= cap_ - supply;
        return true;
    }
    function property_converter_flow_conservation() public view returns (bool) {
        return fakeUsdToSdtAdapter.totalOutput() == fakeUsdToSdtAdapter.totalInput() * 1e12
            && fakeSdtToPrincipalAdapter.totalOutput() == fakeSdtToPrincipalAdapter.totalInput();
    }
    function property_exact_token_conservation() public view returns (bool) {
        uint256 known = exactCyvlSdt.balanceOf(address(this)) + exactCyvlSdt.balanceOf(address(tokenA)) + exactCyvlSdt.balanceOf(address(tokenB)) + exactCyvlSdt.balanceOf(address(tokenC)) + exactCyvlSdt.balanceOf(address(yieldStaking));
        return known == exactCyvlSdt.totalSupply();
    }
    function property_transition_accounting_consistent() public view returns (bool) { return successfulTransitions + revertedTransitions == actionCalls; }
}

contract CyvlSdtBroadSystemAccountingFoundryV5 {
    CyvlSdtBroadSystemAccountingHarnessV5 public harness;
    function setUp() public { harness = new CyvlSdtBroadSystemAccountingHarnessV5(); }
    function testWholeNumberMultiSourceRevenueAccountingV5() public { harness.testWholeNumberMultiSourceRevenueAccountingV5(); }
    function targetContracts() public view returns (address[] memory targets) { targets = new address[](1); targets[0] = address(harness); }
    function targetSenders() public pure returns (address[] memory senders) {
        senders = new address[](4); senders[0] = address(0x10000); senders[1] = address(0x20000); senders[2] = address(0x30000); senders[3] = address(0x40000);
    }
    function invariant_accounting_reconciles() public view {
        require(harness.property_principal_conservation(), "PRINCIPAL");
        require(harness.property_reward_source_conservation(), "REWARD_SOURCE");
        require(harness.property_reward_claim_conservation(), "REWARD_CLAIM");
        require(harness.property_vault_share_supply_reconciles(), "VAULT_SHARES");
        require(harness.property_strategy_stake_reconciles(), "STRATEGY");
        require(harness.property_boost_capacity_reconciles(), "BOOST");
        require(harness.property_governance_reservations_reconcile(), "GOV");
        require(harness.property_converter_flow_conservation(), "CONVERTER");
        require(harness.property_transition_accounting_consistent(), "TRANSITIONS");
    }
}
