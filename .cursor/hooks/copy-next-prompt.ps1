# Cursor stop hook: advance to the next agent prompt and copy it to the clipboard.
# Consumes stdin JSON from Cursor; no model credits used.

$ErrorActionPreference = 'Stop'

# Required for hook protocol — read and discard hook input.
if ([Console]::In.Peek() -ge 0) {
    $null = [Console]::In.ReadToEnd()
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$ScriptPath = Join-Path $RepoRoot 'scripts\next-prompt.ps1'

if (-not (Test-Path $ScriptPath)) {
    Write-Error "next-prompt.ps1 not found at $ScriptPath"
    exit 1
}

& $ScriptPath -Advance
exit $LASTEXITCODE
