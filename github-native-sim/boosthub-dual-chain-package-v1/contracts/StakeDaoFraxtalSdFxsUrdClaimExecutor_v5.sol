// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IBoostHub} from "./interfaces/IBoostHub.sol";

/**
 * @title CurveYield System Component
 * @notice CurveYield is a decentralized NGO building optimized DeFi systems for the good of all.
 *
 * @dev CurveYield integrates specialized AMM infrastructure, tokenized yield strategies, credit
 * markets, and protocol-owned liquidity into a unified, capital-efficient liquidity stack governed
 * by an open, international DAO community.
 *
 * Protocol operations are enhanced by cross-chain bridging and messaging, MEV capture systems,
 * off-chain to on-chain automation, and peer-to-peer data networks.
 *
 * This contract is one component of the CurveYield system.
 *
 * CurveYield uses proven DeFi primitives where possible and adds targeted coordination and
 * capital-efficiency-enhancing contracts where needed. Users and integrators must review
 * CurveYield documentation before use.
 *
 * Learn more:
 * Documentation: https://docs.curveyield.com
 * dApp: https://curveyield.online
 * GitHub: https://github.com/curveyield
 *
 * Decentralized links may have limited or delayed availability during periods of high network activity:
 * https://curveyield.eth.limo
 * https://curveyield.dao
 *
 * Note: curveyield.dao may require a Brave Browser or an Unstoppable Domains browser plugin to use.
 */

interface IStakeDaoUniversalRewardsDistributor {
    function root() external view returns (bytes32);
    function claimed(address account, address reward) external view returns (uint256);
    function recipients(address account) external view returns (address);
    function claim(address account, address reward, uint256 cumulativeClaimable, bytes32[] calldata proof)
        external
        returns (uint256 amount);
}

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

/// @title Stake DAO Fraxtal sdFXS URD Claim Executor v5
/// @notice Stores a verified cumulative Fraxtal sdFXS claim for the configured BoostHub PID 0.
/// @dev Uses BoostHub's claimToken(pid, token) boundary and revised poolInfo layout.
///      No vlBoost integration exists on Fraxtal. Rewards must arrive in BoostHub itself.
contract StakeDaoFraxtalSdFxsUrdClaimExecutor {
    uint256 public constant VERSION = 5;
    uint256 public constant EXPECTED_CHAIN_ID = 252;
    uint256 public constant PID = 0;

    address public constant APPROVED_REWARD_TOKEN = 0x1AEe2382e05Dc68BDfC472F1E46d570feCca5814;
    address public constant APPROVED_URD = 0xAeB87C92b2E7d3b21fA046Ae1E51E0ebF11A41Af;

    error WrongChain(uint256 actualChainId);
    error ZeroAddress();
    error MissingCode(address target);
    error OnlyConfigurator();
    error BoostHubAlreadySet();
    error BoostHubNotSet();
    error WrongClaimExecutor();
    error RewardTokenNotRegistered();
    error OnlyBoostHub();
    error ReentrantCall();
    error ZeroAmount();
    error MerkleRootNotSet();
    error InvalidProof();
    error ClaimAlreadyCompleted(uint256 claimedAmount, uint256 cumulativeClaimable);
    error UnsafeRecipient(address recipient);
    error ZeroClaimDelta();
    error ClaimDeltaMismatch(uint256 returnedDelta, uint256 observedDelta);

    struct StoredClaim {
        uint256 cumulativeClaimable;
        bytes32 root;
        bool exists;
    }

    address public boostHub;
    address public immutable configurator;
    IStakeDaoUniversalRewardsDistributor public immutable urd;
    address public immutable rewardToken;

    StoredClaim private _claim;
    bytes32[] private _proof;
    uint256 private _entered;

    event BoostHubSet(address indexed boostHub);

    event ClaimSupplied(
        uint256 indexed pid,
        address indexed reward,
        uint256 cumulativeClaimable,
        bytes32 indexed root,
        address supplier
    );
    event ClaimExecuted(
        uint256 indexed pid,
        address indexed reward,
        uint256 cumulativeClaimable,
        uint256 claimedDelta
    );
    event ClaimInvalidated(
        uint256 indexed pid,
        address indexed reward,
        uint256 cumulativeClaimable,
        bytes32 storedRoot,
        bytes32 liveRoot,
        uint256 claimedAmount,
        address recipient
    );

    modifier nonReentrant() {
        if (_entered != 0) revert ReentrantCall();
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor(address configurator_) {
        _requireChain();
        if (configurator_ == address(0)) revert ZeroAddress();

        configurator = configurator_;
        rewardToken = APPROVED_REWARD_TOKEN;
        urd = IStakeDaoUniversalRewardsDistributor(APPROVED_URD);

        if (APPROVED_REWARD_TOKEN.code.length == 0) revert MissingCode(APPROVED_REWARD_TOKEN);
        if (APPROVED_URD.code.length == 0) revert MissingCode(APPROVED_URD);
    }

    /// @notice Permanently binds the newly deployed Hub after its constructor selects this helper.
    function setBoostHub(address boostHub_) external {
        if (msg.sender != configurator) revert OnlyConfigurator();
        if (boostHub != address(0)) revert BoostHubAlreadySet();
        if (boostHub_ == address(0)) revert ZeroAddress();
        if (boostHub_.code.length == 0) revert MissingCode(boostHub_);
        if (IBoostHub(boostHub_).systemInfo().stakeDaoClaimExecutor != address(this)) revert WrongClaimExecutor();
        boostHub = boostHub_;
        emit BoostHubSet(boostHub_);
    }

    /// @notice Permissionlessly stores a current cumulative sdFXS claim for the permanently bound Hub.
    function supplyClaim(uint256 cumulativeClaimable, bytes32[] calldata proof) external nonReentrant {
        _requireChain();
        if (boostHub == address(0)) revert BoostHubNotSet();
        if (cumulativeClaimable == 0) revert ZeroAmount();
        if (!_isRewardToken()) revert RewardTokenNotRegistered();

        bytes32 liveRoot = urd.root();
        if (liveRoot == bytes32(0)) revert MerkleRootNotSet();
        _requireSafeRecipient();

        uint256 claimedAmount = urd.claimed(boostHub, rewardToken);
        if (cumulativeClaimable <= claimedAmount) {
            revert ClaimAlreadyCompleted(claimedAmount, cumulativeClaimable);
        }

        bytes32 leaf = _leaf(cumulativeClaimable);
        if (_processProof(proof, leaf) != liveRoot) revert InvalidProof();

        delete _proof;
        for (uint256 i; i < proof.length; ++i) {
            _proof.push(proof[i]);
        }
        _claim = StoredClaim({cumulativeClaimable: cumulativeClaimable, root: liveRoot, exists: true});

        emit ClaimSupplied(PID, rewardToken, cumulativeClaimable, liveRoot, msg.sender);
    }

    /// @notice Executes the sdFXS claim inside BoostHub's per-token transaction boundary.
    /// @dev Other pools/tokens and absent claims are skipped; a failed transfer keeps its proof retryable.
    function claimToken(uint256 pid, address token) external nonReentrant {
        if (msg.sender != boostHub) revert OnlyBoostHub();
        _requireChain();
        if (pid != PID || token != rewardToken) return;

        StoredClaim memory claim_ = _claim;
        if (!claim_.exists) return;

        bytes32 liveRoot = urd.root();
        uint256 claimedAmount = urd.claimed(boostHub, rewardToken);
        address recipient = urd.recipients(boostHub);
        if (liveRoot != claim_.root || claim_.cumulativeClaimable <= claimedAmount) {
            _invalidateClaim(claim_, liveRoot, claimedAmount, recipient);
            return;
        }
        _requireSafeRecipient();
        if (!_isRewardToken()) revert RewardTokenNotRegistered();

        bytes32[] memory proof = _copyProof();
        uint256 beforeBalance = IERC20Balance(rewardToken).balanceOf(boostHub);

        delete _claim;
        delete _proof;

        uint256 returnedDelta = urd.claim(boostHub, rewardToken, claim_.cumulativeClaimable, proof);
        if (returnedDelta == 0) revert ZeroClaimDelta();

        uint256 afterBalance = IERC20Balance(rewardToken).balanceOf(boostHub);
        uint256 observedDelta = afterBalance - beforeBalance;
        if (observedDelta != returnedDelta) revert ClaimDeltaMismatch(returnedDelta, observedDelta);

        emit ClaimExecuted(PID, rewardToken, claim_.cumulativeClaimable, observedDelta);
    }

    /// @notice Clears a claim only after it becomes stale, fully claimed, or recipient-unsafe.
    function clearStaleClaim() external nonReentrant returns (bool cleared) {
        StoredClaim memory claim_ = _claim;
        if (!claim_.exists) return false;

        bytes32 liveRoot = urd.root();
        uint256 claimedAmount = urd.claimed(boostHub, rewardToken);
        address recipient = urd.recipients(boostHub);
        bool recipientSafe = recipient == address(0) || recipient == boostHub;
        if (claim_.root == liveRoot && claimedAmount < claim_.cumulativeClaimable && recipientSafe) return false;

        _invalidateClaim(claim_, liveRoot, claimedAmount, recipient);
        return true;
    }

    function getClaim() external view returns (StoredClaim memory claim_, bytes32[] memory proof) {
        claim_ = _claim;
        proof = _copyProof();
    }

    function isClaimCurrent() external view returns (bool) {
        StoredClaim memory claim_ = _claim;
        if (!claim_.exists) return false;
        address recipient = urd.recipients(boostHub);
        return claim_.root == urd.root() && urd.claimed(boostHub, rewardToken) < claim_.cumulativeClaimable
            && (recipient == address(0) || recipient == boostHub);
    }

    /// @notice Returns the updated BoostHub owner call: claimStakeDaoRewards(uint256).
    function buildBoostHubClaimCalldata() external pure returns (bytes memory data) {
        data = abi.encodeCall(IBoostHub.claimStakeDaoRewards, (PID));
    }

    /// @notice Reports whether a per-token Hub call targets this helper's Fraxtal sdFXS route.
    function isExecutionCallValid(uint256 pid, address token) external pure returns (bool) {
        return pid == PID && token == APPROVED_REWARD_TOKEN;
    }

    function _isRewardToken() internal view returns (bool) {
        address[] memory tokens = IBoostHub(boostHub).poolInfo(PID).rewardTokens;
        for (uint256 i; i < tokens.length; ++i) {
            if (tokens[i] == rewardToken) return true;
        }
        return false;
    }

    function _invalidateClaim(StoredClaim memory claim_, bytes32 liveRoot, uint256 claimedAmount, address recipient)
        internal
    {
        delete _claim;
        delete _proof;
        emit ClaimInvalidated(
            PID, rewardToken, claim_.cumulativeClaimable, claim_.root, liveRoot, claimedAmount, recipient
        );
    }

    function _requireSafeRecipient() internal view {
        address recipient = urd.recipients(boostHub);
        if (recipient != address(0) && recipient != boostHub) revert UnsafeRecipient(recipient);
    }

    function _requireChain() internal view {
        if (block.chainid != EXPECTED_CHAIN_ID) revert WrongChain(block.chainid);
    }

    function _leaf(uint256 cumulativeClaimable) internal view returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(boostHub, rewardToken, cumulativeClaimable));
        return keccak256(bytes.concat(inner));
    }

    function _copyProof() internal view returns (bytes32[] memory proof) {
        proof = new bytes32[](_proof.length);
        for (uint256 i; i < _proof.length; ++i) {
            proof[i] = _proof[i];
        }
    }

    function _processProof(bytes32[] calldata proof, bytes32 leaf) internal pure returns (bytes32 computedHash) {
        computedHash = leaf;
        for (uint256 i; i < proof.length; ++i) {
            bytes32 proofElement = proof[i];
            computedHash = computedHash <= proofElement
                ? keccak256(abi.encodePacked(computedHash, proofElement))
                : keccak256(abi.encodePacked(proofElement, computedHash));
        }
    }
}
