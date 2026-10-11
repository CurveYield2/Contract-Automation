// SPDX-License-Identifier: UNLICENSED

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

pragma solidity 0.8.28;



import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";



import {IBoostHub} from "./interfaces/IBoostHub.sol";

import {IStakeDaoGauge} from "./interfaces/IStakeDaoGauge.sol";


import {IvlBoost} from "./interfaces/IvlBoost.sol";

import {BoostHubErrors as Errors} from "./libraries/BoostHubErrors.sol";



interface ISnapshotDelegateRegistry {
    function setDelegate(bytes32 spaceId, address delegate) external;
}

interface IStakeDaoClaimExecutor {

    function claimToken(uint256 pid, address token) external;

}



contract BoostHub is IBoostHub, Ownable, ReentrancyGuard {

    using SafeERC20 for IERC20;



    uint256 internal constant ACC_PRECISION = 1e18;

    uint256 internal constant MAX_REWARD_TOKENS = 8;

    uint256 internal constant FEE_DENOMINATOR = 10_000;

    uint256 internal constant MAX_PERFORMANCE_FEE_BPS = 2_000;


    uint256 internal constant INITIAL_CONFIG_WINDOW = 7 days;

    uint256 private immutable deployedAt;

    uint256 private constant CONFIG_CHANGE_DELAY = 10 days;

    bytes4 internal constant ERC1271_MAGICVALUE = 0x1626ba7e;

    bytes4 internal constant ERC1271_INVALID = 0xffffffff;

    bytes32 internal constant SNAPSHOT_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version)");

    bytes32 internal constant SNAPSHOT_NAME_HASH = keccak256("snapshot");

    bytes32 internal constant SNAPSHOT_VERSION_HASH = keccak256("0.1.4");

    bytes32 internal constant SNAPSHOT_VOTE_UINT32_TYPEHASH =

        keccak256("Vote(string from,string space,uint64 timestamp,string proposal,uint32 choice,string reason,string app,string metadata)");






    struct Pool {

        address asset;

        address gauge;

        bool active;

        uint256 totalStaked;

        address[] rewardTokens;

    }



    struct Position {

        uint256 principal;

        mapping(address => uint256) rewardDebt;

        mapping(address => uint256) claimable;

    }



    struct FeeConfig {

        uint16 platformFeeBps;


        address platformFeeRecipient;


    }



    struct PendingFeeConfig {

        FeeConfig config;

        uint256 readyAt;

        bool exists;

    }







    address private _pendingOwner;

    Pool[] internal pools;

    address private immutable vlBoost;

    address private immutable stakeDaoClaimExecutor;




    uint256 private ownershipTransferReadyAt;



    mapping(uint256 => FeeConfig) private poolFeeConfig;

    mapping(uint256 => PendingFeeConfig) private pendingPoolFeeConfig;

    mapping(uint256 => bool) private poolFeeConfigSet;




    // Tokens held for accrued user rewards, including undistributed rounding dust.
    mapping(address => uint256) private _rewardTokenReserves;



    mapping(uint256 => bytes4) private poolCheckpointSelector;

    mapping(uint256 => address) private poolDepositor;

    mapping(uint256 => bool) private poolDepositorLocked;

    mapping(address => bool) private gaugeAdded;

    mapping(uint256 => mapping(address => Position)) internal positions;

    mapping(uint256 => mapping(address => uint256)) private accRewardPerShare;


    mapping(bytes32 => bool) private approvedSnapshotVoteHash;






    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event TransactionsCleared();

    event PoolAdded(uint256 indexed pid, address indexed asset, address indexed gauge);

    event PoolActiveSet(uint256 indexed pid, bool active);

    event PoolDepositorSet(uint256 indexed pid, address indexed depositor);

    event PoolDepositorLocked(uint256 indexed pid, address indexed depositor);

    event PoolFeesSet(uint256 indexed pid, uint16 platformFeeBps, address platformFeeRecipient);

    event PoolFeesQueued(uint256 indexed pid, uint16 platformFeeBps, address platformFeeRecipient, uint256 readyAt);

    event PoolCheckpointSelectorSet(uint256 indexed pid, bytes4 selector);

    event PoolRewardTokenAdded(uint256 indexed pid, address indexed rewardToken);







    event GaugeCheckpointed(uint256 indexed pid);

    event BoostCheckpointed(address indexed account);

    event StakeDaoAddressesSet(address indexed vlBoost);

    event StakeDaoClaimExecutorSet(address indexed executor);


    event StakeDaoAggregateClaimed(uint256 indexed pid, address indexed executor);
    event StakeDaoRewardFailed(uint256 indexed pid, address indexed token);



    event VotingPowerDelegated(address indexed registry, bytes32 indexed spaceId, string space, address indexed delegate);

    event SnapshotVoteHashApproved(bytes32 indexed hash, bytes32 indexed spaceId);






    error TimelockNotReady();

    error NoPendingChange();
    error OnlySelf();






    error ZeroSnapshotVoteHash();






    constructor(address owner_, address vlBoost_, address stakeDaoClaimExecutor_) Ownable(owner_) {
        if (stakeDaoClaimExecutor_ == address(0)) revert Errors.ZeroAddress();
        deployedAt = block.timestamp;
        vlBoost = vlBoost_;
        stakeDaoClaimExecutor = stakeDaoClaimExecutor_;
        emit StakeDaoAddressesSet(vlBoost_);
        emit StakeDaoClaimExecutorSet(stakeDaoClaimExecutor_);
    }



    /// @notice Returns queued ownership and fee changes, including ready actions.
    /// @dev Array entries are present only while queued; readyAt preserves each action's timelock.
    function pendingTransactions() external view override returns (PendingTransactionsView memory view_) {
        view_.pendingOwner = _pendingOwner;
        view_.ownershipTransferReadyAt = ownershipTransferReadyAt;
        uint256 length = pools.length;
        uint256 feeCount;
        for (uint256 pid; pid < length; ++pid) {
            if (pendingPoolFeeConfig[pid].exists) ++feeCount;
        }

        view_.feeChanges = new PendingFeeView[](feeCount);
        uint256 feeIndex;
        for (uint256 pid; pid < length; ++pid) {
            if (pendingPoolFeeConfig[pid].exists) {
                PendingFeeConfig storage pending = pendingPoolFeeConfig[pid];
                view_.feeChanges[feeIndex++] = PendingFeeView({
                    pid: pid,
                    platformFeeBps: pending.config.platformFeeBps,
                    platformFeeRecipient: pending.config.platformFeeRecipient,
                    readyAt: pending.readyAt
                });
            }
        }
    }

    function transferOwnership(address newOwner) public override onlyOwner nonReentrant {
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
        ownershipTransferReadyAt = newOwner == address(0) ? 0 : _queuedTransactionReadyAt();
    }

    function _queuedTransactionReadyAt() internal view returns (uint256) {
        if (block.timestamp < deployedAt + INITIAL_CONFIG_WINDOW) return block.timestamp;
        return block.timestamp + CONFIG_CHANGE_DELAY;
    }

    function _transferOwnership(address newOwner) internal override {
        delete _pendingOwner;
        delete ownershipTransferReadyAt;
        super._transferOwnership(newOwner);
    }

    /// @notice Execute every queued transaction whose timelock has expired.
    /// @dev A ready ownership transfer must be accepted by the pending owner through this batch.
    /// All executions are atomic: a failed action reverts the entire batch.
    function executeTransactions() external nonReentrant {
        address newOwner = _pendingOwner;
        bool ownershipReady = newOwner != address(0) && block.timestamp >= ownershipTransferReadyAt;

        if (ownershipReady) {
            if (_msgSender() != newOwner) revert OwnableUnauthorizedAccount(_msgSender());
            _transferOwnership(newOwner);
        } else {
            _checkOwner();
        }


        uint256 length = pools.length;
        for (uint256 pid; pid < length; ++pid) {
            if (pendingPoolFeeConfig[pid].exists && block.timestamp >= pendingPoolFeeConfig[pid].readyAt) {
                _applyPoolFees(pid);
            }
        }

    }

    /// @notice Cancel every queued transaction, including ready and still-timelocked transactions.
    function clearTransactions() external onlyOwner nonReentrant {
        delete _pendingOwner;
        delete ownershipTransferReadyAt;

        uint256 length = pools.length;
        for (uint256 pid; pid < length; ++pid) {
            delete pendingPoolFeeConfig[pid];
        }

        emit TransactionsCleared();
    }












    function addPoolsBatch(

        address[] calldata assets,

        address[] calldata gauges,

        address[][] calldata rewardTokens

    ) external onlyOwner returns (uint256[] memory pids) {

        uint256 length = assets.length;

        if (length != gauges.length || length != rewardTokens.length) revert Errors.LengthMismatch();

        pids = new uint256[](length);

        for (uint256 i; i < length; ++i) {

            pids[i] = _addPool(assets[i], gauges[i], rewardTokens[i]);

        }

    }



    function _addPool(address asset, address gauge, address[] calldata rewardTokens) internal returns (uint256 pid) {

        if (asset == address(0) || gauge == address(0)) revert Errors.ZeroAddress();

        if (gaugeAdded[gauge]) revert Errors.DuplicateGauge();

        if (IStakeDaoGauge(gauge).staking_token() != asset) revert Errors.InvalidGaugeAsset();

        if (rewardTokens.length > MAX_REWARD_TOKENS) revert Errors.RewardTokenLimitExceeded();



        for (uint256 i; i < rewardTokens.length; i++) {

            if (rewardTokens[i] == address(0)) revert Errors.ZeroAddress();

            for (uint256 j; j < i; j++) {

                if (rewardTokens[i] == rewardTokens[j]) revert Errors.DuplicateRewardToken();

            }

        }



        pid = pools.length;

        pools.push();

        Pool storage pool = pools[pid];

        pool.asset = asset;

        pool.gauge = gauge;

        pool.active = true;

        gaugeAdded[gauge] = true;



        for (uint256 i; i < rewardTokens.length; i++) {

            _addRewardToken(pool, pid, rewardTokens[i]);

        }



        IERC20(asset).forceApprove(gauge, type(uint256).max);



        emit PoolAdded(pid, asset, gauge);

    }


















    function _applyPoolFees(uint256 pid) internal {

        _pool(pid);

        PendingFeeConfig memory pending = pendingPoolFeeConfig[pid];

        if (!pending.exists) revert NoPendingChange();

        if (block.timestamp < pending.readyAt) revert TimelockNotReady();



        poolFeeConfig[pid] = pending.config;

        poolFeeConfigSet[pid] = true;

        delete pendingPoolFeeConfig[pid];

        emit PoolFeesSet(

            pid,

            pending.config.platformFeeBps,


            pending.config.platformFeeRecipient


        );

    }



    /// @notice Sets depositors, optional permanent locks, checkpoints, queued fees and pool activity.
    /// @dev A locked depositor may be supplied again for fee updates, but cannot be replaced or deactivated.
    function setDepositors(
        uint256[] memory pids,
        address[] memory depositors,
        bool[] memory lockDepositors,
        bytes4[] memory checkpointSelectors,
        FeeConfig[] memory configs,
        bool[] memory active
    ) external onlyOwner {
        uint256 length = pids.length;
        if (
            length != depositors.length || length != lockDepositors.length ||
            length != checkpointSelectors.length || length != configs.length || length != active.length
        ) revert Errors.LengthMismatch();

        for (uint256 i; i < length; ++i) {
            uint256 pid = pids[i];
            _setPoolDepositor(pid, depositors[i], lockDepositors[i]);
            if (poolDepositorLocked[pid] && !active[i]) revert Errors.AlreadySet();

            if (checkpointSelectors[i] != bytes4(0)) {
                _setPoolCheckpointSelector(pid, checkpointSelectors[i]);
            }
            _setPoolFees(pid, configs[i]);

            Pool storage pool = _pool(pid);
            if (pool.active != active[i]) {
                pool.active = active[i];
                emit PoolActiveSet(pid, active[i]);
            }
        }
    }



    /// @notice Checkpoints vlBoost when configured, then the selected pools' gauges.
    /// @dev A zero vlBoost disables boost integration for chains such as Fraxtal.
    ///      Every requested gauge checkpoint must still succeed.
    function checkpoint(uint256[] calldata pids) external nonReentrant returns (bool) {
        if (vlBoost != address(0)) {
            IvlBoost(vlBoost).checkpointUser(address(this));
            emit BoostCheckpointed(address(this));
        }

        for (uint256 i; i < pids.length; ++i) {
            uint256 pid = pids[i];
            Pool storage pool = _pool(pid);
            bytes4 selector = poolCheckpointSelector[pid];
            if (selector == bytes4(0)) revert Errors.CheckpointSelectorNotSet();
            if (!_checkpointGauge(pool.gauge, selector)) revert Errors.CheckpointFailed();
            emit GaugeCheckpointed(pid);
        }
        return true;
    }











    /// @notice Returns deployment, timelock, integration addresses, delegated boost and pool count.
    function systemInfo() external view override returns (SystemView memory view_) {
        view_.deployedAt = deployedAt;
        view_.configChangeDelay = CONFIG_CHANGE_DELAY;
        view_.vlBoost = vlBoost;
        view_.stakeDaoClaimExecutor = stakeDaoClaimExecutor;
        view_.poolCount = pools.length;

        address registry = vlBoost;
        if (registry == address(0)) return view_;
        try IvlBoost(registry).delegatedIn(address(this)) returns (uint256 delegated) {
            view_.vlsdtDelegated = delegated;
        } catch {
            view_.vlsdtDelegated = 0;
        }
    }














    function delegateVotingPowerBatch(address registry, string[] calldata spaces, address delegate) external onlyOwner {

        if (spaces.length == 0) revert Errors.LengthMismatch();

        for (uint256 i; i < spaces.length; ++i) {

            _delegateVotingPower(registry, spaces[i], delegate);

        }

    }


    function approveSnapshotVoteUint32(

        string calldata from,

        string calldata space,

        uint64 timestamp,

        string calldata proposal,

        uint32 choice,

        string calldata reason,

        string calldata app,

        string calldata metadata

    ) external onlyOwner returns (bytes32 hash) {


        bytes32 spaceId = _snapshotSpaceId(space);

        bytes32 structHash = keccak256(abi.encode(

            SNAPSHOT_VOTE_UINT32_TYPEHASH,

            keccak256(bytes(from)),

            keccak256(bytes(space)),

            timestamp,

            keccak256(bytes(proposal)),

            choice,

            keccak256(bytes(reason)),

            keccak256(bytes(app)),

            keccak256(bytes(metadata))

        ));

        hash = _snapshotTypedDataHash(structHash);

        _approveSnapshotVoteHash(hash, spaceId);

    }



    function isValidSignature(bytes32 hash, bytes calldata) external view returns (bytes4) {


        return approvedSnapshotVoteHash[hash] ? ERC1271_MAGICVALUE : ERC1271_INVALID;

    }



    /// @notice Returns the pool, depositor, fees, retained stake and reward indexes.
    /// @dev Reward indexes follow the order of rewardTokens; this reads stored accounting only.
    function poolInfo(uint256 pid) external view override returns (PoolView memory view_) {
        Pool storage pool = _pool(pid);
        FeeConfig storage fees = poolFeeConfig[pid];
        view_.asset = pool.asset;
        view_.gauge = pool.gauge;
        view_.active = pool.active;
        view_.totalStaked = pool.totalStaked;
        view_.rewardTokens = pool.rewardTokens;
        view_.depositor = poolDepositor[pid];
        view_.depositorLocked = poolDepositorLocked[pid];
        view_.checkpointSelector = poolCheckpointSelector[pid];
        view_.platformFeeBps = fees.platformFeeBps;
        view_.platformFeeRecipient = fees.platformFeeRecipient;
        view_.feeConfigSet = poolFeeConfigSet[pid];

        uint256 length = pool.rewardTokens.length;
        view_.accRewardPerShare = new uint256[](length);
        for (uint256 i; i < length; ++i) {
            view_.accRewardPerShare[i] = accRewardPerShare[pid][pool.rewardTokens[i]];
        }
    }









    function deposit(uint256 pid, uint256 amount) external virtual override nonReentrant {

        if (amount == 0) revert Errors.ZeroAmount();



        Pool storage pool = _pool(pid);

        if (msg.sender != poolDepositor[pid]) revert Errors.StrategyNotApproved();

        if (!pool.active) revert Errors.PoolInactive();



        _harvest(pid, pool);

        _checkpoint(pid, msg.sender);



        IERC20(pool.asset).safeTransferFrom(msg.sender, address(this), amount);

        IStakeDaoGauge(pool.gauge).deposit(amount, address(this));



        pool.totalStaked += amount;

        positions[pid][msg.sender].principal += amount;

        _syncRewardDebt(pid, msg.sender);


    }



    function withdraw(uint256 pid, uint256 amount) external virtual override nonReentrant {

        if (amount == 0) revert Errors.ZeroAmount();



        Pool storage pool = _pool(pid);

        Position storage position = positions[pid][msg.sender];



        _checkpoint(pid, msg.sender);



        position.principal -= amount;

        pool.totalStaked -= amount;

        _syncRewardDebt(pid, msg.sender);



        IStakeDaoGauge(pool.gauge).withdraw(amount, false);

        IERC20(pool.asset).safeTransfer(msg.sender, amount);


    }



    function harvest(uint256 pid)

        external

        virtual

        override

        nonReentrant


        returns (address[] memory tokens, uint256[] memory amounts)

    {

        Pool storage pool = _pool(pid);

        (tokens, amounts) = _harvest(pid, pool);

    }



    /// @notice Claims available Merkle rewards; failed tokens remain retryable while healthy tokens complete.
    function claimStakeDaoRewards(uint256 pid)

        external

        onlyOwner

        nonReentrant


        returns (address[] memory tokens, uint256[] memory amounts)

    {

        address executor = stakeDaoClaimExecutor;

        if (executor == address(0)) revert Errors.ClaimExecutorNotSet();



        Pool storage pool = _pool(pid);

        _syncGaugeRewards(pid, pool);

        tokens = pool.rewardTokens;

        amounts = new uint256[](tokens.length);



        if (pool.totalStaked == 0) revert Errors.ZeroAmount();



        for (uint256 i; i < tokens.length; i++) {
            try this.processStakeDaoReward(pid, tokens[i]) returns (uint256 net) {
                amounts[i] = net;
            } catch {
                emit StakeDaoRewardFailed(pid, tokens[i]);
            }
        }


        emit StakeDaoAggregateClaimed(pid, executor);

    }

    /// @dev Per-token transaction boundary, callable only by BoostHub itself during collection.
    function processStakeDaoReward(uint256 pid, address token) external returns (uint256 net) {
        if (msg.sender != address(this)) revert OnlySelf();
        Pool storage pool = _pool(pid);
        uint256 beforeBalance = IERC20(token).balanceOf(address(this));

        IStakeDaoClaimExecutor(stakeDaoClaimExecutor).claimToken(pid, token);

        uint256 harvested = IERC20(token).balanceOf(address(this)) - beforeBalance;
        net = _chargeFees(pid, token, harvested);
        if (net > 0) {
            _rewardTokenReserves[token] += net;
            accRewardPerShare[pid][token] += net * ACC_PRECISION / pool.totalStaked;
        }
    }



    function _harvest(uint256 pid, Pool storage pool) internal returns (address[] memory tokens, uint256[] memory amounts) {

        _syncGaugeRewards(pid, pool);

        tokens = pool.rewardTokens;

        amounts = new uint256[](tokens.length);



        if (pool.totalStaked == 0) return (tokens, amounts);

        if (!_hasClaimableRewards(pool.gauge, tokens)) return (tokens, amounts);



        uint256[] memory beforeBalances = new uint256[](tokens.length);

        for (uint256 i; i < tokens.length; i++) {

            beforeBalances[i] = IERC20(tokens[i]).balanceOf(address(this));

        }



        IStakeDaoGauge(pool.gauge).claim_rewards(address(this), address(this));



        for (uint256 i; i < tokens.length; i++) {

            uint256 harvested = IERC20(tokens[i]).balanceOf(address(this)) - beforeBalances[i];

            uint256 net = _chargeFees(pid, tokens[i], harvested);


            amounts[i] = net;

            if (net > 0) {

                _rewardTokenReserves[tokens[i]] += net;

                accRewardPerShare[pid][tokens[i]] += net * ACC_PRECISION / pool.totalStaked;

            }

        }

    }



    function _hasClaimableRewards(address gauge, address[] memory tokens) internal view returns (bool) {

        for (uint256 i; i < tokens.length; i++) {

            if (IStakeDaoGauge(gauge).claimable_reward(address(this), tokens[i]) != 0) {

                return true;

            }

        }

        return false;

    }



    function _checkpointGauge(address gauge, bytes4 selector) internal returns (bool) {

        (bool checkpointSuccess, bytes memory checkpointResult) =

            gauge.call(abi.encodeWithSelector(selector, address(this)));

        if (!checkpointSuccess) return false;

        if (selector != IStakeDaoGauge.user_checkpoint.selector) return true;

        if (checkpointResult.length < 32) return false;

        return abi.decode(checkpointResult, (bool));

    }









    function _approveSnapshotVoteHash(bytes32 hash, bytes32 spaceId) internal {

        if (hash == bytes32(0)) revert ZeroSnapshotVoteHash();

        approvedSnapshotVoteHash[hash] = true;

        emit SnapshotVoteHashApproved(hash, spaceId);

    }



    function _snapshotDomainSeparator() internal pure returns (bytes32) {

        return keccak256(abi.encode(SNAPSHOT_DOMAIN_TYPEHASH, SNAPSHOT_NAME_HASH, SNAPSHOT_VERSION_HASH));

    }



    function _setPoolDepositor(uint256 pid, address depositor, bool lockDepositor) internal {
        if (depositor == address(0)) revert Errors.ZeroAddress();
        _pool(pid);
        if (poolDepositorLocked[pid] && poolDepositor[pid] != depositor) revert Errors.AlreadySet();

        if (poolDepositor[pid] != depositor) {
            poolDepositor[pid] = depositor;
            emit PoolDepositorSet(pid, depositor);
        }
        if (lockDepositor && !poolDepositorLocked[pid]) {
            poolDepositorLocked[pid] = true;
            emit PoolDepositorLocked(pid, depositor);
        }
    }



    function _setPoolFees(uint256 pid, FeeConfig memory config) internal {
        _pool(pid);
        _validateFeeConfig(config);
        uint256 readyAt = _queuedTransactionReadyAt();
        pendingPoolFeeConfig[pid] = PendingFeeConfig({config: config, readyAt: readyAt, exists: true});
        emit PoolFeesQueued(pid, config.platformFeeBps, config.platformFeeRecipient, readyAt);
    }



    function _setPoolCheckpointSelector(uint256 pid, bytes4 selector) internal {

        _pool(pid);

        if (selector == bytes4(0)) revert Errors.ZeroSelector();

        poolCheckpointSelector[pid] = selector;

        emit PoolCheckpointSelectorSet(pid, selector);

    }



    function _delegateVotingPower(address registry, string calldata space, address delegate) internal {

        if (registry == address(0) || delegate == address(0)) revert Errors.ZeroAddress();

        bytes32 spaceId = _snapshotSpaceId(space);

        ISnapshotDelegateRegistry(registry).setDelegate(spaceId, delegate);

        emit VotingPowerDelegated(registry, spaceId, space, delegate);

    }


    function _snapshotTypedDataHash(bytes32 structHash) internal pure returns (bytes32) {

        return keccak256(abi.encodePacked("\x19\x01", _snapshotDomainSeparator(), structHash));

    }



    function _snapshotSpaceId(string memory space) internal pure returns (bytes32 spaceId) {

        bytes memory spaceBytes = bytes(space);


        assembly {

            spaceId := mload(add(spaceBytes, 32))

        }

    }



    function _syncGaugeRewards(uint256 pid, Pool storage pool) internal {

        for (uint256 i; i < MAX_REWARD_TOKENS; i++) {

            address rewardToken = IStakeDaoGauge(pool.gauge).reward_tokens(i);

            if (rewardToken == address(0)) return;

            if (!_isRewardToken(pool, rewardToken)) {

                _addRewardToken(pool, pid, rewardToken);

            }

        }

    }



    function _addRewardToken(Pool storage pool, uint256 pid, address rewardToken) internal {

        if (rewardToken == address(0)) revert Errors.ZeroAddress();

        if (pool.rewardTokens.length >= MAX_REWARD_TOKENS) revert Errors.RewardTokenLimitExceeded();

        if (_isRewardToken(pool, rewardToken)) revert Errors.DuplicateRewardToken();

        pool.rewardTokens.push(rewardToken);

        emit PoolRewardTokenAdded(pid, rewardToken);

    }



    function _isRewardToken(Pool storage pool, address rewardToken) internal view returns (bool) {

        for (uint256 i; i < pool.rewardTokens.length; i++) {

            if (pool.rewardTokens[i] == rewardToken) return true;

        }

        return false;

    }



    /// @notice Claims the selected registered reward tokens; omitted rewards remain claimable.
    /// @dev A failing selected token reverts this call; omit it to claim the other tokens.
    function claim(uint256 pid, address[] calldata rewardTokens, address receiver)

        external

        virtual

        override

        nonReentrant

        returns (address[] memory tokens, uint256[] memory amounts)

    {

        if (receiver == address(0)) revert Errors.ZeroAddress();

        if (!_canClaim(pid, msg.sender)) revert Errors.StrategyNotApproved();



        _checkpoint(pid, msg.sender);



        Pool storage pool = _pool(pid);

        Position storage position = positions[pid][msg.sender];

        tokens = rewardTokens;

        amounts = new uint256[](tokens.length);



        for (uint256 i; i < tokens.length; i++) {

            address token = tokens[i];

            if (!_isRewardToken(pool, token)) revert Errors.RewardTokenNotRegistered();

            uint256 amount = position.claimable[token];

            amounts[i] = amount;

            if (amount == 0) continue;

            position.claimable[token] = 0;

            _rewardTokenReserves[token] -= amount;

            IERC20(token).safeTransfer(receiver, amount);

        }


    }









    /// @notice Returns principal, depositor approval and accrued rewards for an account.
    /// @dev Approval means the account is the selected depositor; pool activity is in poolInfo.
    function positionInfo(uint256 pid, address account)
        external
        view
        virtual
        override
        returns (PositionView memory view_)
    {
        Pool storage pool = _pool(pid);
        Position storage position = positions[pid][account];
        view_.principal = position.principal;
        view_.approved = poolDepositor[pid] == account;
        view_.rewardTokens = pool.rewardTokens;
        view_.pendingRewards = new uint256[](pool.rewardTokens.length);

        for (uint256 i; i < pool.rewardTokens.length; ++i) {
            address token = pool.rewardTokens[i];
            uint256 accumulated = position.principal * accRewardPerShare[pid][token] / ACC_PRECISION;
            uint256 pending = accumulated > position.rewardDebt[token] ? accumulated - position.rewardDebt[token] : 0;
            view_.pendingRewards[i] = position.claimable[token] + pending;
        }
    }



    function _pool(uint256 pid) internal view returns (Pool storage pool) {

        if (pid >= pools.length) revert Errors.InvalidPool();

        pool = pools[pid];

    }



    function _checkpoint(uint256 pid, address strategy) internal {

        Pool storage pool = _pool(pid);

        Position storage position = positions[pid][strategy];

        uint256 principal = position.principal;



        for (uint256 i; i < pool.rewardTokens.length; i++) {

            address token = pool.rewardTokens[i];

            uint256 accumulated = principal * accRewardPerShare[pid][token] / ACC_PRECISION;

            uint256 debt = position.rewardDebt[token];

            if (accumulated > debt) {

                position.claimable[token] += accumulated - debt;

            }

            position.rewardDebt[token] = position.principal * accRewardPerShare[pid][token] / ACC_PRECISION;

        }

    }



    function _syncRewardDebt(uint256 pid, address strategy) internal {

        Pool storage pool = _pool(pid);

        Position storage position = positions[pid][strategy];

        for (uint256 i; i < pool.rewardTokens.length; i++) {

            address token = pool.rewardTokens[i];

            position.rewardDebt[token] = position.principal * accRewardPerShare[pid][token] / ACC_PRECISION;

        }

    }



    function _canClaim(uint256 pid, address strategy) internal view returns (bool) {

        Pool storage pool = _pool(pid);

        Position storage position = positions[pid][strategy];

        if (poolDepositor[pid] == strategy || position.principal > 0) return true;



        for (uint256 i; i < pool.rewardTokens.length; i++) {

            if (position.claimable[pool.rewardTokens[i]] > 0) return true;

        }



        return false;

    }






    function _validateFeeConfig(FeeConfig memory config) internal pure {
        if (config.platformFeeBps > MAX_PERFORMANCE_FEE_BPS) revert Errors.InvalidFee();
        if (config.platformFeeBps > 0 && config.platformFeeRecipient == address(0)) revert Errors.ZeroAddress();
    }



    function _chargeFees(uint256 pid, address token, uint256 amount) internal returns (uint256 net) {
        if (!poolFeeConfigSet[pid]) revert Errors.InvalidFee();
        FeeConfig memory config = poolFeeConfig[pid];
        if (amount == 0 || config.platformFeeBps == 0) return amount;
        uint256 platformFee = amount * config.platformFeeBps / FEE_DENOMINATOR;
        if (platformFee > 0 && config.platformFeeRecipient != address(0)) {
            IERC20(token).safeTransfer(config.platformFeeRecipient, platformFee);
        }
        net = amount - platformFee;
    }



















}


