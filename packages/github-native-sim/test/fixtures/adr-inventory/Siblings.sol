// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./Inheritance.sol";
contract SiblingA is SharedBase {
    modifier onlyAdmin() {require(msg.sender==address(0x1234)); _;}
    function sensitive() external onlyAdmin { counter++; }
}
contract SiblingB is SharedBase {
    function sensitive() external { counter++; }
}
