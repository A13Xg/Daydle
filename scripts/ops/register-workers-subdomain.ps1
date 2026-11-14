<#
.SYNOPSIS
  Read the account's workers.dev subdomain, or register one if none exists.
.NOTES
  Subdomains must be lowercase letters, digits and hyphens. Registering is effectively permanent and
  becomes part of every *.workers.dev URL on the account, so choose deliberately.
#>
param(
  [Parameter(Mandatory)][string]$Name,
  [Parameter(Mandatory)][string]$AccountId
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
if ($Name -cnotmatch '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$') { throw 'Use lowercase letters, digits and hyphens only.' }

$token = Read-HiddenInput 'Cloudflare API token'
$headers = @{ Authorization = "Bearer $token" }
$uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/workers/subdomain"

function Show-ApiError($e) {
  try { (($e.ErrorDetails.Message | ConvertFrom-Json).errors | ForEach-Object { "$($_.code): $($_.message)" }) -join '; ' }
  catch { $e.Exception.Message }
}

try {
  $current = (Invoke-RestMethod -Headers $headers $uri).result.subdomain
  "Existing subdomain: $current (nothing changed)"
  $token = $null; return
} catch { "No subdomain yet: $(Show-ApiError $_)" }

try {
  $r = Invoke-RestMethod -Method Put -Headers $headers -ContentType 'application/json' -Body (@{ subdomain = $Name } | ConvertTo-Json) $uri
  "Registered subdomain: $($r.result.subdomain)"
} catch { "Registration failed: $(Show-ApiError $_)" }
$token = $null
