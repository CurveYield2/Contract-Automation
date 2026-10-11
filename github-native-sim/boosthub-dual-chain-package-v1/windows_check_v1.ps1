#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackageRoot)
$ErrorActionPreference='Stop'
$script=Join-Path $PackageRoot 'deployment\Deploy_Configure_v1.ps1'
$tokens=$null;$errors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw ($errors|Out-String)}
Write-Output ('Windows PowerShell version: '+$PSVersionTable.PSVersion.ToString())
Write-Output 'Deployment script syntax: PASS'
$deployer='0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
& $script -Mode Check -Chain Ethereum -DeployerAddress $deployer
& $script -Mode Check -Chain Fraxtal -DeployerAddress $deployer
Write-Output 'Extracted bundled deployment package on both selected chains: PASS (read-only)'
