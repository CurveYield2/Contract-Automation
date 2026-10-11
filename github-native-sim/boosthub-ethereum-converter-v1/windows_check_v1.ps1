param([string]$PackageRoot)
$ErrorActionPreference = 'Stop'
$PackageRoot = (Resolve-Path $PackageRoot).Path
$script = Join-Path $PackageRoot 'deployment/Deploy-Converter_v1.ps1'
& $script -Help
if (-not $?) { throw 'Packaged PowerShell runner failed' }
$artifact = Get-Content -LiteralPath (Join-Path $PackageRoot 'artifacts_v1/BoostHubEthereumRewardConverter_v1.json') -Raw | ConvertFrom-Json
if ($artifact.contractName -ne 'BoostHubEthereumRewardConverter') { throw 'Incorrect converter artifact' }
$inventory = Get-Content -LiteralPath (Join-Path $PackageRoot 'Ethereum_Route_Inventory_v1.json') -Raw | ConvertFrom-Json
if ($inventory.routes.Count -ne 4) { throw 'Expected four swap routes' }
$sums = Get-Content -LiteralPath (Join-Path $PackageRoot 'SHA256SUMS_v1.txt')
foreach ($line in $sums) {
    $parts = $line -split '  ', 2
    $file = Join-Path $PackageRoot $parts[1]
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $parts[0]) { throw ('Checksum mismatch: ' + $parts[1]) }
}
Write-Output 'PASS: Windows PowerShell 5.1 command, release artifact, four routes, and all checksums.'
