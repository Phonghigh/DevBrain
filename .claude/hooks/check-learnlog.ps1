# check-learnlog.ps1 — Stop hook (strict learn-log enforcer)
#
# This is a LEARNING project: every session that changes product code
# (apps/** or packages/**) must ship a beginner "teach it back" report under
# docs/learn-log/ (see CLAUDE.md -> the Learn-Log Rule, and tasks/ROUTINE.md step 6).
#
# This hook blocks Claude from finishing while product code has changed but no
# learn-log report was written. It self-terminates: once the report file exists,
# the condition flips and finishing is allowed.
#
# Design notes:
# - Fails OPEN (exit 0) on any error or if not a git repo — a broken enforcer must
#   never hard-lock the user out of ending a session.
# - Respects stop_hook_active: if we already blocked once this turn, allow, so we
#   can never spin in an infinite loop.
# - Scoped to apps/** and packages/** on purpose, so docs-only, config, and plain
#   Q&A sessions are never nagged.

try {
    $raw = [Console]::In.ReadToEnd()
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $data = $raw | ConvertFrom-Json
        # Loop-safety valve: only ever block once per turn.
        if ($data.stop_hook_active -eq $true) { exit 0 }
    }

    $root = $env:CLAUDE_PROJECT_DIR
    if ([string]::IsNullOrWhiteSpace($root) -and $data) { $root = [string]$data.cwd }
    if ([string]::IsNullOrWhiteSpace($root)) { $root = (Get-Location).Path }

    # Get the working-tree changes (staged, unstaged, and new untracked files).
    $status = & git -C $root status --porcelain --untracked-files=all 2>$null
    if ($LASTEXITCODE -ne 0) { exit 0 }   # not a git repo / git unavailable -> allow
    if (-not $status) { exit 0 }           # clean tree -> nothing to enforce

    $workChanged   = $false
    $reportWritten = $false

    foreach ($line in $status) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        # Porcelain v1: "XY <path>"; renames are "XY old -> new".
        $path = $line.Substring(3).Trim()
        if ($path -match ' -> ') { $path = ($path -split ' -> ')[-1] }
        $path = $path.Trim('"')                 # unquote paths with special chars
        $path = $path -replace '\\', '/'          # normalise separators

        if ($path -match '^(apps|packages)/') { $workChanged = $true }

        if ($path -match '^docs/learn-log/' `
            -and $path -notmatch '^docs/learn-log/\.trace/' `
            -and $path -notmatch '^docs/learn-log/README\.md$' `
            -and $path -notmatch '^docs/learn-log/_TEMPLATE\.md$') {
            $reportWritten = $true
        }
    }

    if ($workChanged -and -not $reportWritten) {
        $msg = @'
LEARN-LOG REQUIRED — this is a learning project.

You changed product code (apps/** or packages/**) but have not written a
beginner learn-log report. Before finishing you MUST:

  1. Copy docs/learn-log/_TEMPLATE.md to docs/learn-log/<task-id>-<slug>.md and
     fill it in for a COMPLETE BEGINNER in simple English (problem, concepts with
     analogies, approach + alternatives, research trail, where you got stuck,
     step-by-step solution, how to verify). Follow the template's golden rules.
  2. Use the auto-captured trail in docs/learn-log/.trace/<today>.md for the
     "Research trail" and "Where I got stuck" sections.
  3. Add a row to the index in docs/learn-log/README.md.
  4. Commit the report together with the code.

See CLAUDE.md (the Learn-Log Rule) and tasks/ROUTINE.md step 6.
'@
        [Console]::Error.WriteLine($msg)
        exit 2   # exit 2 on Stop blocks finishing and feeds stderr back to Claude
    }

    exit 0
}
catch {
    # Fail open: never hard-lock the session on an enforcer bug.
    exit 0
}
