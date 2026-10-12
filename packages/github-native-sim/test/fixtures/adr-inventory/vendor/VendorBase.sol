// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract VendorBase {
    function vendorCall() public virtual returns(uint256) { return 7; }
}
