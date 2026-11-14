<#
.SYNOPSIS
  Enable Cloudflare Turnstile CAPTCHA in Supabase Auth and open email/password signup behind it.
.DESCRIPTION
  Basic bot protection for signup without email confirmation. Because the Supabase publishable key is
  public, a bot can call the Auth API directly, so the check must be enforced by Supabase, not just the
  web form. Supabase then requires a valid Turnstile token for email sign-up, sign-in and password
  recovery. OAuth (Google/Apple) is unaffected.

  Create the widget first (Cloudflare dashboard > Turnstile > Add widget): hostname = your app domain,
  mode = Managed. You get a public Site Key and a private Secret Key.

  What this script does:
    1. Prompts for the Site Key (visible) and Secret Key (hidden).
    2. Verifies the Secret Key with Cloudflare's siteverify endpoint (no side effects).
    3. Stores the Site Key as the public GitHub environment variable VITE_TURNSTILE_SITE_KEY.
    4. In ONE Supabase Auth patch: enables Turnstile with the secret, enables email signup, turns on
       auto-confirm (no confirmation email) and sets a minimum password length of 8. Doing it in one
       request means email signup is never open without the CAPTCHA.
  The Secret Key is stored only in Supabase and never printed or written to disk.
  Redeploy afterwards (deploy-worker.ps1) so the site includes the widget.
#>
param(
  [string]$ProjectRef,
  [string]$Repo,
  [string]$Environment = 'production',
  [int]$MinPasswordLength = 8
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$ProjectRef = Resolve-ProjectRef $ProjectRef
$Repo = Get-RepoSlug $Repo

$siteKey = (Read-Host 'Turnstile Site Key').Trim()
if ($siteKey -notmatch '^[0-9]x[A-Za-z0-9_-]{16,}$') { throw 'That does not look like a Turnstile Site Key. Nothing changed.' }
$secret = Read-HiddenInput 'Turnstile Secret Key'

# Cloudflare answers invalid-input-secret for a wrong secret and invalid-input-response for a
# right secret with a fake token, so this validates the secret without consuming anything.
$check = Invoke-RestMethod -Method Post -Uri 'https://challenges.cloudflare.com/turnstile/v0/siteverify' -Body @{ secret = $secret; response = 'configuration-check' }
if ($check.'error-codes' -contains 'invalid-input-secret') { throw 'Cloudflare rejected the Secret Key. Nothing changed.' }
'Secret Key accepted by Cloudflare.'

gh variable set VITE_TURNSTILE_SITE_KEY --env $Environment --repo $Repo --body $siteKey
"Site Key saved as variable VITE_TURNSTILE_SITE_KEY on '$Environment'."

Invoke-SupabaseApi -Method Patch -Path "/v1/projects/$ProjectRef/config/auth" -Body @{
  security_captcha_enabled  = $true
  security_captcha_provider = 'turnstile'
  security_captcha_secret   = $secret
  external_email_enabled    = $true
  mailer_autoconfirm        = $true
  password_min_length       = $MinPasswordLength
} | Out-Null
$secret = $null

$c = Invoke-SupabaseApi -Path "/v1/projects/$ProjectRef/config/auth"
"captcha enabled  : $($c.security_captcha_enabled) ($($c.security_captcha_provider))"
"captcha secret   : $([bool]$c.security_captcha_secret)"
"email signup     : $($c.external_email_enabled)"
"auto-confirm     : $($c.mailer_autoconfirm)"
"min password len : $($c.password_min_length)"
'Next: redeploy with scripts/ops/deploy-worker.ps1 so the site includes the CAPTCHA widget.'
