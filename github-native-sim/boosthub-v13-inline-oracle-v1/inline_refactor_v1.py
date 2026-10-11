from pathlib import Path
import sys
root=Path(sys.argv[1]); variant=sys.argv[2]
engine=root/'BoostHubDexTwapRoutes_v2.sol'
eth=root/'BoostHubEthereumRewardConverter_v9.sol'
helper=root/'BoostHubV3TwapQuote_v1.sol'
h=helper.read_text()
assert 'contract BoostHubV3TwapQuote' in h and 'external view returns (uint256)' in h
h=h.replace('contract BoostHubV3TwapQuote {','library BoostHubV3TwapQuoteInline {',1)
h=h.replace(' external view returns (uint256)', ' internal view returns (uint256)',1)
helper.write_text(h)
s=engine.read_text()
s=s.replace('import {BoostHubV3TwapQuote} from "./BoostHubV3TwapQuote_v1.sol";','import {BoostHubV3TwapQuoteInline} from "./BoostHubV3TwapQuote_v1.sol";')
assert '    BoostHubV3TwapQuote public immutable v3TwapHelper;\n    constructor() { v3TwapHelper = new BoostHubV3TwapQuote(); }\n' in s
s=s.replace('    BoostHubV3TwapQuote public immutable v3TwapHelper;\n    constructor() { v3TwapHelper = new BoostHubV3TwapQuote(); }\n','',1)
s=s.replace('v3TwapHelper.quote(','BoostHubV3TwapQuoteInline.quote(')
engine.write_text(s)
if variant=='baseline': exit()
if variant not in ('oracle','oracle-base'):raise ValueError(variant)
s=eth.read_text()
a=s.index('    function _coinOraclePrice(address pool, uint256 coinIndex) internal view returns (uint256 price) {')
b=s.index('    function _oracleQuoteRoute(',a)
s=s[:a]+s[b:]
s=s.replace('_coinOraclePrice(pool, indexIn)', '_curveOracle(pool, uint8(indexIn))')
s=s.replace('_coinOraclePrice(pool, indexOut)', '_curveOracle(pool, uint8(indexOut))')
assert '_coinOraclePrice' not in s
eth.write_text(s)
if variant=='oracle':exit()
s=engine.read_text()
a=s.index('    function _curveQuote(Hop memory hop,uint256 amountIn) internal view returns (uint256) {')
b=s.index('    function _hopQuote(',a)
new='''    function _dexTokenBase(address token) internal view returns (uint256) {
        if (token==0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) return 1e18;
        uint8 d=IERC20Metadata(token).decimals();
        if (d>77) revert InvalidDexHop(0);
        return 10**uint256(d);
    }
    function _curveQuote(Hop memory hop,uint256 amountIn) internal view returns (uint256) {
        uint256 priceIn=_curveOracle(hop.pool,hop.indexIn);
        uint256 priceOut=_curveOracle(hop.pool,hop.indexOut);
        uint256 pricedIn=Math.mulDiv(amountIn,priceIn,_dexTokenBase(hop.tokenIn));
        return Math.mulDiv(pricedIn,_dexTokenBase(hop.tokenOut),priceOut);
    }
'''
s=s[:a]+new+s[b:]
engine.write_text(s)
s=eth.read_text()
a=s.index('    function _tokenBase(address token) internal view returns (uint256) {')
b=s.index('    function _quoteRoute(',a)
s=s[:a]+s[b:]
s=s.replace('_tokenBase(coinIn)','_dexTokenBase(coinIn)').replace('_tokenBase(coinOut)','_dexTokenBase(coinOut)')
assert '_tokenBase' not in s
eth.write_text(s)
