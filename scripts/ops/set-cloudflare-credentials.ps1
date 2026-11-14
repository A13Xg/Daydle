<#
.SYNOPSIS
  Validate a Cloudflare API token, discover the account ID, and save both to a GitHub environment.
.DESCRIPTION
  Prompts (hidden) for the token, lists accounts, requires exactly one, then sets the
  CLOUDFLARE_API_TOKEN secret and CLOUDFLARE_ACCOUNT_ID variable. Saves nothing if validation fails.
  Prints only non-secret values.
#>
param(
  [string]$Repo,
  [string]$Environment = 'production'
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$Repo = Get-RepoSlug $Repo

$token = Read-HiddenInput 'Cloudflare API token'
$headers = @{ Authorization = "Bearer $token" }
$base = 'https://api.cloudflare.com/client/v4'

try { $v = Invoke-RestMethod -Headers $headers "$base/user/tokens/verify"; "verify (user token): status=$($v.result.status)" } catch { 'user-token verify not applicable' }

$accounts = $null
try { $accounts = (Invoke-RestMethod -Headers $headers "$base/accounts").result } catch { "Account list failed: $($_.Exception.Message)" }
if (-not $accounts) { throw 'Token cannot list accounts (needs Account > Account Settings > Read). Nothing saved.' }
"accounts visible: $(@($accounts).Count)"
if (@($accounts).Count -ne 1) { throw 'Expected exactly one account. Nothing saved; pass the right token or set the variable manually.' }
$accountId = @($accounts)[0].id
"account: $accountId"

try {
  $sub = (Invoke-RestMethod -Headers $headers "$base/accounts/$accountId/workers/subdomain").result.subdomain
  "workers.dev subdomain: $sub"
} catch { 'workers.dev subdomain: not registered (see register-workers-subdomain.ps1)' }

$token | gh secret set CLOUDFLARE_API_TOKEN --env $Environment --repo $Repo
gh variable set CLOUDFLARE_ACCOUNT_ID --env $Environment --repo $Repo --body $accountId
$token = $null
"Saved CLOUDFLARE_API_TOKEN (secret) and CLOUDFLARE_ACCOUNT_ID (variable) on '$Environment'."
