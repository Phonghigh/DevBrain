# trace-tool.ps1 — PostToolUse hook (research-trail logger)
#
# Appends one compact, timestamped line per web search / fetched page / shell
# command Claude runs to  docs/learn-log/.trace/<yyyy-MM-dd>.md .  That raw trail
# is the source material for the "Research trail" and "Where I got stuck" sections
# of each learn-log report (see docs/learn-log/README.md).
#
# Contract: reads the hook JSON from stdin, writes to a file, NEVER blocks.
# Any failure is swallowed so it can never interrupt a build. Always exits 0.

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

    $data = $raw | ConvertFrom-Json

    $tool = [string]$data.tool_name
    if ([string]::IsNullOrWhiteSpace($tool)) { exit 0 }

    # Only trace research-relevant tools.
    switch -Regex ($tool) {
        '^WebSearch$'  { $detail = [string]$data.tool_input.query }
        '^WebFetch$'   { $detail = [string]$data.tool_input.url }
        '^(Bash|PowerShell)$' { $detail = [string]$data.tool_input.command }
        default        { exit 0 }
    }
    if ($null -eq $detail) { $detail = '' }

    # Collapse whitespace/newlines and truncate so the trail stays one line each.
    $detail = ($detail -replace '\s+', ' ').Trim()
    if ($detail.Length -gt 300) { $detail = $detail.Substring(0, 297) + '...' }

    # Locate the project root (Claude Code sets CLAUDE_PROJECT_DIR for hooks).
    $root = $env:CLAUDE_PROJECT_DIR
    if ([string]::IsNullOrWhiteSpace($root)) { $root = [string]$data.cwd }
    if ([string]::IsNullOrWhiteSpace($root)) { $root = (Get-Location).Path }

    $traceDir = Join-Path $root 'docs/learn-log/.trace'
    if (-not (Test-Path $traceDir)) {
        New-Item -ItemType Directory -Path $traceDir -Force | Out-Null
    }

    $today = Get-Date -Format 'yyyy-MM-dd'
    $file  = Join-Path $traceDir "$today.md"
    if (-not (Test-Path $file)) {
        Set-Content -Path $file -Encoding utf8 -Value @"
# Research trail — $today

Auto-captured by .claude/hooks/trace-tool.ps1. Raw and noisy on purpose — the
learn-log report curates this into a readable story. Git-ignored.

"@
    }

    $stamp = Get-Date -Format 'HH:mm:ss'
    $line  = "- {0}  ``[{1}]``  {2}" -f $stamp, $tool, $detail
    Add-Content -Path $file -Encoding utf8 -Value $line
}
catch {
    # Never let a logging problem block Claude.
}

exit 0
