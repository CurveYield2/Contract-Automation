# CurveYield Browser Home-Egress Setup v7
# Run from an elevated PowerShell prompt on the Windows PC that normally accesses ChatGPT.

param(
  [string]$KeyDirectory = "$env:USERPROFILE\.curveyield\home-proxy-v7"
)

$ErrorActionPreference = 'Stop'

function Require-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script from an elevated PowerShell prompt (Run as administrator).'
  }
}

function Set-SshdDirective {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Value
  )
  $content = Get-Content -LiteralPath $Path -Raw
  $pattern = "(?mi)^\s*#?\s*" + [regex]::Escape($Name) + "\s+.*$"
  $replacement = "$Name $Value"
  if ([regex]::IsMatch($content, $pattern)) {
    $content = [regex]::Replace($content, $pattern, $replacement, 1)
  } else {
    $content = $content.TrimEnd() + [Environment]::NewLine + $replacement + [Environment]::NewLine
  }
  Set-Content -LiteralPath $Path -Value $content -Encoding ascii
}

Require-Administrator

Write-Host '[v7] Checking Tailscale...'
$tailscale = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if (-not $tailscale) {
  throw 'Tailscale is not installed or tailscale.exe is not in PATH. Install/sign in to Tailscale first, then rerun this script.'
}
$tsStatus = & tailscale.exe status --json | ConvertFrom-Json
if (-not $tsStatus.Self.Online) {
  throw 'Tailscale is installed but this PC is not currently online in the tailnet.'
}
$tailscaleIPv4 = (& tailscale.exe ip -4 | Select-Object -First 1).Trim()
if (-not $tailscaleIPv4) { throw 'Could not determine the PC Tailscale IPv4 address.' }
Write-Host "[v7] Tailscale IPv4: $tailscaleIPv4"

Write-Host '[v7] Ensuring Windows OpenSSH Server is installed...'
$capability = Get-WindowsCapability -Online | Where-Object Name -Like 'OpenSSH.Server*' | Select-Object -First 1
if (-not $capability) { throw 'OpenSSH.Server Windows capability was not found on this system.' }
if ($capability.State -ne 'Installed') { Add-WindowsCapability -Online -Name $capability.Name | Out-Null }
Set-Service -Name sshd -StartupType Automatic
Start-Service sshd

$sshdConfig = 'C:\ProgramData\ssh\sshd_config'
if (-not (Test-Path -LiteralPath $sshdConfig)) { throw "sshd_config not found at $sshdConfig" }
$backup = "$sshdConfig.curveyield-v7-backup"
if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $sshdConfig -Destination $backup }
Set-SshdDirective -Path $sshdConfig -Name 'PubkeyAuthentication' -Value 'yes'
Set-SshdDirective -Path $sshdConfig -Name 'AllowTcpForwarding' -Value 'yes'
Set-SshdDirective -Path $sshdConfig -Name 'GatewayPorts' -Value 'no'

Write-Host '[v7] Restricting SSH firewall access to Tailscale address ranges...'
$existingDefault = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
if ($existingDefault) { Disable-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' | Out-Null }
$ruleName = 'CurveYield-Home-Egress-SSH-v7'
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 22 -RemoteAddress '100.64.0.0/10','fd7a:115c:a1e0::/48' | Out-Null

New-Item -ItemType Directory -Force -Path $KeyDirectory | Out-Null
$keyPath = Join-Path $KeyDirectory 'github-runner-home-egress-v7'
$pubPath = "$keyPath.pub"
if (-not (Test-Path -LiteralPath $keyPath)) {
  Write-Host '[v7] Generating dedicated GitHub-runner SSH key...'
  & ssh-keygen.exe -q -t ed25519 -N '""' -C 'curveyield-browser-home-egress-v7' -f $keyPath
  if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen failed.' }
}

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$groups = $currentIdentity.Groups | ForEach-Object { try { $_.Translate([Security.Principal.NTAccount]).Value } catch { $null } }
$isAdmin = $groups -contains 'BUILTIN\Administrators'
$publicKey = (Get-Content -LiteralPath $pubPath -Raw).Trim()

if ($isAdmin) {
  $authorizedKeys = 'C:\ProgramData\ssh\administrators_authorized_keys'
  New-Item -ItemType File -Force -Path $authorizedKeys | Out-Null
  $existing = Get-Content -LiteralPath $authorizedKeys -Raw -ErrorAction SilentlyContinue
  if ($existing -notmatch [regex]::Escape($publicKey)) { Add-Content -LiteralPath $authorizedKeys -Value $publicKey -Encoding ascii }
  & icacls.exe $authorizedKeys /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F' | Out-Null
} else {
  $sshDir = Join-Path $env:USERPROFILE '.ssh'
  New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
  $authorizedKeys = Join-Path $sshDir 'authorized_keys'
  New-Item -ItemType File -Force -Path $authorizedKeys | Out-Null
  $existing = Get-Content -LiteralPath $authorizedKeys -Raw -ErrorAction SilentlyContinue
  if ($existing -notmatch [regex]::Escape($publicKey)) { Add-Content -LiteralPath $authorizedKeys -Value $publicKey -Encoding ascii }
}

Restart-Service sshd

Write-Host ''
Write-Host '=== CurveYield home-egress v7 PC setup complete ==='
Write-Host "HOME_PROXY_TAILSCALE_HOST = $tailscaleIPv4"
Write-Host "HOME_PROXY_SSH_USER       = $env:USERNAME"
Write-Host "Private key file          = $keyPath"
Write-Host ''
Write-Host 'Add these repository secrets in GitHub:'
Write-Host '  TAILSCALE_AUTHKEY'
Write-Host '  HOME_PROXY_TAILSCALE_HOST'
Write-Host '  HOME_PROXY_SSH_USER'
Write-Host '  HOME_PROXY_SSH_PRIVATE_KEY'
Write-Host ''
Write-Host 'For HOME_PROXY_SSH_PRIVATE_KEY, copy the complete private-key file contents with:'
Write-Host "  Get-Content -LiteralPath '$keyPath' -Raw"
Write-Host ''
Write-Host 'When interactive view is enabled, use a VNC viewer on this PC and connect to:'
Write-Host '  127.0.0.1:5901'
Write-Host 'That port exists only while the GitHub workflow SSH tunnel is active.'
