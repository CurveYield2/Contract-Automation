require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
const {subtask}=require("hardhat/config");
const {TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD}=require("hardhat/builtin-tasks/task-names");
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async({solcVersion},hre,runSuper)=>{if(solcVersion==="0.8.28"){const solc=require("solc");return{compilerPath:require.resolve("solc/soljson.js"),isSolcJs:true,version:solcVersion,longVersion:solc.version()};}return runSuper();});
module.exports={solidity:{compilers:[{version:"0.8.28",settings:{optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:"cancun"}}]},networks:{hardhat:{chainId:1}},paths:{sources:"./contracts",tests:"./test-v3",cache:"./cache-v3",artifacts:"./artifacts-v3"},mocha:{timeout:120000}};
