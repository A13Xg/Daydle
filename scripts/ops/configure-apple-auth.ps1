<#
.SYNOPSIS
  Generate Apple's OAuth client secret from your .p8 key and store it in Supabase Auth.
.DESCRIPTION
  Apple's "client secret" is an ES256-signed JWT that expires after at most ~6 months. This script
  builds it locally with Node's built-in crypto (the .p8 never leaves this machine), then patches ONLY
  the three Apple fields in the project's auth config. RE-RUN BEFORE THE PRINTED EXPIRY DATE or Apple
  sign-in will stop working (email and Google keep working).
  Apple portal values required: Team ID, Key ID, Services ID (the web client ID) and the .p8 file.
  Services ID must list the return URL: https://<project-ref>.supabase.co/auth/v1/callback
  Keep the .p8 in a password manager or encrypted storage, not in the repo or Downloads.
#>
param(
  [string]$ProjectRef,
  [string]$TeamId,
  [string]$KeyId,
  [string]$ServicesId,
  [string]$KeyPath
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$ProjectRef = Resolve-ProjectRef $ProjectRef

if (-not $TeamId)     { $TeamId     = (Read-Host 'Apple Team ID (10 characters)').Trim() }
if (-not $KeyId)      { $KeyId      = (Read-Host 'Key ID of the Sign in with Apple key (10 characters)').Trim() }
if (-not $ServicesId) { $ServicesId = (Read-Host 'Services ID identifier (e.g. com.example.app.web)').Trim() }
if (-not $KeyPath)    { $KeyPath    = (Read-Host 'Full path to the AuthKey_XXXX.p8 file').Trim('" ') }
if ($TeamId -notmatch '^[A-Z0-9]{10}$') { throw 'Team ID should be 10 uppercase letters/digits. Nothing saved.' }
if ($KeyId  -notmatch '^[A-Z0-9]{10}$') { throw 'Key ID should be 10 uppercase letters/digits. Nothing saved.' }
if (-not $ServicesId) { throw 'Services ID is empty. Nothing saved.' }
if (-not (Test-Path $KeyPath)) { throw 'The .p8 file was not found. Nothing saved.' }

$env:DAYDLE_APPLE_TEAM = $TeamId; $env:DAYDLE_APPLE_KID = $KeyId
$env:DAYDLE_APPLE_SVC = $ServicesId; $env:DAYDLE_APPLE_P8 = $KeyPath
$js = @'
const c = require("crypto"), fs = require("fs");
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const exp = now + 15777000; // ~6 months, Apple's maximum
const head = { alg: "ES256", kid: process.env.DAYDLE_APPLE_KID, typ: "JWT" };
const body = { iss: process.env.DAYDLE_APPLE_TEAM, iat: now, exp, aud: "https://appleid.apple.com", sub: process.env.DAYDLE_APPLE_SVC };
const input = b64(head) + "." + b64(body);
const key = c.createPrivateKey(fs.readFileSync(process.env.DAYDLE_APPLE_P8));
const sig = c.sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
process.stdout.write(JSON.stringify({ jwt: input + "." + sig, exp }));
'@
try { $out = $js | node - | ConvertFrom-Json }
finally { Remove-Item Env:DAYDLE_APPLE_TEAM, Env:DAYDLE_APPLE_KID, Env:DAYDLE_APPLE_SVC, Env:DAYDLE_APPLE_P8 -ErrorAction SilentlyContinue }
$expires = [DateTimeOffset]::FromUnixTimeSeconds($out.exp).ToString('yyyy-MM-dd')

Invoke-SupabaseApi -Method Patch -Path "/v1/projects/$ProjectRef/config/auth" -Body @{
  external_apple_enabled   = $true
  external_apple_client_id = $ServicesId
  external_apple_secret    = $out.jwt
} | Out-Null
$out = $null

$c = Invoke-SupabaseApi -Path "/v1/projects/$ProjectRef/config/auth"
"apple enabled   : $($c.external_apple_enabled)"
"services id set : $($c.external_apple_client_id -eq $ServicesId)"
"secret present  : $([bool]$c.external_apple_secret)"
"secret EXPIRES  : $expires  <-- re-run this script before then"
