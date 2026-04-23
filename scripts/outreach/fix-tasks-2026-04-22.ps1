#Requires -RunAsAdministrator
# One-shot fix for the 3 DistractionIndex tasks that were created with
# stored-password credentials (Access is denied when a non-admin modifies them).
# Deletes them, recreates with /IT (InteractiveToken = no stored password),
# then relaxes battery policy + enables StartWhenAvailable.

$PROJECT_DIR = "C:\Users\sghar\CascadeProjects\distraction"

$tasks = @(
  @{
    Name = "DistractionIndex-BlueskyEngage"
    Script = "scripts/outreach/bluesky-engage.ts"
    Log = "scripts\outreach\engage.log"
    Schedule = "DAILY"
    Time = "10:00"
    ExtraArgs = @()
  },
  @{
    Name = "DistractionIndex-EmailFollowups"
    Script = "scripts/outreach/email-campaign.ts"
    Log = "scripts\outreach\email-followup.log"
    Schedule = "WEEKLY"
    Time = "09:00"
    ExtraArgs = @("/D", "MON")
    ScriptArgs = "--followup"
  },
  @{
    Name = "DistractionIndex-WeeklyCascade"
    Script = "scripts/outreach/substack-publish.ts"
    Log = "scripts\outreach\cascade.log"
    Schedule = "WEEKLY"
    Time = "02:00"
    ExtraArgs = @("/D", "SUN")
  }
)

foreach ($t in $tasks) {
  Write-Host "--- $($t.Name) ---" -ForegroundColor Cyan

  # Delete (force, ignore error if missing)
  schtasks /delete /tn $t.Name /f 2>$null

  # Build the command string
  $scriptArgs = if ($t.ContainsKey("ScriptArgs")) { " " + $t.ScriptArgs } else { "" }
  $trCommand = "cmd /c cd /d $PROJECT_DIR && node_modules\.bin\tsx $($t.Script)$scriptArgs >> $($t.Log) 2>&1"

  # Create with /IT = InteractiveToken (no password required to modify later)
  $createArgs = @("/create", "/tn", $t.Name, "/tr", $trCommand, "/sc", $t.Schedule, "/st", $t.Time, "/it", "/f") + $t.ExtraArgs
  & schtasks $createArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAIL create" -ForegroundColor Red
    continue
  }

  # Relax battery policy + enable StartWhenAvailable
  try {
    $task = Get-ScheduledTask -TaskName $t.Name
    $s = $task.Settings
    $s.DisallowStartIfOnBatteries = $false
    $s.StopIfGoingOnBatteries = $false
    $s.StartWhenAvailable = $true
    Set-ScheduledTask -TaskName $t.Name -Settings $s | Out-Null
    Write-Host "  OK" -ForegroundColor Green
  } catch {
    Write-Host "  FAIL settings: $_" -ForegroundColor Red
  }
}

# Verify
Write-Host "`n=== Verification ===" -ForegroundColor Yellow
foreach ($t in $tasks) {
  $task = Get-ScheduledTask -TaskName $t.Name
  $s = $task.Settings
  $action = $task.Actions[0]
  $npx = if ($action.Arguments -match "npx tsx") { "npx-STILL" } else { "local-tsx" }
  Write-Host ("{0,-35} batt={1,-5} stopBatt={2,-5} startWA={3,-5} cmd={4}" -f $t.Name, $s.DisallowStartIfOnBatteries, $s.StopIfGoingOnBatteries, $s.StartWhenAvailable, $npx)
}
