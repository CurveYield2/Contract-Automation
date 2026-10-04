// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

// HELD-OUT QUALIFICATION PACKET.
// Intentionally renamed/reordered relative to Phase0Qualification.sol.
// Production engine code must not contain conditionals for these names.

contract ActionBundle {
    struct Step { address destination; uint96 amount; bytes payload; }
    uint256 public batches;
    function execute(Step[] calldata steps) external {
        if (steps.length == 0) return;
        batches += steps.length;
    }
}

abstract contract ERC20 {
    function totalSupply() public view virtual returns (uint256);
    function balanceOf(address account) public view virtual returns (uint256);
    function transfer(address to, uint256 amount) public virtual returns (bool);
    function approve(address spender, uint256 amount) public virtual returns (bool);
    function allowance(address owner, address spender) public view virtual returns (uint256);
    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool);
}

contract IndigoAsset is ERC20 {
    uint256 private supply;
    mapping(address=>uint256) private balances;
    mapping(address=>mapping(address=>uint256)) private approvals;

    constructor(address initialOwner) {
        supply = 2_000_000 ether;
        balances[initialOwner] = supply;
    }

    function totalSupply() public view override returns(uint256){ return supply; }
    function balanceOf(address a) public view override returns(uint256){ return balances[a]; }
    function allowance(address a,address b) public view override returns(uint256){ return approvals[a][b]; }

    function transfer(address to,uint256 amount) public override returns(bool){
        require(to!=address(0),"ZERO");
        require(balances[msg.sender]>=amount,"BAL");
        unchecked { balances[msg.sender]-=amount; balances[to]+=amount; }
        return true;
    }
    function approve(address spender,uint256 amount) public override returns(bool){
        approvals[msg.sender][spender]=amount; return true;
    }
    function transferFrom(address from,address to,uint256 amount) public override returns(bool){
        require(to!=address(0),"ZERO");
        require(approvals[from][msg.sender]>=amount,"ALLOW");
        require(balances[from]>=amount,"BAL");
        unchecked {
            approvals[from][msg.sender]-=amount;
            balances[from]-=amount;
            balances[to]+=amount;
        }
        return true;
    }

    function burn(uint256 amount) external {
        require(balances[msg.sender]>=amount,"BAL");
        unchecked { balances[msg.sender]-=amount; supply-=amount; }
    }

    function property_asset_supply_positive() external view returns(bool){
        return supply>0;
    }
}

abstract contract ERC4626 {
    function asset() public view virtual returns(address);
    function totalAssets() public view virtual returns(uint256);
    function totalSupply() public view virtual returns(uint256);
    function balanceOf(address owner) public view virtual returns(uint256);
    function deposit(uint256 assets,address receiver) public virtual returns(uint256);
    function mint(uint256 shares,address receiver) public virtual returns(uint256);
    function withdraw(uint256 assets,address receiver,address owner) public virtual returns(uint256);
    function redeem(uint256 shares,address receiver,address owner) public virtual returns(uint256);
}

contract AmberContainer is ERC4626 {
    IndigoAsset public immutable backing;
    uint256 private shareSupply;
    mapping(address=>uint256) private shares;

    constructor(address initialOwner) {
        backing = new IndigoAsset(initialOwner);
    }

    function asset() public view override returns(address){ return address(backing); }
    function totalAssets() public view override returns(uint256){ return backing.balanceOf(address(this)); }
    function totalSupply() public view override returns(uint256){ return shareSupply; }
    function balanceOf(address owner) public view override returns(uint256){ return shares[owner]; }

    function deposit(uint256 assets,address receiver) public override returns(uint256){
        require(assets>0,"ZERO");
        require(backing.transferFrom(msg.sender,address(this),assets),"TRANSFER");
        shares[receiver]+=assets; shareSupply+=assets; return assets;
    }
    function mint(uint256 count,address receiver) public override returns(uint256){
        require(count>0,"ZERO");
        require(backing.transferFrom(msg.sender,address(this),count),"TRANSFER");
        shares[receiver]+=count; shareSupply+=count; return count;
    }
    function withdraw(uint256 assets,address receiver,address owner) public override returns(uint256){
        require(owner==msg.sender,"OWNER");
        require(shares[owner]>=assets,"SHARES");
        unchecked { shares[owner]-=assets; shareSupply-=assets; }
        require(backing.transfer(receiver,assets),"TRANSFER");
        return assets;
    }
    function redeem(uint256 count,address receiver,address owner) public override returns(uint256){
        return withdraw(count,receiver,owner);
    }

    function property_backing_matches_shares() external view returns(bool){
        return totalAssets()==shareSupply;
    }
}

contract ContextLogic {
    address private immutable self;
    uint256 public observed;
    constructor(){ self=address(this); }
    function setObserved(uint256 value) external {
        require(address(this)!=self,"DIRECT_ONLY_GAP");
        observed=value;
    }
}

contract ContextShell {
    address public implementation;
    constructor(address impl){ implementation=impl; }
    fallback() external payable {
        address impl=implementation;
        assembly {
            calldatacopy(0,0,calldatasize())
            let ok:=delegatecall(gas(),impl,0,calldatasize(),0,0)
            returndatacopy(0,0,returndatasize())
            switch ok case 0 { revert(0,returndatasize()) } default { return(0,returndatasize()) }
        }
    }
}

abstract contract IERC3156FlashLender {
    function maxFlashLoan(address token) external view virtual returns(uint256);
    function flashFee(address token,uint256 amount) external view virtual returns(uint256);
    function flashLoan(address receiver,address token,uint256 amount,bytes calldata data) external virtual returns(bool);
}
interface IERC3156FlashBorrower {
    function onFlashLoan(address initiator,address token,uint256 amount,uint256 fee,bytes calldata data) external returns(bytes32);
}

contract CobaltLender is IERC3156FlashLender {
    IndigoAsset public immutable token;
    uint256 public totalCompleted;
    constructor(){ token=new IndigoAsset(address(this)); }

    function maxFlashLoan(address tokenAddress) external view override returns(uint256){
        return tokenAddress==address(token)?token.balanceOf(address(this)):0;
    }
    function flashFee(address tokenAddress,uint256) external view override returns(uint256){
        require(tokenAddress==address(token),"TOKEN"); return 0;
    }
    function flashLoan(address receiver,address tokenAddress,uint256 amount,bytes calldata data) external override returns(bool){
        require(tokenAddress==address(token),"TOKEN");
        uint256 beforeBalance=token.balanceOf(address(this));
        require(amount>0&&amount<=beforeBalance,"AMOUNT");
        require(token.transfer(receiver,amount),"SEND");
        bytes32 answer=IERC3156FlashBorrower(receiver).onFlashLoan(msg.sender,tokenAddress,amount,0,data);
        require(answer==keccak256("ERC3156FlashBorrower.onFlashLoan"),"CALLBACK");
        require(token.balanceOf(address(this))>=beforeBalance,"REPAY");
        totalCompleted++;
        return true;
    }
    function property_lender_has_liquidity() external view returns(bool){
        return token.balanceOf(address(this))>0;
    }
}

contract SlateBorrower is IERC3156FlashBorrower {
    address public immutable lender;
    constructor(address lenderAddress){ lender=lenderAddress; }
    function onFlashLoan(address,address token,uint256 amount,uint256,bytes calldata) external returns(bytes32){
        require(msg.sender==lender,"CALLER");
        require(IndigoAsset(token).transfer(lender,amount),"REPAY");
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}

// Standard-looking ABI with no inherited standard basis: must remain a semantic gap.
contract MimicLedger {
    uint256 private supply=777;
    mapping(address=>uint256) private balances;
    mapping(address=>mapping(address=>uint256)) private approvals;
    constructor(){ balances[msg.sender]=supply; }
    function totalSupply() external view returns(uint256){ return supply; }
    function balanceOf(address a) external view returns(uint256){ return balances[a]; }
    function allowance(address a,address b) external view returns(uint256){ return approvals[a][b]; }
    function transfer(address to,uint256 amount) external returns(bool){ if(balances[msg.sender]<amount)return false; balances[msg.sender]-=amount; balances[to]+=amount; return true; }
    function approve(address spender,uint256 amount) external returns(bool){ approvals[msg.sender][spender]=amount; return true; }
    function transferFrom(address from,address to,uint256 amount) external returns(bool){ if(approvals[from][msg.sender]<amount||balances[from]<amount)return false; approvals[from][msg.sender]-=amount; balances[from]-=amount; balances[to]+=amount; return true; }
}
