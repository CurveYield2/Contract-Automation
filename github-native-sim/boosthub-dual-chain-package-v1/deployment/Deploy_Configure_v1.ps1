#requires -Version 5.1
<## Deploy/configure the compiled BoostHub stack on Ethereum and Fraxtal. Version v1. ##>
[CmdletBinding()]
param(
    [ValidateSet('Check','Deploy','Verify','AcceptRoles')][string]$Mode = 'Check',
    [ValidateSet('Both','Ethereum','Fraxtal')][string]$Chain = 'Both',
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'deployment_config_v1.json'),
    [string]$StateDirectory = (Join-Path $PSScriptRoot 'state_v1'),
    [string]$DeployerAddress,
    [string]$DeploymentId,
    [string]$EthereumRpcUrl,
    [string]$FraxtalRpcUrl,
    [string]$FraxtalVlBoost,
    [string]$FraxtalMerkleStash
)
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction Stop
$major = [int]((& $node.Source --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw 'Install Node.js 22 or newer, then reopen PowerShell.' }
$runner = Join-Path $PSScriptRoot 'deploy_runner_v1.cjs'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw 'Keep the complete extracted ZIP together; the bundled deployment runner is missing.' }
$config = (Resolve-Path -LiteralPath $ConfigPath).Path
$request = @{
    mode = $Mode; chain = $Chain; configPath = $config
    stateDirectory = [System.IO.Path]::GetFullPath($StateDirectory)
    rpcUrls = @{}; dependencyOverrides = @{}
}
if ($DeployerAddress) { $request.deployerAddress = $DeployerAddress }
if ($DeploymentId) { $request.deploymentId = $DeploymentId }
if ($EthereumRpcUrl) { $request.rpcUrls.ethereum = $EthereumRpcUrl }
if ($FraxtalRpcUrl) { $request.rpcUrls.fraxtal = $FraxtalRpcUrl }
if ($FraxtalVlBoost -or $FraxtalMerkleStash) {
    $request.dependencyOverrides.fraxtal = @{}
    if ($FraxtalVlBoost) { $request.dependencyOverrides.fraxtal.vlBoost = $FraxtalVlBoost }
    if ($FraxtalMerkleStash) { $request.dependencyOverrides.fraxtal.merkleStash = $FraxtalMerkleStash }
}
$secure = $null; $bstr = [IntPtr]::Zero; $plain = $null; $inputJson = $null
try {
    if ($Mode -in @('Deploy','AcceptRoles')) {
        $secure = Read-Host 'Signing private key (hidden; never saved)' -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $request.privateKey = $plain
    }
    $inputJson = $request | ConvertTo-Json -Depth 16 -Compress
    # Only the runner path is a command argument. Credentials travel through stdin.
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $node.Source
    $start.Arguments = '"' + $runner + '"'
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.EnvironmentVariables['BOOSTHUB_EXECUTE'] = '1'
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'Could not start the deployment runner.' }
    $process.StandardInput.WriteLine($inputJson)
    $process.StandardInput.Close()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'The runner stopped. Correct the reported issue, retain state_v1, and rerun the same command.' }
} finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if ($secure) { $secure.Dispose() }
    $request.Remove('privateKey'); $plain = $null; $inputJson = $null
}
