<#
.SYNOPSIS
  Create or update a protected GitHub Actions environment and its non-secret variables (idempotent).
.DESCRIPTION
  - Requires the authenticated GitHub user as reviewer and limits deployments to the named branches.
  - Sets the Supabase variables (project ref, URL, publishable key) and the Cloudflare account ID.
  - Copies the Supabase database password from Credential Manager into the SUPABASE_DB_PASSWORD secret.
  - Tightens fork-PR workflow approval for the repository.
  - Does NOT set API tokens: use set-production-secrets.ps1 and set-cloudflare-credentials.ps1.
.EXAMPLE
  ./scripts/ops/init-github-environment.ps1 -Environment production -Branches main -ProjectRef <ref> -CloudflareAccountId <id>
#>
param(
  [string]$Repo,
  [string]$Environment = 'production',
  [string[]]$Branches = @('main'),
  [string]$ProjectRef,
  [string]$CloudflareAccountId,
  [string]$CredentialName = 'Daydle-Preview-Supabase-DB'
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$Repo = Get-RepoSlug $Repo
$ProjectRef = Resolve-ProjectRef $ProjectRef

gh api -X PUT "repos/$Repo/actions/permissions/fork-pr-contributor-approval" -f approval_policy=all_external_contributors | Out-Null
'Fork-PR workflow approval: all external contributors.'

$userId = [int](gh api user --jq .id)
$body = @{
  wait_timer = 0; prevent_self_review = $false
  reviewers = @(@{ type = 'User'; id = $userId })
  deployment_branch_policy = @{ protected_branches = $false; custom_branch_policies = $true }
} | ConvertTo-Json -Depth 5
$tmp = New-TemporaryFile
try {
  Set-Content -Path $tmp -Value $body -Encoding utf8
  gh api -X PUT "repos/$Repo/environments/$Environment" --input $tmp | Out-Null
} finally { Remove-Item $tmp -Force }
"Environment '$Environment' ready (required reviewer + custom branch policies)."

$have = @(gh api "repos/$Repo/environments/$Environment/deployment-branch-policies" --jq '.branch_policies[].name')
foreach ($b in $Branches) {
  if ($have -notcontains $b) { gh api -X POST "repos/$Repo/environments/$Environment/deployment-branch-policies" -f name=$b -f type=branch | Out-Null; "Allowed branch: $b" }
}

$publishable = (Invoke-SupabaseApi -Path "/v1/projects/$ProjectRef/api-keys" | Where-Object { $_.type -eq 'publishable' } | Select-Object -First 1).api_key
if ($publishable -notmatch '^sb_publishable_') { throw 'Could not find a publishable key. Nothing set. (Never use a secret key here.)' }

gh variable set SUPABASE_PROJECT_ID --env $Environment --repo $Repo --body $ProjectRef
gh variable set VITE_SUPABASE_URL --env $Environment --repo $Repo --body "https://$ProjectRef.supabase.co"
gh variable set VITE_SUPABASE_PUBLISHABLE_KEY --env $Environment --repo $Repo --body $publishable
if ($CloudflareAccountId) { gh variable set CLOUDFLARE_ACCOUNT_ID --env $Environment --repo $Repo --body $CloudflareAccountId }

Get-DbPassword $CredentialName | gh secret set SUPABASE_DB_PASSWORD --env $Environment --repo $Repo

'--- variables'; gh variable list --env $Environment --repo $Repo
'--- secrets (names only)'; gh secret list --env $Environment --repo $Repo
