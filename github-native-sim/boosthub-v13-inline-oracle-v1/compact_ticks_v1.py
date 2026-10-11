from pathlib import Path
import sys,re
p=Path(sys.argv[1])
s=p.read_text()
assert 'library BHTickMath {' in s
first=re.search(r'absTick & (0x[0-9a-f]+) != 0 \? (0x[0-9a-f]+) : (0x[0-9a-f]+)',s)
assert first and first.group(1)=='0x1'
values=[first.group(2)]
values+=re.findall(r'if \(absTick & 0x[0-9a-f]+ != 0\) ratio = \(ratio \* (0x[0-9a-f]+)\)',s)
assert len(values)==20
literal=''.join(x[2:].zfill(32) for x in values)
assert len(literal)==640
new='''library BHTickMath {
    error TickOutOfBounds();
    bytes internal constant FACTORS=hex"'''+literal+'''";
    function sqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        int256 signedTick=int256(tick);
        uint256 absTick=uint256(signedTick<0 ? -signedTick : signedTick);
        if(absTick>887272) revert TickOutOfBounds();
        bytes memory factors=FACTORS;
        uint256 ratio=0x100000000000000000000000000000000;
        unchecked {
            for(uint256 bit=0;bit<20;++bit) {
                if((absTick & (1<<bit)) != 0) {
                    uint256 factor;
                    assembly { factor := shr(128,mload(add(add(factors,32),shl(4,bit)))) }
                    ratio=(ratio*factor)>>128;
                }
            }
            if(tick>0) ratio=type(uint256).max/ratio;
            sqrtPriceX96=uint160((ratio>>32)+(ratio % (1<<32) == 0 ? 0 : 1));
        }
    }
}
'''
s=s[:s.index('library BHTickMath {')]+new
p.write_text(s)
print('compacted 20 exact TickMath constants into 320-byte literal table')
