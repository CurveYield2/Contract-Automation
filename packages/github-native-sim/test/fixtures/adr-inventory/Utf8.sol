// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// unicode: ❤️ 中文 🚀 — these multibyte bytes must not offset AST source line anchors
contract Utf8Example {
    function afterUnicode() public pure returns(uint256) {return 42;}
}
