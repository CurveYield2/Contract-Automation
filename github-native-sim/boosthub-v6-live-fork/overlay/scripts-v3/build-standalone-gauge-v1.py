#!/usr/bin/env python3
from pathlib import Path
import hashlib

root=Path(__file__).resolve().parents[1]
src=root/'reference/curve/ChildGauge.vy'
out=root/'contracts/gauges/CurveYieldGauge-v1.vy'
s=src.read_text()

def req_replace(old,new,count=1):
    global s
    if s.count(old) < count:
        raise SystemExit('missing expected source fragment: '+old[:120].replace('\n','\\n'))
    s=s.replace(old,new,count)

def cut(start,end):
    global s
    a=s.find(start)
    if a<0: raise SystemExit('missing cut start: '+start[:100])
    b=s.find(end,a)
    if b<0: raise SystemExit('missing cut end: '+end[:100])
    s=s[:a]+s[b:]

req_replace('@title CurveXChainLiquidityGauge','@title CurveYieldStandaloneGauge')
req_replace('@author Curve.Fi\n@notice Layer2/Cross-Chain Gauge\n@custom:version 1.1.0','@author Curve.Fi; surgically adapted for CurveYield\n@notice Standalone staking gauge derived from Curve ChildGauge v1.1.0\n@custom:version 1.0.0')
cut('interface Factory:\n','event Deposit:\n')
cut('event SetKilled:\n','event SetGaugeManager:\n')
req_replace('TOKENLESS_PRODUCTION: constant(uint256) = 40\n','')
req_replace('VERSION: constant(String[8]) = "1.1.0"','VERSION: constant(String[8]) = "1.0.0"')
req_replace('voting_escrow: public(address)\n\n\n','')
req_replace('FACTORY: immutable(Factory)\n','')
req_replace('\nis_killed: public(bool)\n\ninflation_rate: public(HashMap[uint256, uint256])\n','\n')
cut('working_balances: public(HashMap[address, uint256])\n','# array of reward tokens\n')
cut('period_timestamp: public(HashMap[int128, uint256])\n','@external\ndef __init__(_factory: Factory):\n')
cut('@external\ndef __init__(_factory: Factory):\n','# Internal Functions\n')
constructor='''@external\ndef __init__(_lp_token: address, _manager: address):\n    """\n    @notice Deploy a standalone staking gauge\n    @param _lp_token ERC20 token to lock in\n    @param _manager Manager of rewards for the gauge\n    """\n    self.lp_token = _lp_token\n    self.manager = _manager\n    log SetGaugeManager(_manager)\n\n    symbol: String[32] = ERC20Extended(_lp_token).symbol()\n    name: String[64] = concat("CurveYield ", symbol, " Gauge Deposit")\n\n    self.name = name\n    self.symbol = concat(symbol, "-gauge")\n    self.salt = block.prevhash\n\n    self.DOMAIN_SEPARATOR = keccak256(\n        _abi_encode(\n            EIP712_TYPEHASH,\n            keccak256(name),\n            keccak256(VERSION),\n            chain.id,\n            self,\n            self.salt,\n        )\n    )\n\n\n'''
idx=s.find('# Internal Functions\n')
s=s[:idx]+constructor+s[idx:]
cut('@internal\ndef _checkpoint(_user: address):\n','@internal\ndef _checkpoint_rewards')
cut('@internal\ndef _update_liquidity_limit(_user: address, _user_balance: uint256, _total_supply: uint256):\n','@internal\ndef _transfer')
for line in [
    '    self._checkpoint(_from)\n', '    self._checkpoint(_to)\n',
    '        self._update_liquidity_limit(_from, new_balance, total_supply)\n',
    '        self._update_liquidity_limit(_to, new_balance, total_supply)\n',
    '    self._checkpoint(_addr)\n','        self._update_liquidity_limit(_addr, new_balance, total_supply)\n',
    '    self._checkpoint(msg.sender)\n','        self._update_liquidity_limit(msg.sender, new_balance, total_supply)\n',
]: req_replace(line,'')
cut('@external\ndef user_checkpoint(addr: address) -> bool:\n','@external\ndef set_rewards_receiver')
req_replace('''    @dev The manager of this contract, or the ownership admin can outright modify gauge\n        managership. A gauge manager can also transfer managership to a new manager via this\n        method, but only for the gauge which they are the manager of.\n''','''    @dev The current gauge manager can transfer managership to a new manager.\n''',2)
req_replace('    assert msg.sender in [self.manager, FACTORY.owner()]  # dev: only manager or factory admin\n','    assert msg.sender == self.manager  # dev: only manager\n',2)
req_replace('    assert msg.sender in [self.manager, FACTORY.owner()]  # dev: only manager or factory admin\n    assert _reward_token not in [FACTORY.crv().address, self]  # dev: can not distinguish CRV reward from CRV emission; do not use gauge token as reward token\n','    assert msg.sender == self.manager  # dev: only manager\n    assert _reward_token != self  # dev: do not use gauge token as reward token\n')
req_replace('    assert msg.sender in [current_distributor, FACTORY.owner(), self.manager]\n','    assert msg.sender in [current_distributor, self.manager]\n')
cut('@external\ndef set_killed(_is_killed: bool):\n','# View Methods\n')
cut('@external\ndef claimable_tokens(addr: address) -> uint256:\n','@view\n@external\ndef decimals()')
marker='\n\n@view\n@external\ndef factory() -> Factory:\n'
a=s.find(marker)
if a<0: raise SystemExit('missing trailing factory view')
s=s[:a].rstrip()+"\n"
for old,new in [
    ('lp_token: public(address)\n\n\n# For tracking external rewards','lp_token: public(address)\n\n# For tracking external rewards'),
    ('    """\n    @notice Transfer tokens as well as checkpoint users\n    """\n\n    if _value != 0:','    """\n    @notice Transfer tokens as well as checkpoint users\n    """\n    if _value != 0:'),
    ('        self.balanceOf[_from] = new_balance\n\n        if is_rewards:','        self.balanceOf[_from] = new_balance\n        if is_rewards:'),
    ('        self.balanceOf[_to] = new_balance\n\n    log Transfer','        self.balanceOf[_to] = new_balance\n    log Transfer'),
    ('    assert _addr != empty(address)  # dev: cannot deposit for zero address\n\n    if _value != 0:','    assert _addr != empty(address)  # dev: cannot deposit for zero address\n    if _value != 0:'),
    ('        self.totalSupply = total_supply\n\n\n        ERC20(self.lp_token).transferFrom','        self.totalSupply = total_supply\n\n        ERC20(self.lp_token).transferFrom'),
    ('    @param _receiver Receiver of withdrawn LP tokens\n    """\n\n    if _value != 0:','    @param _receiver Receiver of withdrawn LP tokens\n    """\n    if _value != 0:'),
    ('        self.totalSupply = total_supply\n\n\n        ERC20(self.lp_token).transfer(_receiver','        self.totalSupply = total_supply\n\n        ERC20(self.lp_token).transfer(_receiver'),
]:
    s=s.replace(old,new)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(s)
print('source_sha256='+hashlib.sha256(src.read_bytes()).hexdigest())
print('output_sha256='+hashlib.sha256(out.read_bytes()).hexdigest())
print('wrote '+str(out))
