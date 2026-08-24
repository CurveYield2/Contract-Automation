// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CurveYieldVlSDTToken} from "../../contracts/CurveYieldVlSDTToken.sol";
import {CurveYieldVlSDTRevenueStaking} from "../../contracts/CurveYieldVlSDTRevenueStaking.sol";
import {CurveYieldVlSDTBoostStaking} from "../../contracts/CurveYieldVlSDTBoostStaking.sol";
import {CurveYieldVlSDTLocker} from "../../contracts/CurveYieldVlSDTLocker.sol";
import {CurveYieldVlSDTBoostMerchant} from "../../contracts/CurveYieldVlSDTBoostMerchant.sol";
import {CurveYieldVault} from "../../contracts/CurveYieldVault.sol";
import {CurveYieldRevenueStrategyV7} from "../../contracts/CurveYieldRevenueStrategyV20.sol";
import {CurveYieldRevenueConverter} from "../../contracts/CurveYieldRevenueConverter.sol";
import {CurveYieldUsdcToSdtConverter} from "../../contracts/CurveYieldUsdcToSdtConverter.sol";
import {CurveYieldGovernanceToken} from "../../contracts/CurveYieldGovernanceToken.sol";
import {CurveYieldGovernanceMintController} from "../../contracts/CurveYieldGovernanceMintController.sol";
import {CurveYieldCyGovYieldStaking} from "../../contracts/CurveYieldCyGovYieldStaking.sol";
import {CurveYieldCyGovFraxswapConverter} from "../../contracts/CurveYieldCyGovFraxswapConverter.sol";
import {CurveYieldCyGovDiscountedSaleConverter} from "../../contracts/CurveYieldCyGovDiscountedSaleConverterV9.sol";

contract Phase6SystemRewardTokenV1 is ERC20 {
    constructor() ERC20("Phase6 System Reward", "P6R") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Accepts arbitrary calls and returns one zero word. Used only as an audit-only dependency
/// stand-in where the production target's accounting surface does not require the external system.
contract Phase6ZeroReturnDependencyV1 {
    fallback() external payable {
        assembly {
            mstore(0, 0)
            return(0, 32)
        }
    }
}

contract Phase6FraxPairV1 {
    address public immutable token0;
    address public immutable token1;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }

    function executeVirtualOrders(uint256) external {}
    function getAmountOut(uint256 amountIn, address) external pure returns (uint256) { return amountIn; }
    function swap(uint256, uint256, address, bytes calldata) external {}
}

contract Phase6CompounderAdapterV1 {
    IERC20 public immutable output;

    constructor(address output_) { output = IERC20(output_); }

    function quote(address, address, uint256 amountIn) external pure returns (uint256) { return amountIn; }

    function swap(address tokenIn, address, uint256 amountIn, uint256 minOut, address recipient, uint256)
        external
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = amountIn;
        require(amountOut >= minOut, "min out");
        output.transfer(recipient, amountOut);
    }
}

contract Phase6SystemActorV1 {
    address public immutable controller;

    constructor(address controller_, address cyvlSdt_, address vault_, address revenueStaking_, address boostStaking_, address yieldStaking_) {
        controller = controller_;
        IERC20(cyvlSdt_).approve(vault_, type(uint256).max);
        IERC20(cyvlSdt_).approve(revenueStaking_, type(uint256).max);
        IERC20(cyvlSdt_).approve(boostStaking_, type(uint256).max);
        IERC20(cyvlSdt_).approve(yieldStaking_, type(uint256).max);
    }

    function execute(address target, bytes calldata data) external returns (bool ok, bytes memory result) {
        require(msg.sender == controller, "controller only");
        (ok, result) = target.call(data);
    }
}

/// @notice Supplemental audit-only full-system accounting state machine for cyvlSDT v30.
/// It imports the frozen production Solidity accounting modules unchanged and randomizes shared
/// actors across staking, vault/strategy, reward, mint/reservation, converter and locker/admin state.
/// The Vyper GovernanceStaking contract is intentionally not imported into Foundry/Medusa and is
/// covered by separate real Anvil lifecycle evidence because the canonical mixed-language runner
/// compiles it outside this Solidity harness.
contract CyvlSdtSystemPhase6HarnessV1 {
    uint256 internal constant UNIT = 1e18;
    uint256 internal constant MIN_AMOUNT = 1e15;
    uint256 internal constant MAX_AMOUNT = 100e18;
    uint256 internal constant ACTOR_FUNDING = 1_000_000e18;

    address internal constant MEDUSA_ACTOR_0 = address(0x10000);
    address internal constant MEDUSA_ACTOR_1 = address(0x20000);
    address internal constant MEDUSA_ACTOR_2 = address(0x30000);
    address internal constant MEDUSA_ACTOR_3 = address(0x40000);

    address internal constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
    address internal constant VLSDT = 0x94818A7baa7e9F5dC62ce4da1B52ef9a760b80B8;
    address internal constant VLBOOST = 0xaB05ca46d1c78CAbB051efFE35099714Cad2AddA;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant TRICRYPTO_USDC = 0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B;
    address internal constant SDT_WETH_POOL = 0xA19bf6fBf05624282cb6ed498f4761f22e084Edd;

    CurveYieldVlSDTToken public immutable cyvlSdt;
    CurveYieldGovernanceToken public immutable governanceToken;
    CurveYieldVlSDTRevenueStaking public immutable revenueStaking;
    CurveYieldVlSDTLocker public immutable locker;
    CurveYieldVlSDTBoostStaking public immutable boostStaking;
    CurveYieldVlSDTBoostMerchant public immutable boostMerchant;
    CurveYieldVault public immutable vault;
    CurveYieldRevenueConverter public immutable revenueConverter;
    CurveYieldUsdcToSdtConverter public immutable usdcToSdtConverter;
    CurveYieldRevenueStrategyV7 public immutable strategy;
    CurveYieldCyGovYieldStaking public immutable yieldStaking;
    CurveYieldGovernanceMintController public immutable mintController;
    CurveYieldCyGovFraxswapConverter public immutable fraxswapConverter;
    CurveYieldCyGovDiscountedSaleConverter public immutable discountedSaleConverter;

    Phase6SystemRewardTokenV1 public immutable rewardToken;
    Phase6ZeroReturnDependencyV1 public immutable dependency;
    Phase6CompounderAdapterV1 public immutable adapter;
    Phase6FraxPairV1 public immutable fraxPair;
    Phase6SystemActorV1[4] public actors;

    uint256 public successfulTransitions;
    uint256 public revertedTransitions;
    uint256 public revenueStakeCalls;
    uint256 public revenueWithdrawCalls;
    uint256 public boostDepositCalls;
    uint256 public boostWithdrawCalls;
    uint256 public vaultDepositCalls;
    uint256 public vaultWithdrawCalls;
    uint256 public yieldStakeCalls;
    uint256 public yieldWithdrawCalls;
    uint256 public rewardNotifyCalls;
    uint256 public governanceReservationCalls;
    uint256 public converterRouteCalls;
    uint256 public lockerAccountingCalls;
    uint256 public merchantConfigCalls;
    uint256 public feeConfigCalls;
    uint256 public discountConfigCalls;

    constructor() {
        dependency = new Phase6ZeroReturnDependencyV1();
        rewardToken = new Phase6SystemRewardTokenV1();

        cyvlSdt = new CurveYieldVlSDTToken(address(this));
        cyvlSdt.setLocker(address(this));
        governanceToken = new CurveYieldGovernanceToken(address(this), "Phase6 Governance", "P6GOV");

        revenueStaking = new CurveYieldVlSDTRevenueStaking(
            address(this), address(this), address(this), address(cyvlSdt), address(governanceToken)
        );

        locker = new CurveYieldVlSDTLocker(
            address(this), address(this), SDT, VLSDT, VLBOOST,
            address(dependency), address(dependency), address(dependency), address(dependency), address(cyvlSdt)
        );

        boostStaking = new CurveYieldVlSDTBoostStaking(
            address(this), address(cyvlSdt), address(locker), address(governanceToken)
        );
        boostMerchant = new CurveYieldVlSDTBoostMerchant(
            address(this), address(locker), address(revenueStaking), address(dependency)
        );

        revenueConverter = new CurveYieldRevenueConverter(address(this), SDT, address(cyvlSdt), address(locker));
        usdcToSdtConverter = new CurveYieldUsdcToSdtConverter(
            address(revenueConverter), USDC, WBTC, WETH, SDT, TRICRYPTO_USDC, SDT_WETH_POOL
        );
        revenueConverter.setSdtSwapAdapter(address(dependency));
        revenueConverter.setUsdcRoute(USDC, address(usdcToSdtConverter));

        vault = new CurveYieldVault("Phase6 System Vault", "p6SYS", address(this), address(this), 18);
        strategy = new CurveYieldRevenueStrategyV7(
            address(this), address(vault), address(cyvlSdt), SDT, address(governanceToken),
            address(revenueStaking), address(revenueConverter), 0, 0, 0
        );
        vault.setStrategy(address(strategy));
        revenueStaking.setNotifier(address(this), true);
        revenueStaking.addRewardToken(address(rewardToken));

        yieldStaking = new CurveYieldCyGovYieldStaking(
            address(this), address(cyvlSdt), address(governanceToken), address(this)
        );
        mintController = new CurveYieldGovernanceMintController(
            address(this), address(governanceToken), address(dependency)
        );

        Phase6SystemRewardTokenV1 paired = new Phase6SystemRewardTokenV1();
        fraxPair = new Phase6FraxPairV1(address(governanceToken), address(paired));
        fraxswapConverter = new CurveYieldCyGovFraxswapConverter(
            address(this), address(governanceToken), address(this), address(fraxPair), 0, 0, 0
        );
        discountedSaleConverter = new CurveYieldCyGovDiscountedSaleConverter(
            address(governanceToken), address(dependency), address(fraxswapConverter)
        );
        discountedSaleConverter.activate();

        adapter = new Phase6CompounderAdapterV1(address(cyvlSdt));
        cyvlSdt.mint(address(adapter), ACTOR_FUNDING);

        for (uint256 i = 0; i < 4; i++) {
            actors[i] = new Phase6SystemActorV1(
                address(this), address(cyvlSdt), address(vault), address(revenueStaking), address(boostStaking), address(yieldStaking)
            );
            cyvlSdt.mint(address(actors[i]), ACTOR_FUNDING);
            rewardToken.mint(address(this), ACTOR_FUNDING);
        }
        rewardToken.approve(address(revenueStaking), type(uint256).max);
    }

    function _bounded(uint256 raw, uint256 minValue, uint256 maxValue) internal pure returns (uint256) {
        if (minValue == maxValue) return minValue;
        return minValue + (raw % (maxValue - minValue + 1));
    }

    function _actorIndex(address sender) internal pure returns (uint256) {
        if (sender == MEDUSA_ACTOR_0) return 0;
        if (sender == MEDUSA_ACTOR_1) return 1;
        if (sender == MEDUSA_ACTOR_2) return 2;
        if (sender == MEDUSA_ACTOR_3) return 3;
        return uint160(sender) % 4;
    }

    function _actor() internal view returns (Phase6SystemActorV1) { return actors[_actorIndex(msg.sender)]; }

    function _record(bool ok) internal {
        if (ok) successfulTransitions++;
        else revertedTransitions++;
    }

    function actionRevenueStake(uint96 rawAmount) external {
        revenueStakeCalls++;
        uint256 amount = _bounded(rawAmount, MIN_AMOUNT, MAX_AMOUNT);
        (bool ok,) = _actor().execute(address(revenueStaking), abi.encodeWithSignature("stake(uint256)", amount));
        _record(ok);
    }

    function actionRevenueWithdraw(uint96 rawAmount) external {
        revenueWithdrawCalls++;
        Phase6SystemActorV1 actor = _actor();
        uint256 active = revenueStaking.activeBalance(address(actor));
        if (active == 0) { _record(false); return; }
        uint256 amount = _bounded(rawAmount, 1, active);
        (bool ok,) = actor.execute(
            address(revenueStaking), abi.encodeWithSignature("withdrawImmediate(uint256,address)", amount, address(actor))
        );
        _record(ok);
    }

    function actionBoostDeposit(uint96 rawAmount) external {
        boostDepositCalls++;
        uint256 amount = _bounded(rawAmount, MIN_AMOUNT, MAX_AMOUNT);
        (bool ok,) = _actor().execute(address(boostStaking), abi.encodeWithSignature("deposit(uint256)", amount));
        _record(ok);
    }

    function actionBoostWithdraw(uint96 rawAmount) external {
        boostWithdrawCalls++;
        Phase6SystemActorV1 actor = _actor();
        uint256 deposited = boostStaking.depositedBalance(address(actor));
        uint256 reserved = boostStaking.reservedBalance(address(actor));
        uint256 available = deposited > reserved ? deposited - reserved : 0;
        if (available == 0) { _record(false); return; }
        uint256 amount = _bounded(rawAmount, 1, available);
        (bool ok,) = actor.execute(
            address(boostStaking), abi.encodeWithSignature("withdraw(uint256,address)", amount, address(actor))
        );
        _record(ok);
    }

    function actionVaultDeposit(uint96 rawAmount) external {
        vaultDepositCalls++;
        uint256 amount = _bounded(rawAmount, MIN_AMOUNT, MAX_AMOUNT);
        (bool ok,) = _actor().execute(address(vault), abi.encodeWithSignature("deposit(uint256)", amount));
        _record(ok);
    }

    function actionVaultWithdraw(uint96 rawShares) external {
        vaultWithdrawCalls++;
        Phase6SystemActorV1 actor = _actor();
        uint256 shares = vault.balanceOf(address(actor));
        if (shares == 0) { _record(false); return; }
        uint256 amount = _bounded(rawShares, 1, shares);
        (bool ok,) = actor.execute(address(vault), abi.encodeWithSignature("withdraw(uint256)", amount));
        _record(ok);
    }

    function actionYieldStake(uint96 rawAmount) external {
        yieldStakeCalls++;
        uint256 amount = _bounded(rawAmount, MIN_AMOUNT, MAX_AMOUNT);
        (bool ok,) = _actor().execute(address(yieldStaking), abi.encodeWithSignature("stake(uint256)", amount));
        _record(ok);
    }

    function actionYieldWithdraw(uint96 rawShares) external {
        yieldWithdrawCalls++;
        Phase6SystemActorV1 actor = _actor();
        uint256 shares = yieldStaking.userShares(address(actor));
        if (shares == 0) { _record(false); return; }
        uint256 amount = _bounded(rawShares, 1, shares);
        (bool ok,) = actor.execute(
            address(yieldStaking), abi.encodeWithSignature("withdraw(uint256,address)", amount, address(actor))
        );
        _record(ok);
    }

    function actionNotifyReward(uint96 rawAmount) external {
        rewardNotifyCalls++;
        uint256 amount = _bounded(rawAmount, MIN_AMOUNT, MAX_AMOUNT);
        rewardToken.mint(address(this), amount);
        try revenueStaking.notifyReward(address(rewardToken), amount, 7 days) { _record(true); }
        catch { _record(false); }
    }

    function actionGovernanceReservation(uint96 rawAmount) external {
        governanceReservationCalls++;
        uint256 amount = _bounded(rawAmount, 1e18, 10_000e18);
        try governanceToken.proposeOwnerMint(address(this), amount) { _record(true); }
        catch { _record(false); }
    }

    function actionConverterRoute(uint16 raw) external {
        converterRouteCalls++;
        address route = (raw & 1) == 0 ? address(usdcToSdtConverter) : address(adapter);
        (bool ok,) = address(revenueConverter).call(
            abi.encodeWithSignature("setUsdcRoute(address,address)", USDC, route)
        );
        _record(ok);
    }

    function actionLockerAccounting(uint16 raw) external {
        lockerAccountingCalls++;
        if ((raw & 1) == 0) {
            bytes32 voteHash = keccak256(abi.encodePacked(raw, successfulTransitions, revertedTransitions));
            (bool ok,) = address(locker).call(abi.encodeWithSignature("approveSnapshotVoteHash(bytes32)", voteHash));
            _record(ok);
        } else {
            (bool ok,) = address(locker).call(
                abi.encodeWithSignature("setDaoBoostReleasedToModules(uint256)", uint256(raw) * 1e18)
            );
            _record(ok);
        }
    }

    function actionMerchantConfig(uint16 raw) external {
        merchantConfigCalls++;
        uint256 minBoost = _bounded(raw, 1, 10_000) * 1e18;
        (bool ok,) = address(boostMerchant).call(abi.encodeWithSignature("setMinimumLeaseBoost(uint256)", minBoost));
        _record(ok);
    }

    function actionFraxFeeConfig(uint16 raw) external {
        feeConfigCalls++;
        address account = address(_actor());
        (bool ok,) = address(fraxswapConverter).call(
            abi.encodeWithSignature("setFeeExempt(address,bool)", account, (raw & 1) == 0)
        );
        _record(ok);
    }

    function actionDiscountRate(uint16 raw) external {
        discountConfigCalls++;
        uint256 minRate = discountedSaleConverter.MIN_ANNUAL_BASE_CREDIT_RATE();
        uint256 maxRate = discountedSaleConverter.MAX_ANNUAL_BASE_CREDIT_RATE();
        uint256 rate = _bounded(raw, minRate, maxRate);
        (bool ok,) = address(discountedSaleConverter).call(
            abi.encodeWithSignature("setAnnualBaseCreditRate(uint256)", rate)
        );
        _record(ok);
    }

    function actorVaultShareSum() public view returns (uint256 total) {
        for (uint256 i = 0; i < 4; i++) total += vault.balanceOf(address(actors[i]));
    }

    function selectedCyvlSdtBalances() public view returns (uint256 total) {
        for (uint256 i = 0; i < 4; i++) total += cyvlSdt.balanceOf(address(actors[i]));
        total += cyvlSdt.balanceOf(address(revenueStaking));
        total += cyvlSdt.balanceOf(address(boostStaking));
        total += cyvlSdt.balanceOf(address(yieldStaking));
        total += cyvlSdt.balanceOf(address(vault));
        total += cyvlSdt.balanceOf(address(strategy));
        total += cyvlSdt.balanceOf(address(adapter));
    }

    function property_cross_module_cyvlsdt_conservation() external view returns (bool) {
        return selectedCyvlSdtBalances() <= cyvlSdt.totalSupply();
    }

    function invariant_governance_cap_not_exceeded() external view returns (bool) {
        return governanceToken.totalSupply() <= governanceToken.cap();
    }

    function invariant_vault_share_supply_reconciles() external view returns (bool) {
        return actorVaultShareSum() == vault.totalSupply();
    }

    function property_revenue_stake_is_backed() external view returns (bool) {
        return revenueStaking.totalActiveStake() + revenueStaking.totalQueuedStake() <= cyvlSdt.balanceOf(address(revenueStaking));
    }

    function property_boost_stake_is_backed() external view returns (bool) {
        return boostStaking.totalDeposited() <= cyvlSdt.balanceOf(address(boostStaking));
    }

    function property_yield_stake_is_backed() external view returns (bool) {
        return yieldStaking.totalStaked() <= cyvlSdt.balanceOf(address(yieldStaking));
    }

    function property_transition_accounting_consistent() external view returns (bool) {
        uint256 calls = revenueStakeCalls + revenueWithdrawCalls + boostDepositCalls + boostWithdrawCalls
            + vaultDepositCalls + vaultWithdrawCalls + yieldStakeCalls + yieldWithdrawCalls + rewardNotifyCalls
            + governanceReservationCalls + converterRouteCalls + lockerAccountingCalls + merchantConfigCalls
            + feeConfigCalls + discountConfigCalls;
        return successfulTransitions + revertedTransitions == calls;
    }
}

contract CyvlSdtSystemPhase6FoundryV1 {
    struct FuzzSelector { address addr; bytes4[] selectors; }
    CyvlSdtSystemPhase6HarnessV1 public harness;

    function setUp() public { harness = new CyvlSdtSystemPhase6HarnessV1(); }

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
        bytes4[] memory selectors = new bytes4[](15);
        selectors[0] = CyvlSdtSystemPhase6HarnessV1.actionRevenueStake.selector;
        selectors[1] = CyvlSdtSystemPhase6HarnessV1.actionRevenueWithdraw.selector;
        selectors[2] = CyvlSdtSystemPhase6HarnessV1.actionBoostDeposit.selector;
        selectors[3] = CyvlSdtSystemPhase6HarnessV1.actionBoostWithdraw.selector;
        selectors[4] = CyvlSdtSystemPhase6HarnessV1.actionVaultDeposit.selector;
        selectors[5] = CyvlSdtSystemPhase6HarnessV1.actionVaultWithdraw.selector;
        selectors[6] = CyvlSdtSystemPhase6HarnessV1.actionYieldStake.selector;
        selectors[7] = CyvlSdtSystemPhase6HarnessV1.actionYieldWithdraw.selector;
        selectors[8] = CyvlSdtSystemPhase6HarnessV1.actionNotifyReward.selector;
        selectors[9] = CyvlSdtSystemPhase6HarnessV1.actionGovernanceReservation.selector;
        selectors[10] = CyvlSdtSystemPhase6HarnessV1.actionConverterRoute.selector;
        selectors[11] = CyvlSdtSystemPhase6HarnessV1.actionLockerAccounting.selector;
        selectors[12] = CyvlSdtSystemPhase6HarnessV1.actionMerchantConfig.selector;
        selectors[13] = CyvlSdtSystemPhase6HarnessV1.actionFraxFeeConfig.selector;
        selectors[14] = CyvlSdtSystemPhase6HarnessV1.actionDiscountRate.selector;
        selectors_[0] = FuzzSelector({addr: address(harness), selectors: selectors});
    }

    function invariant_cross_module_cyvlsdt_conservation() public view {
        require(harness.selectedCyvlSdtBalances() <= harness.cyvlSdt().totalSupply(), "CYVLSDT_CONSERVATION");
    }

    function invariant_governance_cap_not_exceeded() public view {
        require(harness.governanceToken().totalSupply() <= harness.governanceToken().cap(), "GOV_CAP");
    }

    function invariant_vault_share_supply_reconciles() public view {
        require(harness.actorVaultShareSum() == harness.vault().totalSupply(), "VAULT_SHARE_SUPPLY");
    }

    function invariant_revenue_stake_is_backed() public view {
        require(
            harness.revenueStaking().totalActiveStake() + harness.revenueStaking().totalQueuedStake()
                <= harness.cyvlSdt().balanceOf(address(harness.revenueStaking())),
            "REVENUE_BACKING"
        );
    }
}
