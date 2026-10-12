// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
abstract contract SharedBase {
    uint256 public counter;
    function inherited() public virtual { counter++; }
    modifier onlySuper() { require(msg.sender != address(0)); _; }
}
contract ChildOne is SharedBase { function unrelated() public pure returns(uint256){return 1;} }
contract ChildTwo is SharedBase { function unrelated() public pure returns(uint256){return 2;} }
