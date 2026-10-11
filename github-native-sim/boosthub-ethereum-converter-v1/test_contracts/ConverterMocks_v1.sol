// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract ConverterMockToken is ERC20 {
    uint8 private decimals_;
    constructor() ERC20("Converter test token", "TEST") {}
    function initializeDecimals(uint8 value) external { decimals_ = value; }
    function decimals() public view override returns (uint8) { return decimals_; }
    function mint(address to, uint256 value) external { _mint(to,value); }
}
contract ConverterMockWstEth is ConverterMockToken {
    address public constant STETH = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    uint256 public ratio;
    function setRatio(uint256 value) external { ratio=value; }
    function getStETHByWstETH(uint256 value) external view returns(uint256){ return value*ratio/1e18; }
    function unwrap(uint256 value) external returns(uint256 out){ _burn(msg.sender,value);out=value*ratio/1e18;ConverterMockToken(STETH).mint(msg.sender,out); }
}
contract ConverterMockOracle {
    uint256 public fee;
    uint256 public price;
    uint256 public indexedPrice;
    uint256 public legacyRate;
    bool public missingOracle;
    address public inputToken;
    address public outputToken;
    uint256 public exchangeRate;
    uint256 public lastMinimum;
    bool public ignoreMinimum;
    function configure(uint256 p,uint256 ip,uint256 f,uint256 r) external {price=p;indexedPrice=ip;fee=f;legacyRate=r;}
    function setMissingOracle(bool value) external { missingOracle=value; }
    function price_oracle() external view returns(uint256) { require(!missingOracle,"Missing oracle");return price; }
    function price_oracle(uint256 index) external view returns(uint256) { require(!missingOracle,"Missing oracle");return index==0?price:indexedPrice; }
    function get_dy(int128,int128,uint256 amount) external view returns(uint256) { return amount*legacyRate/1e18; }
    function get_dy(uint256,uint256,uint256 amount) external view returns(uint256) { return amount*legacyRate/1e18; }
    function configureExchange(address from,address to,uint256 r,bool ignore) external {inputToken=from;outputToken=to;exchangeRate=r;ignoreMinimum=ignore;}
    function exchange(uint256,uint256,uint256 amount,uint256 minimum) external returns(uint256) {return _exchange(amount,minimum);}
    function exchange(int128,int128,uint256 amount,uint256 minimum) external returns(uint256) {return _exchange(amount,minimum);}
    function _exchange(uint256 amount,uint256 minimum) internal returns(uint256 out) {
        lastMinimum=minimum;ConverterMockToken(inputToken).transferFrom(msg.sender,address(this),amount);
        out=amount*exchangeRate/1e18;if(!ignoreMinimum)require(out>=minimum,"Mock pool minimum");ConverterMockToken(outputToken).mint(msg.sender,out);
    }
}
contract ConverterMockRouter {
    uint256 public rate;
    uint256 public lastMinimum;
    bool public ignoreMinimum;
    uint256 public falseReturn;
    function configure(uint256 r,bool ignore,uint256 reported) external {rate=r;ignoreMinimum=ignore;falseReturn=reported;}
    function exchange_multiple(address[9] calldata route,uint256[3][4] calldata,uint256 amount,uint256 minimum)
        external payable returns(uint256 out) {
        require(msg.value==0,"No native route input in fixture");lastMinimum=minimum;
        ConverterMockToken(route[0]).transferFrom(msg.sender,address(this),amount);
        address tokenOut=route[2];for(uint256 i=4;i<9;i+=2){if(route[i]==address(0))break;tokenOut=route[i];}
        out=amount*rate/1e18;if(!ignoreMinimum)require(out>=minimum,"Mock router minimum");
        ConverterMockToken(tokenOut).mint(msg.sender,out);return falseReturn==0?out:falseReturn;
    }
}
