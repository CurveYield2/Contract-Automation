// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CurveYieldVault} from "../../contracts/CurveYieldVault.sol";
import {ICurveYieldVaultStrategy} from "../../contracts/interfaces/ICurveYieldVaultStrategy.sol";

contract Phase6AuditWantV2 is ERC20 {
    constructor() ERC20("Phase6 Audit Want", "P6W") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract Phase6AuditStrategyV2 is ICurveYieldVaultStrategy {
    IERC20 public immutable WANT;
    address public immutable VAULT;
    uint256 public estimate;

    constructor(address want_, address vault_) {
        WANT = IERC20(want_);
        VAULT = vault_;
    }

    function want() external view returns (address) { return address(WANT); }
    function vault() external view returns (address) { return VAULT; }
    function balanceOf() external view returns (uint256) { return WANT.balanceOf(address(this)); }
    function estimatedUnharvestedWant() external view returns (uint256) { return estimate; }
    function estimatedTokenAprBps() external pure returns (uint256) { return 0; }
    function setEstimate(uint256 value) external { estimate = value; }
    function beforeDeposit() external {}
    function beforeDepositStrict() external {}
    function beforeWithdraw() external {}
    function beforeWithdrawStrict() external {}
    function deposit() external {}

    function withdrawInstant(uint256 amount) external returns (uint256 received) {
        require(msg.sender == VAULT, "vault only");
        uint256 bal = WANT.balanceOf(address(this));
        received = amount < bal ? amount : bal;
        if (received != 0) WANT.transfer(VAULT, received);
    }

    function requestWithdrawal(uint256 amount) external view returns (uint256 requestId, uint256 unlockTime) {
        return (amount, block.timestamp);
    }
    function completeWithdrawal(uint256) external pure returns (uint256 received) { return 0; }
    function withdrawPendingInstant(uint256) external pure returns (uint256 received) { return 0; }
}

contract Phase6VaultActorV2 {
    IERC20 public immutable WANT;
    CurveYieldVault public immutable VAULT;
    address public immutable CONTROLLER;

    constructor(address want_, address vault_, address controller_) {
        WANT = IERC20(want_);
        VAULT = CurveYieldVault(vault_);
        CONTROLLER = controller_;
        WANT.approve(vault_, type(uint256).max);
    }

    modifier onlyController() {
        require(msg.sender == CONTROLLER, "controller only");
        _;
    }

    function deposit(uint256 amount) external onlyController { VAULT.deposit(amount); }
    function withdraw(uint256 shares) external onlyController { VAULT.withdraw(shares); }
    function transferShares(address recipient, uint256 shares) external onlyController { VAULT.transfer(recipient, shares); }
}

/// @notice Audit-only Phase-6 state-machine harness adapted from the v2 Medusa/Foundry skeletons.
/// Frozen production contracts are imported unchanged. Four proxy actors preserve distinct vault
/// shareholder identities even though Medusa calls this harness through its senderAddresses.
contract CyvlSdtVaultPhase6HarnessV2 {
    uint256 internal constant UNIT = 1e18;
    uint256 internal constant MIN_DEPOSIT = 1e18;
    uint256 internal constant MAX_DEPOSIT = 100e18;
    uint256 internal constant MAX_ESTIMATE = 1_000e18;
    uint256 internal constant ACTOR_FUNDING = 1_000_000_000e18;

    address internal constant MEDUSA_ACTOR_0 = address(0x10000);
    address internal constant MEDUSA_ACTOR_1 = address(0x20000);
    address internal constant MEDUSA_ACTOR_2 = address(0x30000);
    address internal constant MEDUSA_ACTOR_3 = address(0x40000);

    Phase6AuditWantV2 public immutable wantToken;
    CurveYieldVault public immutable vault;
    Phase6AuditStrategyV2 public immutable strategy;
    Phase6VaultActorV2[4] public actors;

    uint256 public successfulTransitions;
    uint256 public revertedTransitions;
    uint256 public depositCalls;
    uint256 public withdrawCalls;
    uint256 public withdrawAllCalls;
    uint256 public transferCalls;
    uint256 public estimateCalls;
    uint256 public donationCalls;

    bool public everHadSupply;
    bool public observedZeroSupplyAfterActivity;
    uint256 public residualEstimateAtZeroSupply;
    bool public observedRestartAfterResidual;
    uint256 public restartPricePerShare;

    uint256 public p2ProbeCount;
    bool public p2LastProbePassed = true;

    constructor() {
        wantToken = new Phase6AuditWantV2();
        vault = new CurveYieldVault("Phase6 Audit Vault", "p6VAULT", address(this), address(this), 18);
        strategy = new Phase6AuditStrategyV2(address(wantToken), address(vault));
        vault.setStrategy(address(strategy));
        for (uint256 i = 0; i < 4; i++) {
            actors[i] = new Phase6VaultActorV2(address(wantToken), address(vault), address(this));
            wantToken.mint(address(actors[i]), ACTOR_FUNDING);
        }
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

    function _recipientIndex(address seed) internal pure returns (uint256) {
        return uint160(seed) % 4;
    }

    function _observeSupplyLifecycle() internal {
        uint256 supply = vault.totalSupply();
        if (supply > 0) everHadSupply = true;
        if (everHadSupply && supply == 0) {
            observedZeroSupplyAfterActivity = true;
            residualEstimateAtZeroSupply = strategy.estimate();
        } else if (observedZeroSupplyAfterActivity && supply > 0 && residualEstimateAtZeroSupply > 0) {
            observedRestartAfterResidual = true;
            restartPricePerShare = vault.getPricePerFullShare();
        }
    }

    function actionDeposit(uint96 rawAmount) external {
        depositCalls++;
        uint256 amount = _bounded(uint256(rawAmount), MIN_DEPOSIT, MAX_DEPOSIT);
        Phase6VaultActorV2 actor = actors[_actorIndex(msg.sender)];
        try actor.deposit(amount) { successfulTransitions++; } catch { revertedTransitions++; }
        _observeSupplyLifecycle();
    }

    function actionWithdraw(uint96 rawShares) external {
        withdrawCalls++;
        Phase6VaultActorV2 actor = actors[_actorIndex(msg.sender)];
        uint256 shares = vault.balanceOf(address(actor));
        if (shares == 0) { revertedTransitions++; return; }
        uint256 amount = _bounded(uint256(rawShares), 1, shares);
        try actor.withdraw(amount) { successfulTransitions++; } catch { revertedTransitions++; }
        _observeSupplyLifecycle();
    }

    function actionWithdrawAll() external {
        withdrawAllCalls++;
        Phase6VaultActorV2 actor = actors[_actorIndex(msg.sender)];
        uint256 shares = vault.balanceOf(address(actor));
        if (shares == 0) { revertedTransitions++; return; }
        try actor.withdraw(shares) { successfulTransitions++; } catch { revertedTransitions++; }
        _observeSupplyLifecycle();
    }

    function actionTransferShares(address recipientSeed, uint96 rawShares) external {
        transferCalls++;
        Phase6VaultActorV2 actor = actors[_actorIndex(msg.sender)];
        Phase6VaultActorV2 recipient = actors[_recipientIndex(recipientSeed)];
        uint256 shares = vault.balanceOf(address(actor));
        if (shares == 0) { revertedTransitions++; return; }
        uint256 amount = _bounded(uint256(rawShares), 1, shares);
        try actor.transferShares(address(recipient), amount) { successfulTransitions++; } catch { revertedTransitions++; }
        _observeSupplyLifecycle();
    }

    /// @dev Models the mutable strategy/converter quote boundary carried as P2-CAND-001.
    function actionSetEstimate(uint96 rawEstimate) external {
        estimateCalls++;
        strategy.setEstimate(_bounded(uint256(rawEstimate), 0, MAX_ESTIMATE));
        successfulTransitions++;
        _observeSupplyLifecycle();
    }

    /// @dev Adds realized strategy-side WANT to exercise realized/economic balance transitions separately.
    function actionDonateStrategy(uint96 rawAmount) external {
        donationCalls++;
        wantToken.mint(address(strategy), _bounded(uint256(rawAmount), 1, MAX_DEPOSIT));
        successfulTransitions++;
        _observeSupplyLifecycle();
    }

    /// @dev Hostile/unbounded deposit mode preserves zero, dust and above-operational-max inputs.
    function actionBoundaryDeposit(uint8 rawClass) external {
        depositCalls++;
        uint256[9] memory values = [
            uint256(0),
            uint256(1),
            MIN_DEPOSIT - 1,
            MIN_DEPOSIT,
            MIN_DEPOSIT + 1,
            MAX_DEPOSIT - 1,
            MAX_DEPOSIT,
            MAX_DEPOSIT + 1,
            uint256(type(uint96).max)
        ];
        uint256 amount = values[uint256(rawClass) % values.length];
        Phase6VaultActorV2 actor = actors[_actorIndex(msg.sender)];
        try actor.deposit(amount) { successfulTransitions++; } catch { revertedTransitions++; }
        _observeSupplyLifecycle();
    }

    /// @dev Explicit quote/value boundary dictionary transferred from Phase-5 WAD/share analysis.
    function actionBoundaryEstimate(uint8 rawClass) external {
        estimateCalls++;
        uint256[11] memory values = [
            uint256(0),
            uint256(1),
            UNIT - 1,
            UNIT,
            UNIT + 1,
            MAX_DEPOSIT - 1,
            MAX_DEPOSIT,
            MAX_DEPOSIT + 1,
            MAX_ESTIMATE - 1,
            MAX_ESTIMATE,
            uint256(type(uint96).max)
        ];
        strategy.setEstimate(values[uint256(rawClass) % values.length]);
        successfulTransitions++;
        _observeSupplyLifecycle();
    }

    /// @dev Exercises zero/one/balance-neighbor/over-balance withdrawal classes without assumptions.
    function actionBoundaryWithdraw(uint8 rawClass) external {
        withdrawCalls++;
        Phase6VaultActorV2 actor = actors[_actorIndex(msg.sender)];
        uint256 shares = vault.balanceOf(address(actor));
        uint256[6] memory values = [
            uint256(0),
            uint256(1),
            shares > 0 ? shares - 1 : 0,
            shares,
            shares + 1,
            uint256(type(uint96).max)
        ];
        uint256 amount = values[uint256(rawClass) % values.length];
        try actor.withdraw(amount) { successfulTransitions++; } catch { revertedTransitions++; }
        _observeSupplyLifecycle();
    }

    function actorShareSum() public view returns (uint256 total) {
        for (uint256 i = 0; i < 4; i++) total += vault.balanceOf(address(actors[i]));
    }

    function property_INV026_actor_share_sum_equals_total_supply() external view returns (bool) {
        return actorShareSum() == vault.totalSupply();
    }

    function property_P4_restart_does_not_inherit_residual_estimated_value() external view returns (bool) {
        return !observedRestartAfterResidual || restartPricePerShare == UNIT;
    }

    function property_harness_transition_accounting_consistent() external view returns (bool) {
        return successfulTransitions + revertedTransitions == depositCalls + withdrawCalls + withdrawAllCalls + transferCalls + estimateCalls + donationCalls;
    }

    function _fixture() internal returns (Phase6AuditWantV2 token, CurveYieldVault freshVault, Phase6AuditStrategyV2 freshStrategy) {
        token = new Phase6AuditWantV2();
        freshVault = new CurveYieldVault("Phase6 Probe Vault", "p6PROBE", address(this), address(this), 18);
        freshStrategy = new Phase6AuditStrategyV2(address(token), address(freshVault));
        freshVault.setStrategy(address(freshStrategy));
        token.mint(address(this), 1_000_000e18);
        token.approve(address(freshVault), type(uint256).max);
    }

    function _secondDepositShares(uint256 estimate) internal returns (uint256 shares) {
        (, CurveYieldVault freshVault, Phase6AuditStrategyV2 freshStrategy) = _fixture();
        freshVault.deposit(100e18);
        freshStrategy.setEstimate(estimate);
        uint256 beforeShares = freshVault.balanceOf(address(this));
        freshVault.deposit(100e18);
        shares = freshVault.balanceOf(address(this)) - beforeShares;
    }

    /// @dev Targetable Medusa/Foundry probe for P2-CAND-001 / REQ-031/032.
    function probeP2MutableEstimate(uint96 rawEstimate) external {
        uint256 estimate = _bounded(uint256(rawEstimate), 1, 100e18);
        uint256 baselineShares = _secondDepositShares(0);
        uint256 manipulatedShares = _secondDepositShares(estimate);
        p2ProbeCount++;
        p2LastProbePassed = manipulatedShares == baselineShares;
    }

    function property_P2_mutable_estimate_does_not_change_equal_deposit_shares() external view returns (bool) {
        return p2ProbeCount == 0 || p2LastProbePassed;
    }
}

/// @notice Native Foundry Phase-6 fuzz/invariant suite using the same audit-only system model.
/// This file is staged now but native Foundry must not execute until all required Medusa campaigns
/// have reached terminal evidence under the V7 Phase-6 campaign ledger.
contract CyvlSdtVaultPhase6FoundryV2 {
    struct FuzzSelector { address addr; bytes4[] selectors; }

    CyvlSdtVaultPhase6HarnessV2 public harness;

    function setUp() public {
        harness = new CyvlSdtVaultPhase6HarnessV2();
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
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = CyvlSdtVaultPhase6HarnessV2.actionDeposit.selector;
        selectors[1] = CyvlSdtVaultPhase6HarnessV2.actionWithdraw.selector;
        selectors[2] = CyvlSdtVaultPhase6HarnessV2.actionWithdrawAll.selector;
        selectors[3] = CyvlSdtVaultPhase6HarnessV2.actionTransferShares.selector;
        selectors[4] = CyvlSdtVaultPhase6HarnessV2.actionSetEstimate.selector;
        selectors[5] = CyvlSdtVaultPhase6HarnessV2.actionDonateStrategy.selector;
        selectors_[0] = FuzzSelector({addr: address(harness), selectors: selectors});
    }

    function invariant_INV026_actor_share_sum_equals_total_supply() public view {
        require(harness.actorShareSum() == harness.vault().totalSupply(), "INV026_SHARE_SUPPLY_MISMATCH");
    }

    function invariant_P4_restart_does_not_inherit_residual_estimated_value() public view {
        require(harness.property_P4_restart_does_not_inherit_residual_estimated_value(), "P4_RESIDUAL_CAPTURE");
    }

    function _fixture() internal returns (Phase6AuditWantV2 token, CurveYieldVault freshVault, Phase6AuditStrategyV2 freshStrategy) {
        token = new Phase6AuditWantV2();
        freshVault = new CurveYieldVault("Phase6 Foundry Probe", "p6FPROBE", address(this), address(this), 18);
        freshStrategy = new Phase6AuditStrategyV2(address(token), address(freshVault));
        freshVault.setStrategy(address(freshStrategy));
        token.mint(address(this), 1_000_000e18);
        token.approve(address(freshVault), type(uint256).max);
    }

    function _boundedResidual(uint256 raw) internal pure returns (uint256) {
        return (raw % (100e18 - 1)) + 1;
    }

    function _secondDepositShares(uint256 estimate) internal returns (uint256 shares) {
        (, CurveYieldVault freshVault, Phase6AuditStrategyV2 freshStrategy) = _fixture();
        freshVault.deposit(100e18);
        freshStrategy.setEstimate(estimate);
        uint256 beforeShares = freshVault.balanceOf(address(this));
        freshVault.deposit(100e18);
        shares = freshVault.balanceOf(address(this)) - beforeShares;
    }

    function testFuzz_P2_mutable_estimate_must_not_change_equal_deposit_shares(uint96 rawEstimate) external {
        uint256 estimate = _boundedResidual(uint256(rawEstimate));
        uint256 baselineShares = _secondDepositShares(0);
        uint256 manipulatedShares = _secondDepositShares(estimate);
        assert(manipulatedShares == baselineShares);
    }

    function testFuzz_P4_zero_supply_restart_must_not_inherit_residual_reward_value(uint96 rawResidual) external {
        uint256 residual = _boundedResidual(uint256(rawResidual));
        (, CurveYieldVault freshVault, Phase6AuditStrategyV2 freshStrategy) = _fixture();
        freshVault.deposit(100e18);
        freshStrategy.setEstimate(residual);
        freshVault.withdraw(freshVault.balanceOf(address(this)));
        assert(freshVault.totalSupply() == 0);
        freshVault.deposit(100e18);
        assert(freshVault.getPricePerFullShare() == 1e18);
    }
}
