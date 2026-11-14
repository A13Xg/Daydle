<#
.SYNOPSIS
  List, and optionally permanently delete, user accounts from the hosted Supabase project so sign-up
  can be tested repeatedly.
.DESCRIPTION
  DESTRUCTIVE and irreversible when run with -Execute, against the live database. Intended for test
  accounts only. There is no undo and the free tier has no backups.

  Deleting a row from auth.users cascades to the user's identities, sessions, profile, friend code and
  every other table that references them (admin_events keeps its rows with the user set to null).

  Safe by default: without -Execute the script only lists the matching users (emails are masked).
  With -Execute it:
    - refuses to delete zero users, or more than -MaxUsers (default 25);
    - deletes exactly the users it listed, by id, in one statement;
    - requires you to type the project reference to confirm.

  Selectors (combined with OR). Give none to just list every user:
    -All                     every user
    -Provider apple,google   users that have any of these sign-in providers
    -Id 4c61e281             user id, full UUID or a prefix of at least 8 characters
    -Email a@b.com           exact email address (case-insensitive)
.EXAMPLE
  ./scripts/ops/purge-test-users.ps1                      # list everyone
  ./scripts/ops/purge-test-users.ps1 -Provider apple      # preview deleting Apple users
  ./scripts/ops/purge-test-users.ps1 -All -Execute        # delete everyone, after confirmation
.NOTES
  Deleting the account does not revoke it at the provider. For a true "first time" test, also revoke
  the app: Apple (iPhone Settings > Apple ID > Sign-In & Security > Sign in with Apple > Daydle > Stop
  Using Apple ID, which makes Apple send the name again) and Google (myaccount.google.com/permissions).
  Sign out on the test device first; a stale session there will simply fail and be cleared.
  You can also delete a single user in the Supabase dashboard: Authentication > Users.
#>
param(
  [string]$ProjectRef,
  [switch]$All,
  [string[]]$Provider,
  [string[]]$Id,
  [string[]]$Email,
  [int]$MaxUsers = 25,
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/lib/common.ps1"
$ProjectRef = Resolve-ProjectRef $ProjectRef

function Invoke-Sql([string]$Sql) {
  @(Invoke-SupabaseApi -Method Post -Path "/v1/projects/$ProjectRef/database/query" -Body @{ query = $Sql })
}
# Selector values are validated strictly and quoted, because the API takes raw SQL.
function Quote([string]$Value) { "'" + $Value.Replace("'", "''") + "'" }

foreach ($p in $Provider) { if ($p -notmatch '^[a-z_]{2,30}$') { throw "Invalid provider '$p'." } }
foreach ($i in $Id) { if ($i -notmatch '^[0-9a-fA-F-]{8,36}$') { throw "Invalid id '$i' (use a UUID or an 8+ character prefix)." } }
foreach ($e in $Email) { if ($e -notmatch '^[^\s@''"]+@[^\s@''"]+\.[^\s@''"]+$') { throw "Invalid email '$e'." } }

$conditions = @()
if ($All) { $conditions += 'true' }
foreach ($p in $Provider) { $conditions += "exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = $(Quote $p))" }
foreach ($i in $Id) { $conditions += "u.id::text like $(Quote ($i.ToLower() + '%'))" }
foreach ($e in $Email) { $conditions += "lower(u.email) = $(Quote $e.ToLower())" }
$selecting = $conditions.Count -gt 0
$where = if ($selecting) { '(' + ($conditions -join ' or ') + ')' } else { 'true' }

$users = Invoke-Sql @"
select u.id::text as id,
       coalesce((select string_agg(i.provider, '+' order by i.provider) from auth.identities i where i.user_id = u.id), '-') as providers,
       coalesce(left(u.email, 1) || '***@' || split_part(u.email, '@', 2), '(none)') as email,
       coalesce(p.display_name, '(no profile)') as name,
       to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as created
from auth.users u
left join public.profiles p on p.id = u.id
where $where
order by u.created_at
"@

"Project $ProjectRef : $($users.Count) matching user(s)"
$users | Format-Table @{n='id';e={$_.id.Substring(0, 8)}}, providers, email, name, created -AutoSize | Out-String | Write-Host

if (-not $selecting) { 'No selector given: listing only. Add -All, -Provider, -Id or -Email to choose users.'; return }
if (-not $Execute) { 'Dry run: nothing was deleted. Add -Execute to delete the users listed above.'; return }

if ($users.Count -eq 0) { throw 'No matching users; nothing to delete.' }
if ($users.Count -gt $MaxUsers) { throw "Refusing to delete $($users.Count) users (limit $MaxUsers). Narrow the selection or raise -MaxUsers deliberately." }

Write-Warning "This PERMANENTLY deletes $($users.Count) user(s) and all their data from the LIVE database. It cannot be undone."
$typed = (Read-Host "Type the project reference ($ProjectRef) to confirm").Trim()
if ($typed -ne $ProjectRef) { throw 'Confirmation did not match. Nothing was deleted.' }

$ids = ($users | ForEach-Object { Quote $_.id }) -join ','
$deleted = Invoke-Sql "delete from auth.users where id::text in ($ids) returning id"
"Deleted $($deleted.Count) user(s)."

$left = Invoke-Sql "select (select count(*) from auth.users) users, (select count(*) from public.profiles) profiles, (select count(*) from public.friend_codes) friend_codes, (select count(*) from auth.identities) identities, (select count(*) from auth.sessions) sessions"
"Remaining: users=$($left[0].users) profiles=$($left[0].profiles) friend_codes=$($left[0].friend_codes) identities=$($left[0].identities) sessions=$($left[0].sessions)"
if ($left[0].profiles -gt $left[0].users -or $left[0].friend_codes -gt $left[0].users) { Write-Warning 'More profiles or friend codes than users remain; investigate.' }
