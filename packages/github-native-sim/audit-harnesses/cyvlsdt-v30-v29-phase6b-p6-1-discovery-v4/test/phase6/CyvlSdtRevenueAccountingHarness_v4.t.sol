// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {CurveYieldGovernanceToken} from "contracts/CurveYieldGovernanceToken.sol";
import {CurveYieldVlSDTRevenueStaking} from "contracts/CurveYieldVlSDTRevenueStaking.sol";
import {CurveYieldVlSDTLocker} from "contracts/CurveYieldVlSDTLocker.sol";
import {CurveYieldVlSDTBoostStaking} from "contracts/CurveYieldVlSDTBoostStaking.sol";
import {CurveYieldVlSDTBoostMerchant} from "contracts/CurveYieldVlSDTBoostMerchant.sol";
import {CurveYieldVault} from "contracts/CurveYieldVault.sol";
import {CurveYieldRevenueStrategyV7} from "contracts/CurveYieldRevenueStrategyV20.sol";
import {CurveYieldRevenueConverter} from "contracts/CurveYieldRevenueConverter.sol";
import {CurveYieldUsdcToSdtConverter} from "contracts/CurveYieldUsdcToSdtConverter.sol";

interface VmV4 {
    function warp(uint256) external;
}

contract Phase6MintableTokenV4 is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) { return _tokenDecimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract Phase6FakeFeeDistributorV4 {
    address public immutable rewardToken;
    constructor(address rewardToken_) { rewardToken = rewardToken_; }
    function REWARD_TOKEN() external view returns (address) { return rewardToken; }
}

contract Phase6FakeStakeDaoRouterV4 {
    using SafeERC20 for IERC20;

    IERC20 public immutable yieldToken;
    uint256 public pendingYield;
    uint256 public totalSeeded;
    uint256 public totalDelivered;

    constructor(address yieldToken_) { yieldToken = IERC20(yieldToken_); }

    function seedYield(uint256 amount) external {
        pendingYield += amount;
        totalSeeded += amount;
    }

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

contract Phase6FakeMarketplaceV4 {}

contract Phase6FakeSwapAdapterV4 {
    using SafeERC20 for IERC20;

    address public immutable tokenIn;
    Phase6MintableTokenV4 public immutable tokenOut;
    uint256 public immutable numerator;
    uint256 public immutable denominator;
    uint256 public totalInput;
    uint256 public totalOutput;

    constructor(address tokenIn_, address tokenOut_, uint256 numerator_, uint256 denominator_) {
        require(tokenIn_ != address(0) && tokenOut_ != address(0), "ADAPTER_ZERO");
        require(numerator_ != 0 && denominator_ != 0, "ADAPTER_SCALE");
        tokenIn = tokenIn_;
        tokenOut = Phase6MintableTokenV4(tokenOut_);
        numerator = numerator_;
        denominator = denominator_;
    }

    function quote(address inToken, address outToken, uint256 amountIn) external view returns (uint256) {
        require(inToken == tokenIn && outToken == address(tokenOut), "ADAPTER_PAIR");
        return amountIn * numerator / denominator;
    }

    function swap(
        address inToken,
        address outToken,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "ADAPTER_EXPIRED");
        require(inToken == tokenIn && outToken == address(tokenOut), "ADAPTER_PAIR");
        amountOut = amountIn * numerator / denominator;
        require(amountOut >= minOut, "ADAPTER_MIN_OUT");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        tokenOut.mint(recipient, amountOut);
        totalInput += amountIn;
        totalOutput += amountOut;
    }
}

contract Phase6RevenueActorV4 {
    address public immutable controller;

    constructor(
        address controller_,
        address principal_,
        address paymentToken_,
        address revenueStaking_,
        address vault_,
        address boostMerchant_
    ) {
        controller = controller_;
        IERC20(principal_).approve(revenueStaking_, type(uint256).max);
        IERC20(principal_).approve(vault_, type(uint256).max);
        IERC20(paymentToken_).approve(boostMerchant_, type(uint256).max);
    }

    function execute(address target, bytes calldata data) external returns (bool ok, bytes memory result) {
        require(msg.sender == controller, "ACTOR_CONTROLLER");
        (ok, result) = target.call(data);
    }
}

contract CyvlSdtRevenueAccountingHarnessV4 {
    using SafeERC20 for IERC20;

    VmV4 private constant VM = VmV4(address(uint160(uint256(keccak256("hevm cheat code")))));

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

    Phase6MintableTokenV4 public immutable principal;
    Phase6MintableTokenV4 public immutable fakeYieldToken;
    Phase6MintableTokenV4 public immutable fakeSdt;
    Phase6MintableTokenV4 public immutable fakeVlSdt;
    Phase6MintableTokenV4 public immutable fakeVlBoost;
    CurveYieldGovernanceToken public immutable governanceToken;

    Phase6FakeFeeDistributorV4 public immutable fakeUsdcFeeDistributor;
    Phase6FakeFeeDistributorV4 public immutable fakeSdtFeeDistributor;
    Phase6FakeStakeDaoRouterV4 public immutable fakeStakeDaoRouter;
    Phase6FakeMarketplaceV4 public immutable fakeMarketplace;
    Phase6FakeSwapAdapterV4 public immutable fakeUsdToSdtAdapter;
    Phase6FakeSwapAdapterV4 public immutable fakeSdtToPrincipalAdapter;

    CurveYieldVlSDTRevenueStaking public immutable revenueStaking;
    CurveYieldVlSDTLocker public immutable locker;
    CurveYieldVlSDTBoostStaking public immutable boostStaking;
    CurveYieldVlSDTBoostMerchant public immutable boostMerchant;
    CurveYieldVault public immutable vault;
    CurveYieldRevenueStrategyV7 public immutable strategy;
    CurveYieldRevenueConverter public immutable revenueConverter;
    CurveYieldUsdcToSdtConverter public immutable usdcToSdtConverter;

    Phase6RevenueActorV4 public immutable directA;
    Phase6RevenueActorV4 public immutable directB;
    Phase6RevenueActorV4 public immutable directC;
    Phase6RevenueActorV4 public immutable merchantBuyer;

    uint256 public expectedDirectA;
    uint256 public expectedDirectB;
    uint256 public expectedDirectC;
    uint256 public expectedStrategy;
    uint256 public expectedQueuedA;
    uint256 public expectedQueuedB;
    uint256 public expectedQueuedC;

    uint256 public expectedRewardA;
    uint256 public expectedRewardB;
    uint256 public expectedRewardC;
    uint256 public expectedRewardStrategy;

    uint256 public vlSdtRevenueInjected;
    uint256 public merchantRevenueInjected;
    uint256 public totalRevenueInjected;
    uint256 public totalRevenueClaimed;
    uint256 public fakeYieldMinted;

    uint256 public successfulTransitions;
    uint256 public revertedTransitions;
    uint256 public revenueStakeCalls;
    uint256 public revenueWithdrawCalls;
    uint256 public queueWithdrawalCalls;
    uint256 public completeQueuedWithdrawalCalls;
    uint256 public vaultDepositCalls;
    uint256 public vaultEarnCalls;
    uint256 public vlSdtYieldGenerationCalls;
    uint256 public merchantLeaseCalls;
    uint256 public startRewardCycleCalls;
    uint256 public claimRewardCalls;
    uint256 public harvestCalls;
    uint256 public vaultWithdrawCalls;

    uint256[3] public pendingWithdrawalId;
    uint256[3] public pendingWithdrawalAmount;
    bool[3] public hasPendingWithdrawal;
    bool public deterministicScenarioRun;

    constructor() {
        principal = new Phase6MintableTokenV4("Audit cyvlSDT Principal", "aCYVL", 18);
        fakeYieldToken = new Phase6MintableTokenV4("Audit USDC Yield", "aUSDC", 6);
        fakeSdt = new Phase6MintableTokenV4("Audit SDT", "aSDT", 18);
        fakeVlSdt = new Phase6MintableTokenV4("Audit vlSDT", "avlSDT", 18);
        fakeVlBoost = new Phase6MintableTokenV4("Audit vlBoost", "avlBOOST", 18);
        governanceToken = new CurveYieldGovernanceToken(address(this), "Audit Governance", "aCYGOV");

        fakeUsdcFeeDistributor = new Phase6FakeFeeDistributorV4(address(fakeYieldToken));
        fakeSdtFeeDistributor = new Phase6FakeFeeDistributorV4(address(fakeSdt));
        fakeStakeDaoRouter = new Phase6FakeStakeDaoRouterV4(address(fakeYieldToken));
        fakeMarketplace = new Phase6FakeMarketplaceV4();

        revenueStaking = new CurveYieldVlSDTRevenueStaking(
            address(this), address(this), address(this), address(principal), address(governanceToken)
        );

        locker = new CurveYieldVlSDTLocker(
            address(this),
            address(this),
            address(fakeSdt),
            address(fakeVlSdt),
            address(fakeVlBoost),
            address(fakeStakeDaoRouter),
            address(fakeUsdcFeeDistributor),
            address(fakeSdtFeeDistributor),
            address(fakeMarketplace),
            address(principal)
        );

        boostStaking = new CurveYieldVlSDTBoostStaking(
            address(this), address(principal), address(governanceToken), address(locker)
        );
        boostMerchant = new CurveYieldVlSDTBoostMerchant(
            address(this), address(locker), address(revenueStaking), address(fakeMarketplace)
        );
        locker.configureSystem(address(revenueStaking), address(boostMerchant), address(boostStaking));

        revenueConverter = new CurveYieldRevenueConverter(
            address(this), address(fakeSdt), address(principal), address(locker)
        );
        fakeUsdToSdtAdapter = new Phase6FakeSwapAdapterV4(
            address(fakeYieldToken), address(fakeSdt), 1e12, 1
        );
        fakeSdtToPrincipalAdapter = new Phase6FakeSwapAdapterV4(
            address(fakeSdt), address(principal), 1, 1
        );
        revenueConverter.setSdtSwapAdapter(address(fakeSdtToPrincipalAdapter));
        revenueConverter.setUsdcRoute(address(fakeYieldToken), address(fakeUsdToSdtAdapter));

        usdcToSdtConverter = new CurveYieldUsdcToSdtConverter(
            address(revenueConverter),
            CANONICAL_USDC,
            CANONICAL_WBTC,
            CANONICAL_WETH,
            CANONICAL_SDT,
            TRICRYPTO_USDC,
            SDT_WETH_POOL
        );

        vault = new CurveYieldVault(
            "Audit Revenue Vault", "aRV", address(this), address(this), 18
        );
        strategy = new CurveYieldRevenueStrategyV7(
            address(vault),
            address(principal),
            address(revenueStaking),
            address(governanceToken),
            address(fakeSdt),
            address(revenueConverter),
            address(this),
            0,
            0,
            0
        );
        vault.setStrategy(address(strategy));

        revenueStaking.setImmediateWithdrawFeeBps(0);
        revenueStaking.setExcessTreasuryBps(0);
        revenueStaking.addRewardToken(address(fakeYieldToken));
        revenueStaking.addRewardToken(address(fakeSdt));
        revenueStaking.setNotifier(address(locker), true);
        revenueStaking.setNotifier(address(boostMerchant), true);

        boostMerchant.setMinimumLeaseBoost(1e18);
        boostMerchant.setPaymentToken(address(fakeYieldToken), true, 2e6, 2e6);

        fakeVlSdt.mint(address(locker), 100_000e18);
        fakeVlBoost.mint(address(locker), 100_000e18);

        directA = new Phase6RevenueActorV4(
            address(this), address(principal), address(fakeYieldToken), address(revenueStaking), address(vault), address(boostMerchant)
        );
        directB = new Phase6RevenueActorV4(
            address(this), address(principal), address(fakeYieldToken), address(revenueStaking), address(vault), address(boostMerchant)
        );
        directC = new Phase6RevenueActorV4(
            address(this), address(principal), address(fakeYieldToken), address(revenueStaking), address(vault), address(boostMerchant)
        );
        merchantBuyer = new Phase6RevenueActorV4(
            address(this), address(principal), address(fakeYieldToken), address(revenueStaking), address(vault), address(boostMerchant)
        );

        principal.approve(address(vault), type(uint256).max);
        principal.mint(address(directA), 50_000e18);
        principal.mint(address(directB), 50_000e18);
        principal.mint(address(directC), 50_000e18);
        principal.mint(address(this), 50_000e18);

        fakeYieldToken.mint(address(merchantBuyer), 1_000_000e6);
        fakeYieldMinted += 1_000_000e6;

        _initializeBaseline();
    }

    function _requireActorCall(Phase6RevenueActorV4 actor, address target, bytes memory data)
        internal
        returns (bytes memory result)
    {
        (bool ok, bytes memory returned) = actor.execute(target, data);
        require(ok, "BASELINE_ACTOR_CALL");
        return returned;
    }

    function _initializeBaseline() internal {
        _requireActorCall(
            directA, address(revenueStaking), abi.encodeWithSignature("stake(uint256)", DIRECT_STAKE_A)
        );
        expectedDirectA = DIRECT_STAKE_A;
        _verifyAccountingCheckpoint();

        _requireActorCall(
            directB, address(revenueStaking), abi.encodeWithSignature("stake(uint256)", DIRECT_STAKE_B)
        );
        expectedDirectB = DIRECT_STAKE_B;
        _verifyAccountingCheckpoint();

        _requireActorCall(
            directC, address(revenueStaking), abi.encodeWithSignature("stake(uint256)", DIRECT_STAKE_C)
        );
        expectedDirectC = DIRECT_STAKE_C;
        _verifyAccountingCheckpoint();

        vault.deposit(VAULT_DEPOSIT);
        _verifyAccountingCheckpoint();
        vault.earn();
        expectedStrategy = VAULT_DEPOSIT;
        require(revenueStaking.totalActiveStake() == BASELINE_TOTAL_ACTIVE, "BASELINE_TOTAL_ACTIVE");
        _verifyAccountingCheckpoint();
    }

    function _actorIndex(address sender) internal pure returns (uint256) { return uint160(sender) % 3; }

    function _actorByIndex(uint256 index) internal view returns (Phase6RevenueActorV4 actor) {
        if (index == 0) return directA;
        if (index == 1) return directB;
        return directC;
    }

    function _activeExpected(uint256 index) internal view returns (uint256) {
        if (index == 0) return expectedDirectA;
        if (index == 1) return expectedDirectB;
        return expectedDirectC;
    }

    function _queuedExpected(uint256 index) internal view returns (uint256) {
        if (index == 0) return expectedQueuedA;
        if (index == 1) return expectedQueuedB;
        return expectedQueuedC;
    }

    function _setActiveExpected(uint256 index, uint256 amount) internal {
        if (index == 0) expectedDirectA = amount;
        else if (index == 1) expectedDirectB = amount;
        else expectedDirectC = amount;
    }

    function _setQueuedExpected(uint256 index, uint256 amount) internal {
        if (index == 0) expectedQueuedA = amount;
        else if (index == 1) expectedQueuedB = amount;
        else expectedQueuedC = amount;
    }

    function _whole(uint16 raw, uint256 minWhole, uint256 maxWhole, uint256 unit) internal pure returns (uint256) {
        uint256 span = maxWhole - minWhole + 1;
        return (minWhole + uint256(raw) % span) * unit;
    }

    function _record(bool ok) internal {
        if (ok) {
            successfulTransitions++;
            _verifyAccountingCheckpoint();
        } else {
            revertedTransitions++;
        }
    }

    function _verifyAccountingCheckpoint() internal view {
        require(revenueStaking.activeBalance(address(directA)) == expectedDirectA, "ACCOUNT_ACTIVE_A");
        require(revenueStaking.activeBalance(address(directB)) == expectedDirectB, "ACCOUNT_ACTIVE_B");
        require(revenueStaking.activeBalance(address(directC)) == expectedDirectC, "ACCOUNT_ACTIVE_C");
        require(revenueStaking.activeBalance(address(strategy)) == expectedStrategy, "ACCOUNT_ACTIVE_STRATEGY");
        require(revenueStaking.queuedBalance(address(directA)) == expectedQueuedA, "ACCOUNT_QUEUED_A");
        require(revenueStaking.queuedBalance(address(directB)) == expectedQueuedB, "ACCOUNT_QUEUED_B");
        require(revenueStaking.queuedBalance(address(directC)) == expectedQueuedC, "ACCOUNT_QUEUED_C");

        uint256 expectedActive = expectedDirectA + expectedDirectB + expectedDirectC + expectedStrategy;
        uint256 expectedQueued = expectedQueuedA + expectedQueuedB + expectedQueuedC;
        require(revenueStaking.totalActiveStake() == expectedActive, "ACCOUNT_TOTAL_ACTIVE");
        require(revenueStaking.totalQueuedStake() == expectedQueued, "ACCOUNT_TOTAL_QUEUED");
        require(
            expectedActive + expectedQueued <= principal.balanceOf(address(revenueStaking)),
            "ACCOUNT_PRINCIPAL_BACKING"
        );

        uint256 knownVaultShares = vault.balanceOf(address(this))
            + vault.balanceOf(address(directA))
            + vault.balanceOf(address(directB))
            + vault.balanceOf(address(directC))
            + vault.balanceOf(address(merchantBuyer));
        require(vault.totalSupply() == knownVaultShares, "ACCOUNT_VAULT_SHARES");
        require(totalRevenueInjected == vlSdtRevenueInjected + merchantRevenueInjected, "ACCOUNT_REVENUE_SOURCES");
        require(totalRevenueClaimed <= totalRevenueInjected, "ACCOUNT_REVENUE_CLAIMS");
    }

    function _fakeYieldKnownBalances() internal view returns (uint256 total) {
        total += fakeYieldToken.balanceOf(address(fakeStakeDaoRouter));
        total += fakeYieldToken.balanceOf(address(locker));
        total += fakeYieldToken.balanceOf(address(revenueStaking));
        total += fakeYieldToken.balanceOf(address(boostMerchant));
        total += fakeYieldToken.balanceOf(address(strategy));
        total += fakeYieldToken.balanceOf(address(revenueConverter));
        total += fakeYieldToken.balanceOf(address(fakeUsdToSdtAdapter));
        total += fakeYieldToken.balanceOf(address(directA));
        total += fakeYieldToken.balanceOf(address(directB));
        total += fakeYieldToken.balanceOf(address(directC));
        total += fakeYieldToken.balanceOf(address(merchantBuyer));
        total += fakeYieldToken.balanceOf(address(this));
    }

    function _injectVlSdtYield(uint256 amount) internal returns (uint256 streamCountBefore, uint256 credited) {
        streamCountBefore = revenueStaking.streamCount(address(fakeYieldToken));
        fakeYieldToken.mint(address(fakeStakeDaoRouter), amount);
        fakeYieldMinted += amount;
        fakeStakeDaoRouter.seedYield(amount);

        uint256 stakingBefore = fakeYieldToken.balanceOf(address(revenueStaking));
        locker.claimVlSDTRewards();
        uint256 stakingAfter = fakeYieldToken.balanceOf(address(revenueStaking));
        credited = stakingAfter - stakingBefore;
        require(credited != 0, "VLSDT_REVENUE_ZERO");
        vlSdtRevenueInjected += credited;
        totalRevenueInjected += credited;
    }

    function _injectMerchantRevenue(uint256 boostAmount)
        internal
        returns (uint256 streamCountBefore, uint256 credited)
    {
        streamCountBefore = revenueStaking.streamCount(address(fakeYieldToken));
        (,, uint256 totalPayment) = boostMerchant.quoteLease(address(fakeYieldToken), boostAmount, 1);
        require(totalPayment != 0, "MERCHANT_QUOTE_ZERO");
        fakeYieldToken.mint(address(merchantBuyer), totalPayment);
        fakeYieldMinted += totalPayment;

        uint256 stakingBefore = fakeYieldToken.balanceOf(address(revenueStaking));
        bytes memory result = _requireActorCall(
            merchantBuyer,
            address(boostMerchant),
            abi.encodeWithSignature(
                "leaseBoost(address,uint256,uint256,address,uint256,uint256)",
                address(fakeYieldToken),
                boostAmount,
                1,
                address(merchantBuyer),
                totalPayment,
                block.timestamp + 1 days
            )
        );
        (uint256 payment,) = abi.decode(result, (uint256, uint256));
        require(payment == totalPayment, "MERCHANT_PAYMENT_RETURN");
        credited = fakeYieldToken.balanceOf(address(revenueStaking)) - stakingBefore;
        require(credited == totalPayment, "MERCHANT_REVENUE_CREDIT");
        merchantRevenueInjected += credited;
        totalRevenueInjected += credited;
    }

    function _settleNewRewardStream(uint256 streamCountBefore) internal returns (uint256 cycleAmount) {
        uint256 count = revenueStaking.streamCount(address(fakeYieldToken));
        if (count == streamCountBefore) {
            if (!revenueStaking.canStartRewardCycle(address(fakeYieldToken))) {
                uint256 readyAt = revenueStaking.nextCycleReadyAt(address(fakeYieldToken));
                if (readyAt > block.timestamp) VM.warp(readyAt);
            }
            require(revenueStaking.canStartRewardCycle(address(fakeYieldToken)), "CYCLE_NOT_READY");
            cycleAmount = revenueStaking.startRewardCycle(address(fakeYieldToken));
            count = revenueStaking.streamCount(address(fakeYieldToken));
            require(count == streamCountBefore + 1, "CYCLE_STREAM_NOT_ADDED");
        }

        require(count == streamCountBefore + 1, "CYCLE_STREAM_COUNT");
        CurveYieldVlSDTRevenueStaking.Stream memory stream = revenueStaking.getStream(
            address(fakeYieldToken), streamCountBefore
        );
        if (cycleAmount == 0) cycleAmount = stream.amount;
        require(cycleAmount == stream.amount && cycleAmount != 0, "CYCLE_AMOUNT");
        if (block.timestamp <= uint256(stream.end)) VM.warp(uint256(stream.end) + 1);
    }

    function _addExpectedRewards(uint256 cycleAmount) internal {
        uint256 totalActive = expectedDirectA + expectedDirectB + expectedDirectC + expectedStrategy;
        require(totalActive != 0, "EXPECTED_ACTIVE_ZERO");
        expectedRewardA += cycleAmount * expectedDirectA / totalActive;
        expectedRewardB += cycleAmount * expectedDirectB / totalActive;
        expectedRewardC += cycleAmount * expectedDirectC / totalActive;
        expectedRewardStrategy += cycleAmount * expectedStrategy / totalActive;
    }

    function _claimExpected(Phase6RevenueActorV4 actor, uint256 expected) internal returns (uint256 claimed) {
        uint256 beforeBalance = fakeYieldToken.balanceOf(address(actor));
        _requireActorCall(actor, address(revenueStaking), abi.encodeWithSignature("claimRewardsSelf()"));
        claimed = fakeYieldToken.balanceOf(address(actor)) - beforeBalance;
        require(claimed == expected, "DIRECT_REWARD_WEIGHT");
        totalRevenueClaimed += claimed;
    }

    function testWholeNumberMultiSourceRevenueAccounting() external {
        require(!deterministicScenarioRun, "DETERMINISTIC_ALREADY_RUN");
        deterministicScenarioRun = true;
        require(expectedDirectA == DIRECT_STAKE_A, "DETERMINISTIC_A");
        require(expectedDirectB == DIRECT_STAKE_B, "DETERMINISTIC_B");
        require(expectedDirectC == DIRECT_STAKE_C, "DETERMINISTIC_C");
        require(expectedStrategy == VAULT_DEPOSIT, "DETERMINISTIC_STRATEGY");
        require(revenueStaking.totalActiveStake() == BASELINE_TOTAL_ACTIVE, "DETERMINISTIC_TOTAL");
        _verifyAccountingCheckpoint();

        (uint256 firstStreamBefore, uint256 firstCredit) = _injectVlSdtYield(VLSDT_FEE_REWARD);
        require(firstCredit == VLSDT_FEE_REWARD, "DETERMINISTIC_VLSDT_REVENUE");
        _verifyAccountingCheckpoint();
        uint256 firstCycle = _settleNewRewardStream(firstStreamBefore);
        _addExpectedRewards(firstCycle);
        _verifyAccountingCheckpoint();

        (uint256 secondStreamBefore, uint256 merchantCredit) = _injectMerchantRevenue(BASELINE_MERCHANT_BOOST);
        require(merchantCredit == MERCHANT_REVENUE, "DETERMINISTIC_MERCHANT_REVENUE");
        _verifyAccountingCheckpoint();
        uint256 secondCycle = _settleNewRewardStream(secondStreamBefore);
        _addExpectedRewards(secondCycle);
        _verifyAccountingCheckpoint();

        require(revenueStaking.earned(address(directA), address(fakeYieldToken)) == expectedRewardA, "EARNED_A");
        require(revenueStaking.earned(address(directB), address(fakeYieldToken)) == expectedRewardB, "EARNED_B");
        require(revenueStaking.earned(address(directC), address(fakeYieldToken)) == expectedRewardC, "EARNED_C");
        require(
            revenueStaking.earned(address(strategy), address(fakeYieldToken)) == expectedRewardStrategy,
            "EARNED_STRATEGY"
        );

        _claimExpected(directA, expectedRewardA);
        expectedRewardA = 0;
        _verifyAccountingCheckpoint();
        _claimExpected(directB, expectedRewardB);
        expectedRewardB = 0;
        _verifyAccountingCheckpoint();
        _claimExpected(directC, expectedRewardC);
        expectedRewardC = 0;
        _verifyAccountingCheckpoint();

        uint256 strategyRewardBefore = revenueStaking.earned(address(strategy), address(fakeYieldToken));
        require(strategyRewardBefore == expectedRewardStrategy, "STRATEGY_REWARD_BEFORE_HARVEST");
        uint256 strategyActiveBefore = revenueStaking.activeBalance(address(strategy));
        uint256 gained = strategy.harvest();
        require(gained == strategyRewardBefore * 1e12, "STRATEGY_CONVERSION_ACCOUNTING");
        require(
            revenueStaking.activeBalance(address(strategy)) == strategyActiveBefore + gained,
            "STRATEGY_COMPOUND_ACCOUNTING"
        );
        expectedStrategy += gained;
        totalRevenueClaimed += strategyRewardBefore;
        expectedRewardStrategy = 0;
        _verifyAccountingCheckpoint();

        uint256 withdrawA = 500e18;
        _requireActorCall(
            directA,
            address(revenueStaking),
            abi.encodeWithSignature("withdrawImmediate(uint256,address)", withdrawA, address(directA))
        );
        expectedDirectA -= withdrawA;
        _verifyAccountingCheckpoint();

        uint256 queueB = 1_000e18;
        bytes memory requestResult = _requireActorCall(
            directB, address(revenueStaking), abi.encodeWithSignature("requestWithdrawal(uint256)", queueB)
        );
        uint256 requestId = abi.decode(requestResult, (uint256));
        expectedDirectB -= queueB;
        expectedQueuedB += queueB;
        _verifyAccountingCheckpoint();

        (,, uint64 unlockTime, bool completed) = revenueStaking.withdrawalRequests(requestId);
        require(!completed, "QUEUE_PRECOMPLETED");
        if (block.timestamp < unlockTime) VM.warp(unlockTime);
        _requireActorCall(
            directB,
            address(revenueStaking),
            abi.encodeWithSignature("completeQueuedWithdrawal(uint256,address)", requestId, address(directB))
        );
        expectedQueuedB -= queueB;
        _verifyAccountingCheckpoint();

        uint256 sharesToWithdraw = 1_000e18;
        uint256 economicBefore = vault.economicBalance();
        uint256 supplyBefore = vault.totalSupply();
        uint256 expectedVaultAssets = sharesToWithdraw * economicBefore / supplyBefore;
        uint256 strategyBeforeVaultExit = revenueStaking.activeBalance(address(strategy));
        uint256 actualVaultAssets = vault.withdraw(sharesToWithdraw);
        require(actualVaultAssets == expectedVaultAssets, "VAULT_WITHDRAW_ACCOUNTING");
        uint256 strategyAfterVaultExit = revenueStaking.activeBalance(address(strategy));
        require(strategyAfterVaultExit <= strategyBeforeVaultExit, "VAULT_STRATEGY_DIRECTION");
        expectedStrategy -= strategyBeforeVaultExit - strategyAfterVaultExit;
        _verifyAccountingCheckpoint();

        uint256 withdrawC = expectedDirectC;
        _requireActorCall(
            directC,
            address(revenueStaking),
            abi.encodeWithSignature("withdrawImmediate(uint256,address)", withdrawC, address(directC))
        );
        expectedDirectC = 0;
        _verifyAccountingCheckpoint();

        require(property_reward_source_conservation(), "FINAL_SOURCE_CONSERVATION");
        require(property_reward_claim_conservation(), "FINAL_CLAIM_CONSERVATION");
        require(property_revenue_stake_backing(), "FINAL_STAKE_BACKING");
        require(property_vault_share_supply_reconciles(), "FINAL_VAULT_SHARES");
    }

    function actionRevenueStakeWhole(uint16 raw) external {
        revenueStakeCalls++;
        uint256 index = _actorIndex(msg.sender);
        Phase6RevenueActorV4 actor = _actorByIndex(index);
        uint256 amount = _whole(raw, 100, 5_000, 1e18);
        principal.mint(address(actor), amount);
        (bool ok,) = actor.execute(address(revenueStaking), abi.encodeWithSignature("stake(uint256)", amount));
        if (ok) _setActiveExpected(index, _activeExpected(index) + amount);
        _record(ok);
    }

    function actionRevenueWithdrawWhole(uint16 raw) external {
        revenueWithdrawCalls++;
        uint256 index = _actorIndex(msg.sender);
        Phase6RevenueActorV4 actor = _actorByIndex(index);
        uint256 active = _activeExpected(index);
        if (active < 1e18) { _record(false); return; }
        uint256 maxWhole = active / 1e18;
        uint256 amount = _whole(raw, 1, maxWhole, 1e18);
        (bool ok,) = actor.execute(
            address(revenueStaking),
            abi.encodeWithSignature("withdrawImmediate(uint256,address)", amount, address(actor))
        );
        if (ok) _setActiveExpected(index, active - amount);
        _record(ok);
    }

    function actionQueueWithdrawalWhole(uint16 raw) external {
        queueWithdrawalCalls++;
        uint256 index = _actorIndex(msg.sender);
        if (hasPendingWithdrawal[index]) { _record(false); return; }
        Phase6RevenueActorV4 actor = _actorByIndex(index);
        uint256 active = _activeExpected(index);
        if (active < 1e18) { _record(false); return; }
        uint256 amount = _whole(raw, 1, active / 1e18, 1e18);
        (bool ok, bytes memory result) = actor.execute(
            address(revenueStaking), abi.encodeWithSignature("requestWithdrawal(uint256)", amount)
        );
        if (ok) {
            uint256 id = abi.decode(result, (uint256));
            pendingWithdrawalId[index] = id;
            pendingWithdrawalAmount[index] = amount;
            hasPendingWithdrawal[index] = true;
            _setActiveExpected(index, active - amount);
            _setQueuedExpected(index, _queuedExpected(index) + amount);
        }
        _record(ok);
    }

    function actionCompleteQueuedWithdrawal(uint16 raw) external {
        completeQueuedWithdrawalCalls++;
        uint256 index = uint256(raw) % 3;
        if (!hasPendingWithdrawal[index]) { _record(false); return; }
        Phase6RevenueActorV4 actor = _actorByIndex(index);
        uint256 id = pendingWithdrawalId[index];
        uint256 amount = pendingWithdrawalAmount[index];
        (,, uint64 unlockTime, bool completed) = revenueStaking.withdrawalRequests(id);
        if (completed) { _record(false); return; }
        if (block.timestamp < unlockTime) VM.warp(unlockTime);
        (bool ok,) = actor.execute(
            address(revenueStaking),
            abi.encodeWithSignature("completeQueuedWithdrawal(uint256,address)", id, address(actor))
        );
        if (ok) {
            _setQueuedExpected(index, _queuedExpected(index) - amount);
            hasPendingWithdrawal[index] = false;
            pendingWithdrawalAmount[index] = 0;
        }
        _record(ok);
    }

    function actionVaultDepositWhole(uint16 raw) external {
        vaultDepositCalls++;
        uint256 index = _actorIndex(msg.sender);
        Phase6RevenueActorV4 actor = _actorByIndex(index);
        uint256 amount = _whole(raw, 100, 5_000, 1e18);
        principal.mint(address(actor), amount);
        (bool ok,) = actor.execute(address(vault), abi.encodeWithSignature("deposit(uint256)", amount));
        _record(ok);
    }

    function actionVaultEarn() external {
        vaultEarnCalls++;
        uint256 idle = principal.balanceOf(address(vault));
        (bool ok,) = address(vault).call(abi.encodeWithSignature("earn()"));
        if (ok) expectedStrategy += idle;
        _record(ok);
    }

    function actionGenerateVlSdtYieldWhole(uint16 raw) external {
        vlSdtYieldGenerationCalls++;
        uint256 amount = _whole(raw, 100, 10_000, 1e6);
        uint256 streamsBefore = revenueStaking.streamCount(address(fakeYieldToken));
        fakeYieldToken.mint(address(fakeStakeDaoRouter), amount);
        fakeYieldMinted += amount;
        fakeStakeDaoRouter.seedYield(amount);
        uint256 stakingBefore = fakeYieldToken.balanceOf(address(revenueStaking));
        try locker.claimVlSDTRewards() {
            uint256 credited = fakeYieldToken.balanceOf(address(revenueStaking)) - stakingBefore;
            if (credited != 0) {
                vlSdtRevenueInjected += credited;
                totalRevenueInjected += credited;
            }
            streamsBefore;
            _record(credited != 0);
        } catch {
            _record(false);
        }
    }

    function actionMerchantLeaseWhole(uint16 raw) external {
        merchantLeaseCalls++;
        uint256 boostAmount = _whole(raw, 100, 5_000, 1e18);
        try boostMerchant.quoteLease(address(fakeYieldToken), boostAmount, 1)
            returns (uint256, uint256, uint256 totalPayment)
        {
            if (totalPayment == 0) { _record(false); return; }
            fakeYieldToken.mint(address(merchantBuyer), totalPayment);
            fakeYieldMinted += totalPayment;
            uint256 stakingBefore = fakeYieldToken.balanceOf(address(revenueStaking));
            (bool ok, bytes memory result) = merchantBuyer.execute(
                address(boostMerchant),
                abi.encodeWithSignature(
                    "leaseBoost(address,uint256,uint256,address,uint256,uint256)",
                    address(fakeYieldToken),
                    boostAmount,
                    1,
                    address(merchantBuyer),
                    totalPayment,
                    block.timestamp + 1 days
                )
            );
            if (ok) {
                (uint256 payment,) = abi.decode(result, (uint256, uint256));
                uint256 credited = fakeYieldToken.balanceOf(address(revenueStaking)) - stakingBefore;
                require(payment == totalPayment && credited == payment, "FUZZ_MERCHANT_ACCOUNTING");
                merchantRevenueInjected += credited;
                totalRevenueInjected += credited;
            }
            _record(ok);
        } catch {
            _record(false);
        }
    }

    function actionStartRewardCycle() external {
        startRewardCycleCalls++;
        if (!revenueStaking.canStartRewardCycle(address(fakeYieldToken))) { _record(false); return; }
        try revenueStaking.startRewardCycle(address(fakeYieldToken)) returns (uint256 amount) {
            _record(amount != 0);
        } catch {
            _record(false);
        }
    }

    function actionClaimRewards(uint16 raw) external {
        claimRewardCalls++;
        uint256 index = uint256(raw) % 3;
        Phase6RevenueActorV4 actor = _actorByIndex(index);
        uint256 beforeBalance = fakeYieldToken.balanceOf(address(actor));
        (bool ok,) = actor.execute(address(revenueStaking), abi.encodeWithSignature("claimRewardsSelf()"));
        if (ok) totalRevenueClaimed += fakeYieldToken.balanceOf(address(actor)) - beforeBalance;
        _record(ok);
    }

    function actionHarvestStrategy() external {
        harvestCalls++;
        uint256 rewardBefore = revenueStaking.earned(address(strategy), address(fakeYieldToken));
        uint256 activeBefore = revenueStaking.activeBalance(address(strategy));
        try strategy.harvest() returns (uint256 gained) {
            uint256 activeAfter = revenueStaking.activeBalance(address(strategy));
            require(activeAfter == activeBefore + gained, "FUZZ_STRATEGY_COMPOUND");
            expectedStrategy += gained;
            totalRevenueClaimed += rewardBefore;
            _record(true);
        } catch {
            _record(false);
        }
    }

    function actionVaultWithdrawWhole(uint16 raw) external {
        vaultWithdrawCalls++;
        uint256 index = _actorIndex(msg.sender);
        Phase6RevenueActorV4 actor = _actorByIndex(index);
        uint256 shares = vault.balanceOf(address(actor));
        if (shares < 1e18) { _record(false); return; }
        uint256 amountShares = _whole(raw, 1, shares / 1e18, 1e18);
        uint256 strategyBefore = revenueStaking.activeBalance(address(strategy));
        (bool ok,) = actor.execute(address(vault), abi.encodeWithSignature("withdraw(uint256)", amountShares));
        if (ok) {
            uint256 strategyAfter = revenueStaking.activeBalance(address(strategy));
            require(strategyAfter <= strategyBefore, "FUZZ_VAULT_STRATEGY_DIRECTION");
            expectedStrategy -= strategyBefore - strategyAfter;
        }
        _record(ok);
    }

    function property_revenue_stake_backing() public view returns (bool) {
        return revenueStaking.totalActiveStake() + revenueStaking.totalQueuedStake()
            <= principal.balanceOf(address(revenueStaking));
    }

    function property_reward_source_conservation() public view returns (bool) {
        return totalRevenueInjected == vlSdtRevenueInjected + merchantRevenueInjected
            && fakeStakeDaoRouter.totalDelivered() <= fakeStakeDaoRouter.totalSeeded();
    }

    function property_reward_claim_conservation() public view returns (bool) {
        return totalRevenueClaimed <= totalRevenueInjected;
    }

    function property_fake_reward_token_conservation() public view returns (bool) {
        return _fakeYieldKnownBalances() == fakeYieldToken.totalSupply()
            && fakeYieldToken.totalSupply() == fakeYieldMinted;
    }

    function property_vault_share_supply_reconciles() public view returns (bool) {
        uint256 knownShares = vault.balanceOf(address(this))
            + vault.balanceOf(address(directA))
            + vault.balanceOf(address(directB))
            + vault.balanceOf(address(directC))
            + vault.balanceOf(address(merchantBuyer));
        return knownShares == vault.totalSupply();
    }

    function property_transition_accounting_consistent() public view returns (bool) {
        uint256 calls = revenueStakeCalls + revenueWithdrawCalls + queueWithdrawalCalls
            + completeQueuedWithdrawalCalls + vaultDepositCalls + vaultEarnCalls
            + vlSdtYieldGenerationCalls + merchantLeaseCalls + startRewardCycleCalls
            + claimRewardCalls + harvestCalls + vaultWithdrawCalls;
        return successfulTransitions + revertedTransitions == calls;
    }
}

contract CyvlSdtRevenueAccountingFoundryV4 {
    struct FuzzSelector { address addr; bytes4[] selectors; }
    CyvlSdtRevenueAccountingHarnessV4 public harness;

    function setUp() public { harness = new CyvlSdtRevenueAccountingHarnessV4(); }

    function testWholeNumberMultiSourceRevenueAccounting() public {
        harness.testWholeNumberMultiSourceRevenueAccounting();
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(harness);
    }

    function targetSenders() public pure returns (address[] memory senders) {
        senders = new address[](4);
        senders[0] = address(0x10000);
        senders[1] = address(0x20000);
        senders[2] = address(0x30000);
        senders[3] = address(0x40000);
    }

    function targetSelectors() public view returns (FuzzSelector[] memory selectors_) {
        selectors_ = new FuzzSelector[](1);
        bytes4[] memory selectors = new bytes4[](12);
        selectors[0] = CyvlSdtRevenueAccountingHarnessV4.actionRevenueStakeWhole.selector;
        selectors[1] = CyvlSdtRevenueAccountingHarnessV4.actionRevenueWithdrawWhole.selector;
        selectors[2] = CyvlSdtRevenueAccountingHarnessV4.actionQueueWithdrawalWhole.selector;
        selectors[3] = CyvlSdtRevenueAccountingHarnessV4.actionCompleteQueuedWithdrawal.selector;
        selectors[4] = CyvlSdtRevenueAccountingHarnessV4.actionVaultDepositWhole.selector;
        selectors[5] = CyvlSdtRevenueAccountingHarnessV4.actionVaultEarn.selector;
        selectors[6] = CyvlSdtRevenueAccountingHarnessV4.actionGenerateVlSdtYieldWhole.selector;
        selectors[7] = CyvlSdtRevenueAccountingHarnessV4.actionMerchantLeaseWhole.selector;
        selectors[8] = CyvlSdtRevenueAccountingHarnessV4.actionStartRewardCycle.selector;
        selectors[9] = CyvlSdtRevenueAccountingHarnessV4.actionClaimRewards.selector;
        selectors[10] = CyvlSdtRevenueAccountingHarnessV4.actionHarvestStrategy.selector;
        selectors[11] = CyvlSdtRevenueAccountingHarnessV4.actionVaultWithdrawWhole.selector;
        selectors_[0] = FuzzSelector({addr: address(harness), selectors: selectors});
    }

    function invariant_revenue_stake_backing() public view {
        require(harness.property_revenue_stake_backing(), "REVENUE_STAKE_BACKING");
    }

    function invariant_reward_source_conservation() public view {
        require(harness.property_reward_source_conservation(), "REWARD_SOURCE_CONSERVATION");
    }

    function invariant_reward_claim_conservation() public view {
        require(harness.property_reward_claim_conservation(), "REWARD_CLAIM_CONSERVATION");
    }

    function invariant_vault_share_supply_reconciles() public view {
        require(harness.property_vault_share_supply_reconciles(), "VAULT_SHARE_SUPPLY");
    }

    function invariant_transition_accounting_consistent() public view {
        require(harness.property_transition_accounting_consistent(), "TRANSITION_ACCOUNTING");
    }
}
