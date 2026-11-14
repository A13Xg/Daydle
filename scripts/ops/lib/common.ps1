# Shared helpers for scripts/ops/*.ps1. Dot-source this file; do not run it directly.
# Contains no credentials. Secrets are read from hidden prompts or Windows Credential Manager.

Set-StrictMode -Version Latest

if (-not ([System.Management.Automation.PSTypeName]'DaydleWinCred').Type) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class DaydleWinCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
    public int Persist; public int AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredRead(string target, int type, int flags, out IntPtr ptr);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredWrite(ref CREDENTIAL cred, int flags);
  [DllImport("advapi32.dll")]
  static extern void CredFree(IntPtr ptr);

  public static string Get(string target, bool utf16) {
    IntPtr ptr;
    if (!CredRead(target, 1, 0, out ptr)) return null;
    var c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
    var bytes = new byte[c.CredentialBlobSize];
    Marshal.Copy(c.CredentialBlob, bytes, 0, bytes.Length);
    CredFree(ptr);
    if (utf16) return Encoding.Unicode.GetString(bytes);
    var s = Encoding.UTF8.GetString(bytes);
    return s.Contains("\0") ? Encoding.Unicode.GetString(bytes) : s;
  }

  public static bool Set(string target, string user, string secret) {
    var bytes = Encoding.Unicode.GetBytes(secret);
    var c = new CREDENTIAL();
    c.Type = 1; c.TargetName = target; c.UserName = user;
    c.CredentialBlobSize = bytes.Length;
    c.CredentialBlob = Marshal.AllocHGlobal(bytes.Length);
    Marshal.Copy(bytes, 0, c.CredentialBlob, bytes.Length);
    c.Persist = 2; // local machine
    bool ok = CredWrite(ref c, 0);
    Marshal.FreeHGlobal(c.CredentialBlob);
    return ok;
  }
}
'@
}

function Read-HiddenInput {
  param([Parameter(Mandatory)][string]$Prompt)
  $secure = Read-Host -AsSecureString $Prompt
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if (-not $value) { throw "$Prompt was empty. Nothing was saved." }
  return $value
}

function Get-RepoSlug {
  param([string]$Repo)
  if ($Repo) { return $Repo }
  $slug = (gh repo view --json nameWithOwner --jq .nameWithOwner 2>$null)
  if (-not $slug) { throw 'Could not detect the GitHub repository. Pass -Repo owner/name.' }
  return $slug.Trim()
}

function Resolve-ProjectRef {
  param([string]$ProjectRef)
  if (-not $ProjectRef) { $ProjectRef = $env:SUPABASE_PROJECT_ID }
  if ($ProjectRef -notmatch '^[a-z]{20}$') { throw 'Supply -ProjectRef (or set SUPABASE_PROJECT_ID): a 20-letter Supabase project reference.' }
  return $ProjectRef
}

# Supabase Management API using the access token that `supabase login` stored in Credential Manager.
function Get-SupabaseCliToken {
  $token = [DaydleWinCred]::Get('Supabase CLI:supabase', $false)
  if (-not $token) { throw 'No Supabase CLI login found. Run: supabase login' }
  return $token.Trim()
}

function Invoke-SupabaseApi {
  param(
    [Parameter(Mandatory)][string]$Path,
    [ValidateSet('Get', 'Post', 'Patch', 'Put', 'Delete')][string]$Method = 'Get',
    $Body
  )
  $args_ = @{
    Method  = $Method
    Uri     = "https://api.supabase.com$Path"
    Headers = @{ Authorization = "Bearer $(Get-SupabaseCliToken)" }
  }
  if ($null -ne $Body) {
    $args_.ContentType = 'application/json'
    $args_.Body = ($Body | ConvertTo-Json -Depth 6)
  }
  Invoke-RestMethod @args_
}

function Get-DbPassword {
  param([string]$CredentialName = 'Daydle-Preview-Supabase-DB')
  $pw = [DaydleWinCred]::Get($CredentialName, $true)
  if (-not $pw) { throw "Credential '$CredentialName' not found in Windows Credential Manager." }
  return $pw
}
