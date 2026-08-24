from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
src = root / 'contracts' / 'gauges' / 'CurveYieldGauge-v1.vy'
if not src.exists():
    raise SystemExit('FAIL: missing contracts/gauges/CurveYieldGauge-v1.vy')
text = src.read_text()

required = [
    'def __init__(_lp_token: address, _manager: address):',
    'self.lp_token = _lp_token',
    'self.manager = _manager',
    'def deposit(_value: uint256, _addr: address = msg.sender, _claim_rewards: bool = False):',
    'ERC20(self.lp_token).transferFrom(msg.sender, self, _value)',
    'def withdraw(_value: uint256, _claim_rewards: bool = False, _receiver: address = msg.sender):',
    'ERC20(self.lp_token).transfer(_receiver, _value)',
    'def deposit_reward_token(_reward_token: address, _amount: uint256, _epoch: uint256 = WEEK):',
    'def recover_remaining(_reward_token: address):',
    'def add_reward(_reward_token: address, _distributor: address):',
    'def set_reward_distributor(_reward_token: address, _distributor: address):',
    'assert msg.sender == self.manager  # dev: only manager',
    'assert msg.sender in [current_distributor, self.manager]',
    'assert _reward_token != self  # dev: do not use gauge token as reward token',
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'FAIL: required standalone-gauge behavior missing: {needle}')

forbidden = [
    'interface Factory:', 'FACTORY', 'root_gauge', 'voting_escrow', 'inflation_rate',
    'integrate_fraction', 'integrate_inv_supply', 'working_balances', 'working_supply',
    'def initialize(', 'def set_killed(', 'def set_root_gauge(', 'def update_voting_escrow(',
    'def claimable_tokens(', 'def user_checkpoint(', 'SetKilled', 'UpdateLiquidityLimit',
    'TOKENLESS_PRODUCTION', 'FACTORY.owner()', 'FACTORY.manager()', 'FACTORY.crv()',
]
for needle in forbidden:
    if needle in text:
        raise SystemExit(f'FAIL: Curve-specific surface remains: {needle}')

for needle in ['registry', 'pool_from_lp_token', 'is_curve', 'gauge_factory']:
    if needle.lower() in text.lower():
        raise SystemExit(f'FAIL: arbitrary want token is constrained by Curve-specific check: {needle}')

original = (root / 'reference' / 'curve' / 'ChildGauge.vy').read_text()
fragments = [
    'excess: uint256 = self.reward_remaining[token] - (period_finish - last_update + duration) * rate',
    'integral_change: uint256 = (duration * rate + excess) * 10**18 / _total_supply',
    'self.reward_remaining[token] -= integral_change * _total_supply / 10**18',
    'total_amount: uint256 = amount_received + self.reward_remaining[_reward_token]',
    'self.reward_data[_reward_token].rate = total_amount / _epoch',
    'assert period_finish < block.timestamp',
    'assert self.reward_data[_reward_token].last_update >= period_finish',
]
for fragment in fragments:
    if fragment not in original or fragment not in text:
        raise SystemExit(f'FAIL: original external-reward accounting fragment changed/missing: {fragment}')

def function_block(text, name):
    marker=f"def {name}("
    i=text.index(marker)
    start=text.rfind("\n\n",0,i)+2
    nxt=text.find("\n\n@",i)
    if nxt<0: nxt=len(text)
    return text[start:nxt].strip()

for fn in [
    '_checkpoint_rewards','claim_rewards','transferFrom','transfer','approve','permit',
    'increaseAllowance','decreaseAllowance','set_rewards_receiver','deposit_reward_token',
    'recover_remaining','claimed_reward','claimable_reward','decimals','version'
]:
    if function_block(original,fn)!=function_block(text,fn):
        raise SystemExit(f'FAIL: preserved function changed unexpectedly: {fn}')

print('PASS: standalone gauge removes Curve control/emissions surfaces and preserves core staking/external-reward accounting')
