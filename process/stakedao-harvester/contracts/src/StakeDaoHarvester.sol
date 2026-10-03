// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IAccountant {
    function harvest(address[] calldata gauges, bytes[] calldata harvestData, address receiver) external;
}

interface IERC20Min {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IPriceFeed {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

interface ITricrypto {
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy, bool useEth, address receiver)
        external
        payable
        returns (uint256);
}

/// @title StakeDaoHarvester
/// @notice Harvests Stake DAO v2 Curve vaults for the CRV harvester fee, only when profitable (SPEC.md §6).
///         In every transaction:
///         1. each vault is harvested in its own sub-call; a vault whose profit (CRV received at the Chainlink CRV/ETH
///            price, minus its own gas) is below `minVaultProfitWei` is rolled back and skipped;
///         2. all CRV held is swapped to ETH on Curve tricrv;
///         3. the ETH fills the bot up to `botReserve` (its gas money, owner-configurable); the rest goes to `admin`;
///         4. the whole transaction reverts if the ETH received minus all of its gas is below `minTotalProfitWei`.
contract StakeDaoHarvester {
    IAccountant public constant ACCOUNTANT = IAccountant(0x93b4B9bd266fFA8AF68e39EDFa8cFe2A62011Ce0);
    IERC20Min public constant CRV = IERC20Min(0xD533a949740bb3306d119CC777fa900bA034cd52);
    IPriceFeed public constant CRV_ETH_FEED = IPriceFeed(0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e);
    ITricrypto public constant TRICRV = ITricrypto(0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14);
    uint256 internal constant TRICRV_CRV = 2;
    uint256 internal constant TRICRV_WETH = 1;
    /// @dev Chainlink CRV/ETH heartbeat is 24 h; a price older than this is refused.
    uint256 public constant MAX_PRICE_AGE = 26 hours;
    /// @dev Gas of the self-call + try/catch around each vault, not seen by the gasleft() measurement inside it.
    uint256 public constant PER_VAULT_CALL_GAS = 7_000;
    /// @dev Gas spent after the final gasleft() reading (return data, epilogue).
    uint256 public constant TAIL_GAS = 3_000;
    uint256 public constant MAX_SLIPPAGE_BPS = 500;
    /// @dev Gas kept back for the swap, payout and final checks (measured ~200k).
    uint256 public constant SETTLE_GAS = 300_000;
    /// @dev No point starting another vault with less than this (a warm harvest costs ~300k).
    uint256 public constant MIN_VAULT_GAS = 250_000;

    address public owner;
    address public pendingOwner;
    address public bot;
    address public admin;
    uint256 public botReserve;


    event Harvested(address indexed gauge, uint256 crv, uint256 gasUsed, uint256 profitWei);
    event Skipped(address indexed gauge, bytes reason);
    event Settled(uint256 harvested, uint256 crvSold, uint256 ethOut, uint256 toBot, uint256 toAdmin, int256 profitWei);
    event BotSet(address bot);
    event AdminSet(address admin);
    event BotReserveSet(uint256 botReserve);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotBot();
    error NotSelf();
    error ZeroAddress();
    error StalePrice();
    error BadSlippage();
    error VaultUnprofitable(uint256 profitWei, uint256 minProfitWei);
    error TotalUnprofitable(int256 profitWei, uint256 minProfitWei);
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, address bot_, address admin_, uint256 botReserve_) {
        if (owner_ == address(0) || bot_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        owner = owner_;
        bot = bot_;
        admin = admin_;
        botReserve = botReserve_;
        // one-time approval: saves ~20k gas per swap (CRV only allows changing a non-zero allowance via 0)
        CRV.approve(address(TRICRV), type(uint256).max);
        emit OwnershipTransferred(address(0), owner_);
        emit BotSet(bot_);
        emit AdminSet(admin_);
        emit BotReserveSet(botReserve_);
    }

    receive() external payable {}

    // ---------------------------------------------------------------- bot

    /// @param gauges Gauges to harvest (each in its own sub-call; unprofitable ones are skipped).
    /// @param minVaultProfitWei Minimum profit per vault, in wei of ETH (CRV valued at Chainlink).
    /// @param minTotalProfitWei Minimum profit of the transaction: ETH out of the swap minus all its gas.
    /// @param intrinsicGas Gas the EVM charges outside this call: 21,000 + calldata (computed by the bot).
    /// @param slippageBps Maximum swap slippage below the Chainlink price.
    /// @return harvested Number of vaults harvested.
    /// @return profitWei ETH received minus the transaction's gas cost.
    function harvest(
        address[] calldata gauges,
        uint256 minVaultProfitWei,
        uint256 minTotalProfitWei,
        uint256 intrinsicGas,
        uint256 slippageBps
    ) external returns (uint256 harvested, int256 profitWei) {
        uint256 gasStart = gasleft();
        if (msg.sender != bot) revert NotBot();
        if (slippageBps > MAX_SLIPPAGE_BPS) revert BadSlippage();
        uint256 price = _crvEthPrice();

        // 1. harvest, vault by vault — always leaving SETTLE_GAS for the swap + payout, so a gas limit that is too
        //    small only harvests fewer vaults instead of reverting the whole transaction
        for (uint256 i; i < gauges.length; ++i) {
            if (gasleft() < SETTLE_GAS + MIN_VAULT_GAS) break;
            try this.harvestOne{gas: gasleft() - SETTLE_GAS}(gauges[i], minVaultProfitWei, price) {
                ++harvested;
            } catch (bytes memory reason) {
                emit Skipped(gauges[i], reason);
            }
        }

        // 2. swap all CRV held to ETH
        uint256 crv = CRV.balanceOf(address(this));
        uint256 ethOut;
        if (crv != 0) {
            uint256 minOut = crv * price / 1e18 * (10_000 - slippageBps) / 10_000;
            ethOut = TRICRV.exchange(TRICRV_CRV, TRICRV_WETH, crv, minOut, true, address(this));
        }

        // 3. the bot keeps botReserve as gas money, everything above goes to the admin
        uint256 balance = address(this).balance;
        uint256 toBot;
        uint256 botBalance = bot.balance;
        if (botBalance < botReserve) {
            toBot = botReserve - botBalance;
            if (toBot > balance) toBot = balance;
            _sendEth(bot, toBot);
        }
        uint256 toAdmin = balance - toBot;
        if (toAdmin != 0) _sendEth(admin, toAdmin);

        // 4. the whole transaction must pay
        uint256 gasUsed = gasStart - gasleft() + intrinsicGas + TAIL_GAS;
        profitWei = int256(ethOut) - int256(gasUsed * tx.gasprice);
        if (profitWei < int256(minTotalProfitWei)) revert TotalUnprofitable(profitWei, minTotalProfitWei);
        emit Settled(harvested, crv, ethOut, toBot, toAdmin, profitWei);
    }

    /// @notice All vaults in ONE Accountant call (cheaper than `harvest`: no per-vault sub-calls). Any failing vault
    /// reverts the whole batch. `swap` = true: all CRV → ETH, bot refilled, profit = ETH received − all gas.
    /// `swap` = false: all CRV to `admin`, profit = CRV at Chainlink × (1 − slippageBps) − all gas.
    function harvestBatch(
        address[] calldata gauges,
        uint256 minTotalProfitWei,
        uint256 intrinsicGas,
        uint256 slippageBps,
        bool swap
    ) external returns (int256 profitWei) {
        uint256 gasStart = gasleft();
        if (msg.sender != bot) revert NotBot();
        if (slippageBps > MAX_SLIPPAGE_BPS) revert BadSlippage();
        uint256 price = _crvEthPrice();

        bytes[] memory data = new bytes[](gauges.length);
        ACCOUNTANT.harvest(gauges, data, address(this));
        uint256 crv = CRV.balanceOf(address(this));

        uint256 valueWei;
        uint256 toBot;
        uint256 toAdmin;
        if (swap) {
            if (crv != 0) {
                uint256 minOut = crv * price / 1e18 * (10_000 - slippageBps) / 10_000;
                valueWei = TRICRV.exchange(TRICRV_CRV, TRICRV_WETH, crv, minOut, true, address(this));
            }
            uint256 balance = address(this).balance;
            uint256 botBalance = bot.balance;
            if (botBalance < botReserve) {
                toBot = botReserve - botBalance;
                if (toBot > balance) toBot = balance;
                _sendEth(bot, toBot);
            }
            toAdmin = balance - toBot;
            if (toAdmin != 0) _sendEth(admin, toAdmin);
        } else {
            valueWei = crv * price / 1e18 * (10_000 - slippageBps) / 10_000;
            if (crv != 0 && !CRV.transfer(admin, crv)) revert TransferFailed();
        }

        uint256 gasUsed = gasStart - gasleft() + intrinsicGas + TAIL_GAS;
        profitWei = int256(valueWei) - int256(gasUsed * tx.gasprice);
        if (profitWei < int256(minTotalProfitWei)) revert TotalUnprofitable(profitWei, minTotalProfitWei);
        emit Settled(gauges.length, crv, valueWei, toBot, toAdmin, profitWei);
    }

    /// @notice One vault's harvest; only callable by this contract (from `harvest`). Reverts — rolling the vault's
    /// harvest back — when its profit is below `minProfitWei`.
    function harvestOne(address gauge, uint256 minProfitWei, uint256 price) external {
        uint256 gasStart = gasleft();
        if (msg.sender != address(this)) revert NotSelf();
        uint256 before = CRV.balanceOf(address(this));

        address[] memory one = new address[](1);
        one[0] = gauge;
        bytes[] memory data = new bytes[](1);
        ACCOUNTANT.harvest(one, data, address(this));

        uint256 crv = CRV.balanceOf(address(this)) - before;
        uint256 gasUsed = gasStart - gasleft() + PER_VAULT_CALL_GAS;
        uint256 value = crv * price / 1e18;
        uint256 cost = gasUsed * tx.gasprice;
        uint256 profit = value > cost ? value - cost : 0;
        if (value <= cost || profit < minProfitWei) revert VaultUnprofitable(profit, minProfitWei);
        emit Harvested(gauge, crv, gasUsed, profit);
    }

    // ---------------------------------------------------------------- views

    /// @notice CRV/ETH (18 decimals) from Chainlink; reverts when stale.
    function crvEthPrice() external view returns (uint256) {
        return _crvEthPrice();
    }

    // ---------------------------------------------------------------- owner

    function setBot(address bot_) external onlyOwner {
        if (bot_ == address(0)) revert ZeroAddress();
        bot = bot_;
        emit BotSet(bot_);
    }

    function setAdmin(address admin_) external onlyOwner {
        if (admin_ == address(0)) revert ZeroAddress();
        admin = admin_;
        emit AdminSet(admin_);
    }

    /// @notice The bot's gas money: ETH from each harvest fills the bot up to this, everything above goes to `admin`.
    function setBotReserve(uint256 botReserve_) external onlyOwner {
        botReserve = botReserve_;
        emit BotReserveSet(botReserve_);
    }

    /// @notice Recovers any token or ETH (token = address(0)) to `to`.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (token == address(0)) {
            _sendEth(to, amount);
        } else {
            (bool ok, bytes memory ret) = token.call(abi.encodeCall(IERC20Min.transfer, (to, amount)));
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    // ---------------------------------------------------------------- internals

    function _crvEthPrice() private view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = CRV_ETH_FEED.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
        return uint256(answer);
    }

    function _sendEth(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
