#!/usr/bin/env python3
import csv,hashlib,json,os,subprocess,urllib.request,concurrent.futures
from pathlib import Path
ART=Path("prior-artifact/cyavKAT/upgrade/out")
EVIDENCE=Path("prior-artifact/katana-cyavkat-v21-evidence/deployment_gas_v1.json")
OUT=Path("cyavkat-v21-existing-check-v1"); OUT.mkdir(exist_ok=True)
RPCS=["https://rpc.katana.network/","https://katana.drpc.org/","https://rpc.katanarpc.com/"]
C={
"BurnRequestFeeFuse":[["Active","0x44D368e85f419C59aC01b7270D234d8BF19Df36e"],["OldManifest","0x9e3B6453126A508223A1b2225a9333E787Cc2027"]],
"ZeroBalanceFuse":[["ActiveMaxMarket","0xE3E28F04499470bAc1dAc842aEe424a185d14D42"],["ActiveSwapMarket","0x96393AcF49769a8C2318635fd27ab69F9c92bD1c"]],
"CallbackHandlerMorpho":[["OldManifest","0xEeC4F8af2e41D69600cc70882e90b89E7556cFC4"]],
"UpdateWithdrawManagerMaintenanceFuse":[["OldManifest","0x7d53B437f950d6F515C8871aC985F1e875d6B52E"]],
"CurveYieldAllocationController":[["OldManifest","0xE74ABa712d71282A156f80092A84Eb07D564fF63"]],
"CurveYieldVaultExecutor":[["OldManifest","0x3bA32500760e3Affd17b04634f7c8409168A3318"]],
"CurveYieldMorphoLoopController":[["OldManifest","0xf4b32155BeA17b075AEf88540e14F9835e16351B"]],
"CurveYieldWithdrawalManagerV2":[["OldManifest","0xd8b024c19250100aE2E89e7287d7b6bB60C2FEFD"]],
"CurveYieldAvkatLendController":[["OldManifestCollision","0xB53787F6b85E1bE7FEDabCfB6BBcd8bf6b1a8799"]],
"MorphoFlashLoanFuse":[["LiveCustomFuse","0x84927bFf2a35a543ed94A7d96D5ccd162a167947"]],
"UniversalTokenSwapperFuse":[["DifferentLiveRouterFuse","0x1fB8b83bAf40c90F0b450A3fd7A8b2E97Ab2a3Ff"]],
"CurveYieldSwapRouterV2":[["DifferentLiveRouterV3","0x01F9894f92ea9224fECc8C35482E20a05De13582"]],
"CurveYieldQuestSignerConfigFuse":[["LegacyQuestInstaller","0x4a94978F67C071e357158b55C64d867dFb69AeEb"]]}
K={
"morphoSupplyFuseMarket41":"0x1af82A748cd81958f419F7aCD0D12Ec2372BEa98",
"wrappedCyavkat":"0x10dF0e197bc1FEF44D1D1a648C2874c9cdC34692",
"wrapperFeeSplitter":"0xB53787F6b85E1bE7FEDabCfB6BBcd8bf6b1a8799",
"originalProfitCustody":"0xe7D109Ce6b34447Dd45B54e5615F4177291D5ADf",
"plasmaVault":"0xEd83daf48429cfb2C650Fd721b9241e180fd4548",
"accessManager":"0xd7f408f203c5c6a76c9c55c9f6b015929F151fAA",
"rewardsClaimManager":"0xA77470B748A8Fb50056Ca3c07375dC76Aa3A72Cb",
"originalWithdrawManager":"0x59B340EAb30AFE0cecD51C609d3190e8C75C40AE",
"currentVaultController":"0xbFdf2d2653859B66A8A15e1C85F6d6cdEe89698f",
"merklClaimFuse":"0xc6d024E53204CADa27a3c60C77dA4de2e7eb5166",
"questBaseWrapper":"0x0a9eA25C827Ec0C6B2619C231B7566846619B365"}
def rpc(method,params):
    last=""
    for url in RPCS:
        try:
            argv=["cast","rpc",method,*[json.dumps(x,separators=(",",":")) if isinstance(x,(dict,list)) else str(x) for x in params],"--rpc-url",url]
            raw=subprocess.check_output(argv,stderr=subprocess.PIPE,text=True,timeout=25).strip()
            try:return json.loads(raw)
            except json.JSONDecodeError:return raw
        except Exception as e:last=str(e)
    raise RuntimeError(last)

def compare(a,chain):
    data=a.get("deployedBytecode",{})
    raw=data.get("object","")
    if not raw.startswith("0x") or "__" in raw:return "no_linked_artifact",{}
    try:
        compiled=bytearray.fromhex(raw[2:])
        live=bytearray.fromhex(chain[2:])
    except ValueError:return "invalid_hex",{}
    if len(compiled)!=len(live):return "different_size",{"compiled_length":len(compiled),"live_length":len(live)}
    immutables=[]
    for values in data.get("immutableReferences",{}).values():
        for v in values:
            start,length=v["start"],v["length"]
            immutables.append({"start":start,"compiled":compiled[start:start+length].hex(),"live":live[start:start+length].hex()})
            compiled[start:start+length]=bytes(length)
            live[start:start+length]=bytes(length)
    for values in data.get("linkReferences",{}).values():
        for locs in values.values():
            for v in locs:
                start,length=v["start"],v["length"]
                compiled[start:start+length]=bytes(length)
                live[start:start+length]=bytes(length)
    return ("MATCH_RUNTIME_MASKED_IMMUTABLES" if compiled==live else "DIFFERENT_RUNTIME"),{"immutables":immutables}
def probe(job):
    name,label,addr=job
    out={"contract":name,"lead":label,"address":addr}
    try:
        live=rpc("eth_getCode",[addr,"latest"])
        out["code_exists"]=live!="0x"
        out["code_bytes"]=(len(live)-2)//2
        if live!="0x":
            out["code_sha256"]=hashlib.sha256(bytes.fromhex(live[2:])).hexdigest()
            art=ART/(name+".sol")/(name+".json")
            if art.exists():
                obj=json.loads(art.read_text())
                out["comparison"],extra=compare(obj,live)
                out.update(extra)
                names={x.get("name") for x in obj.get("abi",[]) if x.get("type")=="function" and not x.get("inputs")}
                for fn in ["MARKET_ID","MORPHO","VERSION"]:
                    if fn in names:
                        try:
                            sig=subprocess.check_output(["cast","sig",fn+"()"],text=True).strip()
                            result=rpc("eth_call",[{"to":addr,"data":sig},"latest"])
                            out[fn]=str(int(result,16)) if fn=="MARKET_ID" else result
                        except Exception as e:out[fn+"_error"]=str(e)
    except Exception as e:out["error"]=str(e)
    return out
cid=int(rpc("eth_chainId",[]),16)
assert cid==747474, f"Wrong chain {cid}"
block=int(rpc("eth_blockNumber",[]),16)
jobs=[(n,lab,addr) for n,rows in C.items() for lab,addr in rows]
jobs +=[(n,"prior-deployed-core",addr) for n,addr in K.items()]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: findings=list(pool.map(probe,jobs))
gas=json.loads(EVIDENCE.read_text())
summary=[]
for item in gas["contract_deployments"]:
    rows=[r for r in findings if r["contract"]==item["contract"]]
    matches=[r for r in rows if r.get("comparison")=="MATCH_RUNTIME_MASKED_IMMUTABLES"]
    other=[r for r in rows if r.get("code_exists") and r not in matches]
    summary.append({"contract":item["contract"],"sim_gas":item["gas_used"],"sim_eth":item["cost_eth"],
                    "runtime_match_addresses":[r["address"] for r in matches],
                    "nonmatching_or_unverified_addresses":[r["address"] for r in other],
                    "status":"potentially_reusable_verify_immutables" if matches else ("existing_different_or_unverified" if other else "no_matching_prior_address_identified")})
d={"chain_id":cid,"block_number":block,"source_sha256":gas["source_sha256"],
    "checked_addresses":findings,"deployment_table":summary,
    "caveats":["Pre-existing address/code alone does not establish compatibility.","MATCH_RUNTIME_MASKED_IMMUTABLES excludes immutable constructor values; inspect MARKET_ID and immutable values before reuse.","No unidentified deployments were assumed absent."]}
(OUT/"live_state_v1.json").write_text(json.dumps(d,indent=2))
with (OUT/"live_addresses_v1.csv").open("w",newline="") as f:
    cols=["contract","lead","address","code_exists","code_bytes","comparison","MARKET_ID","MORPHO","VERSION","error"]
    w=csv.DictWriter(f,cols,extrasaction="ignore");w.writeheader();w.writerows(findings)
with (OUT/"deployment_reuse_v1.csv").open("w",newline="") as f:
    cols=["contract","sim_gas","sim_eth","status","runtime_match_addresses","nonmatching_or_unverified_addresses"]
    w=csv.DictWriter(f,cols);w.writeheader()
    for r in summary:
        row=dict(r)
        row["runtime_match_addresses"]=";".join(r["runtime_match_addresses"])
        row["nonmatching_or_unverified_addresses"]=";".join(r["nonmatching_or_unverified_addresses"])
        w.writerow(row)
print("Checked Katana chain",cid,"block",block)
for r in findings:print(r["contract"],r["lead"],r["address"],r.get("code_exists"),r.get("comparison"),r.get("MARKET_ID"),r.get("error",""))
print("MATCHES",[(r["contract"],r["address"]) for r in findings if r.get("comparison")=="MATCH_RUNTIME_MASKED_IMMUTABLES"])
