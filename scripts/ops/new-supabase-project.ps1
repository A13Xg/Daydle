<#
.SYNOPSIS
  Create the Supabase project (idempotent) and keep its database password in Windows Credential Manager.
.DESCRIPTION
  - Reuses an existing project with the same name instead of creating a duplicate.
  - Refuses to proceed unless the organization is on the free plan, unless -AllowPaid is passed.
  - Generates a 40-character random password in memory, stores it in Credential Manager BEFORE
    creating the project, and sends it in the request body (never on a command line or in a log).
.EXAMPLE
  ./scripts/ops/new-supabase-project.ps1 -Name 'Daydle' -OrganizationSlug <org-slug> -Region us-east-2
#>
param(
  [Parameter(Mandatory)][string]$Name,
  [Parameter(Mandatory)][string]$OrganizationSlug,
  [string]$Region = 'us-east-2',
  [string]$CredentialName = 'Daydle-Preview-Supabase-DB',
  [switch]$AllowPaid
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"

$org = Invoke-SupabaseApi -Path "/v1/organizations/$OrganizationSlug"
if ($org.plan -ne 'free' -and -not $AllowPaid) { throw "Organization plan is '$($org.plan)', not free. Re-run with -AllowPaid only if you accept charges." }

# Match the name only within the requested organization: a same-named project elsewhere is not a duplicate.
$existing = @(Invoke-SupabaseApi -Path '/v1/projects' | Where-Object { $_.name -eq $Name -and $_.organization_slug -eq $OrganizationSlug })
if ($existing.Count -gt 1) { throw "$($existing.Count) projects named '$Name' exist in organization '$OrganizationSlug'. Resolve the duplicates manually; nothing was created." }
if ($existing.Count -eq 1) { "Project already exists: ref=$($existing[0].id) region=$($existing[0].region)"; return }

if ([DaydleWinCred]::Get($CredentialName, $true)) {
  'Reusing existing database password entry.'
  $password = [DaydleWinCred]::Get($CredentialName, $true)
} else {
  $chars = (48..57) + (65..90) + (97..122) | ForEach-Object { [char]$_ }
  $bytes = New-Object byte[] 40
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $password = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Count] })
  if (-not [DaydleWinCred]::Set($CredentialName, 'postgres', $password)) { throw 'Could not save the password to Credential Manager.' }
  'Database password saved to Credential Manager.'
}

$created = Invoke-SupabaseApi -Method Post -Path '/v1/projects' -Body @{
  name = $Name; organization_slug = $OrganizationSlug; db_pass = $password; region = $Region
}
$password = $null
"Created project: ref=$($created.id) region=$($created.region) status=$($created.status)"
