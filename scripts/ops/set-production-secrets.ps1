<#
.SYNOPSIS
  Prompt (hidden) for the Supabase access token and Cloudflare API token and store both as GitHub
  environment secrets, back to back.
.NOTES
  Run in a normal PowerShell window; hidden prompts do not work inside non-interactive shells.
  Values are never printed. Only secret names and timestamps are listed afterwards.
#>
param(
  [string]$Repo,
  [string]$Environment = 'production'
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$Repo = Get-RepoSlug $Repo

$supabase = Read-HiddenInput 'Supabase access token (sbp_...)'
if ($supabase -notmatch '^sbp_') { throw 'Supabase tokens start with sbp_. Nothing saved.' }
$cloudflare = Read-HiddenInput 'Cloudflare API token'

try {
  $v = Invoke-RestMethod -Headers @{ Authorization = "Bearer $cloudflare" } 'https://api.cloudflare.com/client/v4/user/tokens/verify'
  "Cloudflare token status: $($v.result.status)"
} catch { 'Cloudflare verify skipped (account-owned tokens use a different endpoint).' }

$supabase | gh secret set SUPABASE_ACCESS_TOKEN --env $Environment --repo $Repo
$cloudflare | gh secret set CLOUDFLARE_API_TOKEN --env $Environment --repo $Repo
$supabase = $null; $cloudflare = $null

"--- secrets on '$Environment'"
gh secret list --env $Environment --repo $Repo
