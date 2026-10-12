// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITarget { function ping() external; }
interface IERC20Demo { function transfer(address to,uint amount) external returns(bool); }
contract PingImpl is ITarget { function ping() external override {} }

library DemoMath {
    function increment(uint256 a) internal pure returns(uint256) { return a+1; }
}
contract Main {
    uint256 public amount = 1;
    uint256 public constant BPS = 10000;
    uint256 public immutable CREATED;
    address public owner;
    mapping(address => bool) public used;
    modifier onlyOwner() { require(msg.sender == owner,"owner"); _; }
    constructor(uint256 initial) { CREATED = initial; owner=msg.sender; }
    function write(uint256 value) public onlyOwner { amount=value; }
    function internalHelper() internal { amount++; }
    function privateHelper() private { amount--; }
    function invokeHelpers() public { internalHelper(); privateHelper(); }
    function overloaded(uint256 value) public pure returns (uint256) {return value;}
    function overloaded(address value) public pure returns (address) {return value;}
    function callback(ITarget target) public { target.ping(); amount++; }
    function originCheck() public view returns(address) {return tx.origin;}
    function sendToken(IERC20Demo token,address to,uint256 value) public {token.transfer(to,value);}
    fallback() external payable { amount++; }
    receive() external payable { amount++; }
}
