<#
.SYNOPSIS
  Build with the environment's public Supabase values and deploy the Worker; attach the custom domain
  declared in wrangler.jsonc; then verify the live site.
.DESCRIPTION
  - Reads VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and CLOUDFLARE_ACCOUNT_ID from the GitHub
    environment variables (public values only).
  - Prompts (hidden) for the Cloudflare API token and keeps it in this process's environment only.
  - Token permissions needed: Account > Workers Scripts > Edit; Account > Account Settings > Read;
    and, to create the custom-domain DNS record, Zone > DNS > Edit and Zone > Workers Routes > Edit
    scoped to the domain's zone.
  - Refuses to deploy a dirty working tree unless -AllowDirty is passed.
  - Refuses to deploy anything except the current tip of origin/main unless -AllowNonMain is passed.
    The GitHub environment's required reviewer and main-only rule apply to GitHub Actions jobs, not to
    this local script, so this guard is what keeps releases on main.
  - Run from the repository root in an interactive PowerShell window.
#>
param(
  [string]$Repo,
  [string]$Environment = 'production',
  [string]$Domain,
  [switch]$AllowDirty,
  [switch]$AllowNonMain
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$Repo = Get-RepoSlug $Repo
Set-Location (git rev-parse --show-toplevel)

if (-not $Domain) {
  $m = [regex]::Match((Get-Content wrangler.jsonc -Raw), '"pattern"\s*:\s*"([^"]+)"\s*,\s*"custom_domain"\s*:\s*true')
  if ($m.Success) { $Domain = $m.Groups[1].Value } else { throw 'No custom_domain route in wrangler.jsonc; pass -Domain.' }
}
$dirty = git status --porcelain
if ($dirty -and -not $AllowDirty) { throw "Working tree has uncommitted changes:`n$dirty`nCommit first or pass -AllowDirty." }
git fetch --quiet origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not refresh origin/main. Nothing deployed.' }
$branch = (git branch --show-current)
if (-not $AllowNonMain -and ($branch -ne 'main' -or (git rev-parse HEAD) -ne (git rev-parse origin/main))) {
  throw "Refusing to deploy: HEAD must be the tip of origin/main (on '$branch'). Merge and pull main first, or pass -AllowNonMain for a deliberate off-main deploy."
}
if ($AllowNonMain) { Write-Warning "Deploying off main ($branch) because -AllowNonMain was passed." }
"Deploying commit $(git rev-parse --short HEAD) on $branch to $Domain"

$env:VITE_SUPABASE_URL = (gh variable get VITE_SUPABASE_URL --env $Environment --repo $Repo)
if ($LASTEXITCODE -ne 0 -or $env:VITE_SUPABASE_URL -notmatch '^https://[^/\s]+/?$') { throw 'The Supabase URL variable is missing or is not an https origin.' }
$env:VITE_SUPABASE_PUBLISHABLE_KEY = (gh variable get VITE_SUPABASE_PUBLISHABLE_KEY --env $Environment --repo $Repo)
if ($LASTEXITCODE -ne 0 -or $env:VITE_SUPABASE_PUBLISHABLE_KEY -notmatch '^sb_publishable_.+') { throw 'Publishable key variable is missing or not a publishable key.' }
$env:CLOUDFLARE_ACCOUNT_ID = (gh variable get CLOUDFLARE_ACCOUNT_ID --env $Environment --repo $Repo)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($env:CLOUDFLARE_ACCOUNT_ID)) { throw 'Could not read the Cloudflare account ID variable.' }

$env:CLOUDFLARE_API_TOKEN = Read-HiddenInput 'Cloudflare API token'
try {
  if (-not (Test-Path node_modules)) { npm ci --no-audit --no-fund; if ($LASTEXITCODE) { throw 'npm ci failed' } }
  npm run build; if ($LASTEXITCODE) { throw 'build failed' }
  npx --no-install wrangler deploy; if ($LASTEXITCODE) { throw 'wrangler deploy failed' }
} finally {
  Remove-Item Env:CLOUDFLARE_API_TOKEN, Env:VITE_SUPABASE_URL, Env:VITE_SUPABASE_PUBLISHABLE_KEY, Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
}

"--- verifying https://$Domain (certificate/DNS can take a few minutes)"
$ok = $false
foreach ($i in 1..12) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 "https://$Domain/api/v1/health"
    "health: HTTP $($r.StatusCode) $($r.Content)"; $ok = $true; break
  } catch { "attempt ${i}: $($_.Exception.Message)"; Start-Sleep -Seconds 15 }
}
if ($ok) { $s = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 "https://$Domain/auth/callback"; "SPA route /auth/callback: HTTP $($s.StatusCode)" }
else { Write-Warning 'Site not reachable yet. Check Workers & Pages > daydle-app > Settings > Domains & Routes.' }
