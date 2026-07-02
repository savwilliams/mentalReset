#Requires -Version 5.1
<#
.SYNOPSIS
  Copy the next MentalReset agent prompt from docs/AGENT-PROMPTS.md to the clipboard.

.DESCRIPTION
  Tracks progress in .cursor/prompt-progress.json.

  Default: copy the prompt for the current index (re-copy without advancing).
  -Advance: move to the next phase and copy that prompt (used by the stop hook).
  -Undo: step back one phase and copy.
  -Reset: return to phase 1 and copy.
  -Status: show current position only.
  -Set <index>: jump to a zero-based index and copy.

.EXAMPLE
  .\scripts\next-prompt.ps1
  Copy the prompt for the current phase.

.EXAMPLE
  .\scripts\next-prompt.ps1 -Advance
  After finishing a phase, copy the next prompt.
#>
[CmdletBinding()]
param(
    [switch]$Advance,
    [switch]$Undo,
    [switch]$Reset,
    [switch]$Status,
    [int]$Set = -1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$PromptsFile = Join-Path $RepoRoot 'docs\AGENT-PROMPTS.md'
$ProgressFile = Join-Path $RepoRoot '.cursor\prompt-progress.json'

function Get-PhasePrompts {
    if (-not (Test-Path $PromptsFile)) {
        throw "Prompt file not found: $PromptsFile"
    }

    $content = Get-Content -Path $PromptsFile -Raw -Encoding UTF8
    $pattern = '(?ms)^### Phase \d+\s+(.+?)\r?\n\r?\n```\r?\n(.*?)\r?\n```'
    $matches = [regex]::Matches($content, $pattern)

    if ($matches.Count -eq 0) {
        throw "No phase prompts found in $PromptsFile"
    }

    $phases = foreach ($match in $matches) {
        $title = $match.Groups[1].Value.Trim()
        if ($title -match '^[^\w]+(.+)$') {
            $title = $matches[1].Trim()
        }
        [pscustomobject]@{
            Title = $title
            Prompt = $match.Groups[2].Value.TrimEnd()
        }
    }

    return ,$phases
}

function Get-Progress {
    if (-not (Test-Path $ProgressFile)) {
        return [pscustomobject]@{
            index = 0
            updatedAt = $null
        }
    }

    $raw = Get-Content -Path $ProgressFile -Raw -Encoding UTF8 | ConvertFrom-Json
    return [pscustomobject]@{
        index = [int]$raw.index
        updatedAt = $raw.updatedAt
    }
}

function Save-Progress {
    param([int]$Index)

    $dir = Split-Path $ProgressFile -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $payload = [ordered]@{
        index = $Index
        updatedAt = (Get-Date).ToString('o')
    }

    ($payload | ConvertTo-Json) | Set-Content -Path $ProgressFile -Encoding UTF8
}

function Show-Status {
    param(
        [array]$Phases,
        [int]$Index
    )

    $total = $Phases.Count
    if ($Index -ge $total) {
        Write-Host "All $total phases complete. Use -Reset to start over."
        return
    }

    $phaseNumber = $Index + 1
    Write-Host "Phase $phaseNumber of $total`: $($Phases[$Index].Title)"
}

$phases = Get-PhasePrompts
$progress = Get-Progress
$index = $progress.index
$total = $phases.Count

if ($Reset) {
    $index = 0
}
elseif ($Set -ge 0) {
    if ($Set -ge $total) {
        throw "Index must be between 0 and $($total - 1)."
    }
    $index = $Set
}
elseif ($Undo) {
    if ($index -gt 0) {
        $index--
    }
}
elseif ($Advance) {
    if ($index -lt $total) {
        $index++
    }
}

if ($Status) {
    Show-Status -Phases $phases -Index $index
    exit 0
}

if ($index -ge $total) {
    Write-Host "All $total phases complete. Nothing left to copy. Use -Reset to start over."
    exit 0
}

$prompt = $phases[$index].Prompt
Set-Clipboard -Value $prompt
Save-Progress -Index $index

$phaseNumber = $index + 1
Write-Host "Copied phase $phaseNumber of $total`: $($phases[$index].Title)"
Write-Host 'Open a new Agent chat and press Ctrl+V to paste.'

if ($Advance -and ($index + 1) -lt $total) {
    Write-Host "After this agent finishes, the stop hook will copy phase $($index + 2) automatically."
}
elseif ($Advance -and $index -ge ($total - 1)) {
    Write-Host 'This was the final phase. The stop hook will not copy another prompt.'
}

exit 0
