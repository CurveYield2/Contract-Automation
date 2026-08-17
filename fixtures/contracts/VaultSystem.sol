// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract TestToken {
    string public constant name = "Test Token";
    string public constant symbol = "TEST";
    uint8 public constant decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        require(approved >= amount, "allowance");
        allowance[from][msg.sender] = approved - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract TestStaking {
    TestToken public immutable token;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public pendingRewards;

    constructor(TestToken token_) {
        token = token_;
    }

    function stake(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "transfer");
        balanceOf[msg.sender] += amount;
    }

    function unstake(uint256 amount, address to) external {
        require(balanceOf[msg.sender] >= amount, "staked");
        balanceOf[msg.sender] -= amount;
        require(token.transfer(to, amount), "transfer");
    }

    function addRewards(address account, uint256 amount) external {
        token.mint(address(this), amount);
        pendingRewards[account] += amount;
    }

    function claim() external returns (uint256 amount) {
        amount = pendingRewards[msg.sender];
        pendingRewards[msg.sender] = 0;
        require(token.transfer(msg.sender, amount), "transfer");
    }
}

contract TestStrategy {
    TestToken public immutable token;
    TestStaking public immutable staking;
    address public vault;

    constructor(TestToken token_, TestStaking staking_) {
        token = token_;
        staking = staking_;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "vault");
        _;
    }

    function setVault(address vault_) external {
        require(vault == address(0), "set");
        vault = vault_;
    }

    function deposit(uint256 amount) external onlyVault {
        token.approve(address(staking), amount);
        staking.stake(amount);
    }

    function harvest() external {
        staking.claim();
        uint256 amount = token.balanceOf(address(this));
        if (amount > 0) {
            token.approve(address(staking), amount);
            staking.stake(amount);
        }
    }

    function withdraw(uint256 amount, address to) external onlyVault {
        staking.unstake(amount, address(this));
        token.transfer(to, amount);
    }
}

contract TestVault {
    TestToken public immutable token;
    TestStrategy public immutable strategy;
    mapping(address => uint256) public balanceOf;

    constructor(TestToken token_, TestStrategy strategy_) {
        token = token_;
        strategy = strategy_;
    }

    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(strategy), amount), "transfer");
        balanceOf[msg.sender] += amount;
        strategy.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "shares");
        balanceOf[msg.sender] -= amount;
        strategy.withdraw(amount, address(this));
        require(token.transfer(msg.sender, amount), "transfer");
    }
}
