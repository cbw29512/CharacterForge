$ErrorActionPreference = "Stop"

function Backup-File($Path) {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$Path.bak.$ts"
  Copy-Item -LiteralPath $Path -Destination $bak -Force
  return $bak
}

function Find-WizardTemplate($Root) {
  $templates = Join-Path $Root "templates"
  if (-not (Test-Path $templates)) { throw "Missing templates folder: $templates" }

  $preferred = Join-Path $templates "wizard.html"
  $candidates = @()
  if (Test-Path $preferred) { $candidates += $preferred }

  $candidates += Get-ChildItem -Path $templates -Recurse -File -Filter "*.html" |
    Select-Object -ExpandProperty FullName

  foreach ($f in ($candidates | Select-Object -Unique)) {
    $txt = Get-Content -LiteralPath $f -Raw
    if ($txt -match "wizard-section" -and $txt -match "goStep\s*\(") {
      return $f
    }
  }

  throw "Could not find a wizard template containing both 'wizard-section' and 'goStep('."
}

$root = (Get-Location).Path
$wizardPath = Find-WizardTemplate -Root $root

Write-Host ("Wizard template: " + $wizardPath) -ForegroundColor Cyan
$orig = Get-Content -LiteralPath $wizardPath -Raw

if ($orig -match "\blet\s+wizStep\s*=") {
  Write-Host "Wizard already looks patched (wizStep already exists). Nothing to do." -ForegroundColor Yellow
  exit 0
}

if (-not ($orig -match "\blet\s+currentStep\s*=")) {
  throw "Did not find 'let currentStep =' in the wizard template. Refusing to guess."
}

# Minimal fix: rename the wizard variable so it no longer collides with any global currentStep in app.js
$patched = $orig
$patched = $patched -replace "\blet\s+currentStep\s*=\s*0\s*;", "let wizStep = 0;"
$patched = $patched -replace "\bcurrentStep\b", "wizStep"

if ($patched -eq $orig) {
  throw "Patch produced no changes. Refusing to write."
}

$bak = Backup-File -Path $wizardPath
[System.IO.File]::WriteAllText($wizardPath, $patched, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("OK - Patched wizard and created backup: " + $bak) -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  1) Restart the app" -ForegroundColor Green
Write-Host "  2) Hard refresh browser (Ctrl+Shift+R)" -ForegroundColor Green