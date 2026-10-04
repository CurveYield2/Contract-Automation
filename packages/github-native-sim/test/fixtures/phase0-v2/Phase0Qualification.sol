// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

// Qualification-only fixture family for Phase-0 automated execution v2.
// It intentionally uses standard interface/contract names so recipe applicability
// comes from compiler/source intelligence inheritance evidence rather than packet names.

abstract contract ERC20 {
    function totalSupply() public view virtual returns (uint256);
    function balanceOf(address account) public view virtual returns (uint256);
    function transfer(address to, uint256 amount) public virtual returns (bool);
    function approve(address spender, uint256 amount) public virtual returns (bool);
    function allowance(address owner, address spender) public view virtual returns (uint256);
    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool);
}

contract QualifiedToken is ERC20 {
    uint256 private _totalSupply;
    mapping(address => uint256) private _balance;
    mapping(address => mapping(address => uint256)) private _allowance;

    constructor(address owner) {
        _totalSupply = 1_000_000 ether;
        _balance[owner] = _totalSupply;
    }

    function totalSupply() public view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view override returns (uint256) { return _balance[account]; }
    function allowance(address owner, address spender) public view override returns (uint256) { return _allowance[owner][spender]; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(to != address(0), "ZERO");
        require(_balance[msg.sender] >= amount, "BAL");
        unchecked {
            _balance[msg.sender] -= amount;
            _balance[to] += amount;
        }
        return true;
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(to != address(0), "ZERO");
        uint256 allowed = _allowance[from][msg.sender];
        require(allowed >= amount, "ALLOW");
        require(_balance[from] >= amount, "BAL");
        unchecked {
            _allowance[from][msg.sender] = allowed - amount;
            _balance[from] -= amount;
            _balance[to] += amount;
        }
        return true;
    }

    function burn(uint256 amount) external {
        require(_balance[msg.sender] >= amount, "BAL");
        unchecked {
            _balance[msg.sender] -= amount;
            _totalSupply -= amount;
        }
    }

    function property_supply_nonzero() external view returns (bool) {
        return _totalSupply > 0;
    }
}

abstract contract ERC4626 {
    function asset() public view virtual returns (address);
    function totalAssets() public view virtual returns (uint256);
    function totalSupply() public view virtual returns (uint256);
    function balanceOf(address owner) public view virtual returns (uint256);
    function deposit(uint256 assets, address receiver) public virtual returns (uint256);
    function mint(uint256 shares, address receiver) public virtual returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner) public virtual returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) public virtual returns (uint256);
}

contract QualifiedVault is ERC4626 {
    QualifiedToken public immutable underlying;
    uint256 private _shareSupply;
    mapping(address => uint256) private _shares;

    constructor() {
        underlying = new QualifiedToken(msg.sender);
    }

    function asset() public view override returns (address) { return address(underlying); }
    function totalAssets() public view override returns (uint256) { return underlying.balanceOf(address(this)); }
    function totalSupply() public view override returns (uint256) { return _shareSupply; }
    function balanceOf(address owner) public view override returns (uint256) { return _shares[owner]; }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        require(assets > 0, "ZERO");
        require(underlying.transferFrom(msg.sender, address(this), assets), "TRANSFER");
        _shares[receiver] += assets;
        _shareSupply += assets;
        return assets;
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        require(shares > 0, "ZERO");
        require(underlying.transferFrom(msg.sender, address(this), shares), "TRANSFER");
        _shares[receiver] += shares;
        _shareSupply += shares;
        return shares;
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
        require(owner == msg.sender, "OWNER");
        require(_shares[owner] >= assets, "SHARES");
        unchecked {
            _shares[owner] -= assets;
            _shareSupply -= assets;
        }
        require(underlying.transfer(receiver, assets), "TRANSFER");
        return assets;
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
        return withdraw(shares, receiver, owner);
    }

    function property_assets_equal_shares() external view returns (bool) {
        return totalAssets() == _shareSupply;
    }
}

abstract contract IERC3156FlashLender {
    function maxFlashLoan(address token) external view virtual returns (uint256);
    function flashFee(address token, uint256 amount) external view virtual returns (uint256);
    function flashLoan(address receiver, address token, uint256 amount, bytes calldata data) external virtual returns (bool);
}

interface IERC3156FlashBorrower {
    function onFlashLoan(address initiator, address token, uint256 amount, uint256 fee, bytes calldata data) external returns (bytes32);
}

contract FlashLender is IERC3156FlashLender {
    QualifiedToken public immutable token;
    uint256 public totalLoans;

    constructor() {
        token = new QualifiedToken(address(this));
    }

    function maxFlashLoan(address tokenAddress) external view override returns (uint256) {
        return tokenAddress == address(token) ? token.balanceOf(address(this)) : 0;
    }

    function flashFee(address tokenAddress, uint256) external view override returns (uint256) {
        require(tokenAddress == address(token), "TOKEN");
        return 0;
    }

    function flashLoan(address receiver, address tokenAddress, uint256 amount, bytes calldata data) external override returns (bool) {
        require(tokenAddress == address(token), "TOKEN");
        uint256 beforeBal = token.balanceOf(address(this));
        require(amount > 0 && amount <= beforeBal, "AMOUNT");
        require(token.transfer(receiver, amount), "SEND");
        bytes32 result = IERC3156FlashBorrower(receiver).onFlashLoan(msg.sender, tokenAddress, amount, 0, data);
        require(result == keccak256("ERC3156FlashBorrower.onFlashLoan"), "CALLBACK");
        require(token.balanceOf(address(this)) >= beforeBal, "UNPAID");
        totalLoans += 1;
        return true;
    }

    function property_liquidity_nonzero() external view returns (bool) {
        return token.balanceOf(address(this)) > 0;
    }
}

contract FlashBorrower is IERC3156FlashBorrower {
    address public immutable lender;

    constructor(address lenderAddress) {
        lender = lenderAddress;
    }

    function onFlashLoan(address, address token, uint256 amount, uint256, bytes calldata) external returns (bytes32) {
        require(msg.sender == lender, "CALLER");
        require(QualifiedToken(token).transfer(lender, amount), "REPAY");
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}

contract DelegateImplementation {
    address private immutable SELF;
    uint256 public delegateValue;

    constructor() { SELF = address(this); }

    function setDelegateValue(uint256 value) external {
        require(address(this) != SELF, "DIRECT_CONTEXT_REJECTED");
        delegateValue = value;
    }
}

contract DelegateProxy {
    bytes32 private constant IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("phase0.v2.implementation")) - 1);

    constructor(address impl) {
        assembly { sstore(IMPLEMENTATION_SLOT, impl) }
    }

    function implementation() external view returns (address impl) {
        assembly { impl := sload(IMPLEMENTATION_SLOT) }
    }

    fallback() external payable {
        assembly {
            let impl := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok case 0 { revert(0, returndatasize()) } default { return(0, returndatasize()) }
        }
    }
}

contract TupleArrayRouter {
    struct Action { address target; uint256 value; bytes data; }
    uint256 public totalBatches;

    function batch(Action[] calldata actions) external {
        if (actions.length == 0) return;
        totalBatches += actions.length;
    }
}

contract LookalikeToken {
    uint256 private _supply = 1000;
    mapping(address => uint256) private _balance;
    mapping(address => mapping(address => uint256)) private _allowance;

    constructor() { _balance[msg.sender] = _supply; }
    function totalSupply() external view returns (uint256) { return _supply; }
    function balanceOf(address a) external view returns (uint256) { return _balance[a]; }
    function allowance(address a, address b) external view returns (uint256) { return _allowance[a][b]; }
    function transfer(address to, uint256 amount) external returns (bool) { if (_balance[msg.sender] < amount) return false; _balance[msg.sender] -= amount; _balance[to] += amount; return true; }
    function approve(address spender, uint256 amount) external returns (bool) { _allowance[msg.sender][spender] = amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { if (_allowance[from][msg.sender] < amount || _balance[from] < amount) return false; _allowance[from][msg.sender] -= amount; _balance[from] -= amount; _balance[to] += amount; return true; }
}

contract PropertyControls {
    function nudge(uint256) external {}
    function property_control_true() external pure returns (bool) { return true; }
    function property_control_false() external pure returns (bool) { return false; }
}
