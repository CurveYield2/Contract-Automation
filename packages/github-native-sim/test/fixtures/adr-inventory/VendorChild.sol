// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./vendor/VendorBase.sol";
contract VendorChild is VendorBase {function ownCall() public pure returns(uint256){return 8;}}
