# Katana Route Probe Result v1

- chain_id: 747474
- router: 0x01F9894f92ea9224fECc8C35482E20a05De13582
- router_owner: 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49
- expected_safe: 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49
- safe_threshold: 1
- f(x)_pool: 0xE32B9b4C8f776687Ec54B4b6B62DbD9ce5fd4b99
- f(x)_pool_fxUSD: 0x1364b238C668A2dec1294174e4798E8c09979f86
- f(x)_pool_collateral: 0x0913DA6Da4b42f538B445599b46Bb4622342Cf52
- target_sushi_pool: 0x2d43e7931329dbb709f33d7049c937c6794bae10
- target_pool_token0: 0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36
- target_pool_token1: 0x4c03ff0f44A55e7098a09016E02a01d3cdC2FDF9
- target_pool_fee: 100
- sushi_factory_getPool: 0x2D43e7931329dbB709F33d7049C937c6794Bae10
- current_route_token0_to_token1: 0x
- current_route_token1_to_token0: 0x

## Router selectors
~~~text
0x0127c4e5	address,address,uint32,uint16                  	nonpayable	
0x01613415	address,address                                	nonpayable	
0x023b1fc9	uint16                                         	nonpayable	setFeeBps(uint16)
0x0eb6ca4d	                                               	pure      	
0x270e097a	address,address,uint16                         	nonpayable	
0x2b46bc6c	address,address                                	view      	routeFor(address,address)
0x40e4aaaa	address,address,uint256                        	view      	
0x5fcb2120	                                               	pure      	DEFAULT_TWAP_WINDOW()
0x8da5cb5b	                                               	view      	owner()
0xc0eedbc4	address,address                                	view      	
0xc290e7c5	address,address                                	nonpayable	removeRoute(address,address)
0xe20c448d	address,address,uint256,uint256,address,uint256	nonpayable	swapExactInput(address,address,uint256,uint256,address,uint256)
0xe41f93c0	address,address,bytes                          	view      	setRoute(address,address,bytes)
0xe74b981b	address                                        	nonpayable	setFeeRecipient(address)
0xf2fde38b	address                                        	nonpayable	transferOwnership(address)|_SIMONdotBLACK_(int8[],uint256,address,bytes8,int96)
0xfa461e33	uint256,uint256,bytes                          	view      	uniswapV3SwapCallback(int256,int256,bytes)|TestBrMSja(address,address,bytes)|TestbOOwoq(address,address,bytes)|func_12gJiTE()|TestLHlYaF(address,address,bytes)
~~~

## Candidate calldata encodings
~~~text
setRoute(address,address,bytes):
0xe41f93c0000000000000000000000000203a662b0bd271a6ed5a60edfbd04bfce608fd360000000000000000000000004c03ff0f44a55e7098a09016e02a01d3cdc2fdf900000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000
setRouteFeeBps(address,address,uint16):
0x270e097a000000000000000000000000203a662b0bd271a6ed5a60edfbd04bfce608fd360000000000000000000000004c03ff0f44a55e7098a09016e02a01d3cdc2fdf90000000000000000000000000000000000000000000000000000000000000000
setRouteTwapGuard(address,address,uint32,uint16):
0x0127c4e5000000000000000000000000203a662b0bd271a6ed5a60edfbd04bfce608fd360000000000000000000000004c03ff0f44a55e7098a09016e02a01d3cdc2fdf9000000000000000000000000000000000000000000000000000000000000038400000000000000000000000000000000000000000000000000000000000000c8
~~~
