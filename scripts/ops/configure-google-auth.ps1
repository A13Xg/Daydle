<#
.SYNOPSIS
  Enable the Google provider in Supabase Auth with an existing Google OAuth web client.
.DESCRIPTION
  Prompts for the Client ID (visible) and Client Secret (hidden), then patches ONLY the three
  Google fields in the project's auth config. Credentials are stored in Supabase and nowhere else.
  In Google Cloud the client's authorized redirect URI must be:
      https://<project-ref>.supabase.co/auth/v1/callback
#>
param([string]$ProjectRef)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$ProjectRef = Resolve-ProjectRef $ProjectRef

$clientId = (Read-Host 'Google Client ID (ends in .apps.googleusercontent.com)').Trim()
if ($clientId -notmatch '^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$') { throw 'Client ID format looks wrong. Nothing saved.' }
$secret = Read-HiddenInput 'Google Client Secret'

Invoke-SupabaseApi -Method Patch -Path "/v1/projects/$ProjectRef/config/auth" -Body @{
  external_google_enabled   = $true
  external_google_client_id = $clientId
  external_google_secret    = $secret
} | Out-Null
$secret = $null

$c = Invoke-SupabaseApi -Path "/v1/projects/$ProjectRef/config/auth"
"google enabled : $($c.external_google_enabled)"
"client id saved: $($c.external_google_client_id -eq $clientId)"
"secret present : $([bool]$c.external_google_secret)"
