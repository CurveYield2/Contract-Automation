param(
    [string]$RpcUrl,
    [ValidateRange(0,400)][int]$SlippageBps = 100,
    [string]$StateFile = 'Converter_Deployment_State_v1.json',
    [string]$ReportFile = 'Converter_Deployment_Plan_v1.json',
    [switch]$Broadcast,
    [switch]$Help
)
$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot 'deploy_converter_v1.cjs'
if ($Help) {
    & node $runner --help
    if ($LASTEXITCODE -ne 0) { throw 'Runner help failed' }
    return
}
if ([string]::IsNullOrWhiteSpace($RpcUrl)) { throw 'Provide -RpcUrl for Ethereum mainnet.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22 or newer is required.' }
$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }
if ($Broadcast -and [string]::IsNullOrWhiteSpace($env:PRIVATE_KEY)) { throw 'Set PRIVATE_KEY in this PowerShell process before using -Broadcast.' }
$runnerArgs = @($runner, '--rpc', $RpcUrl, '--slippage-bps', [string]$SlippageBps, '--state-file', $StateFile, '--report', $ReportFile)
if ($Broadcast) { $runnerArgs += '--broadcast' }
& node @runnerArgs
if ($LASTEXITCODE -ne 0) { throw 'Converter deployment runner failed.' }
