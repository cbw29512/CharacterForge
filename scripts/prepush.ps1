$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

Write-Host "== CharacterForge pre-push smoke test ==" -ForegroundColor Cyan

# --- Repo root ---
$root = (git rev-parse --show-toplevel 2>$null)
if (-not $root) { throw "Not inside a git repo." }
Set-Location $root

# --- Load .env (if present) ---
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) { return }
    $k = $parts[0].Trim()
    $v = $parts[1].Trim().Trim('"').Trim("'")
    if ($k) { Set-Item -Path "Env:$k" -Value $v }
  }
}

$ollamaUrl   = $env:OLLAMA_URL
$ollamaModel = $env:OLLAMA_MODEL
if (-not $ollamaUrl)   { $ollamaUrl = "http://127.0.0.1:11434" }
if (-not $ollamaModel) { $ollamaModel = "mistral" }

Write-Host ("Repo:       {0}" -f $root) -ForegroundColor Gray
Write-Host ("Branch:     {0}" -f (git rev-parse --abbrev-ref HEAD)) -ForegroundColor Gray
Write-Host ("OLLAMA_URL: {0}" -f $ollamaUrl) -ForegroundColor Gray
Write-Host ("MODEL:      {0}" -f $ollamaModel) -ForegroundColor Gray

# --- Git cleanliness check ---
Write-Host "`n== Git status ==" -ForegroundColor Cyan
$porc = git status --porcelain
if ($porc) {
  Write-Host "Working tree has changes (OK if expected):" -ForegroundColor Yellow
  $porc | ForEach-Object { Write-Host $_ }
} else {
  Write-Host "Working tree clean [OK]" -ForegroundColor Green
}

# --- Activate venv if present ---
Write-Host "`n== Python environment ==" -ForegroundColor Cyan
$activate = $null
if (Test-Path (Join-Path $root ".venv\Scripts\Activate.ps1")) { $activate = Join-Path $root ".venv\Scripts\Activate.ps1" }
elseif (Test-Path (Join-Path $root "venv\Scripts\Activate.ps1")) { $activate = Join-Path $root "venv\Scripts\Activate.ps1" }

if ($activate) {
  Write-Host ("Activating venv: {0}" -f $activate) -ForegroundColor Gray
  . $activate
} else {
  Write-Host "No venv found (.venv/venv). Using system Python." -ForegroundColor Yellow
}

python --version

# --- Compile check (fast syntax gate) ---
Write-Host "`n== Python compileall ==" -ForegroundColor Cyan
python -m compileall . | Out-Null
Write-Host "compileall OK [OK]" -ForegroundColor Green

# --- Ollama tags check ---
Write-Host "`n== Ollama /api/tags ==" -ForegroundColor Cyan
try {
  $tags = Invoke-RestMethod -Uri ($ollamaUrl.TrimEnd("/") + "/api/tags") -TimeoutSec 5
  $names = @()
  if ($tags.models) { $names = $tags.models | Select-Object -ExpandProperty name }
  Write-Host ("Ollama reachable [OK]  Models: {0}" -f (($names -join ", "))) -ForegroundColor Green
} catch {
  Write-Host "Ollama NOT reachable [FAIL]" -ForegroundColor Red
  throw
}

# --- Ollama chat check (smoke test) ---
Write-Host "`n== Ollama /api/chat ==" -ForegroundColor Cyan
$payload = @{
  model    = $ollamaModel
  stream   = $false
  messages = @(@{ role="user"; content="Reply with the single word PONG (no punctuation, no extra text)." })
  options  = @{ temperature = 0 }
} | ConvertTo-Json -Depth 8

try {
  $resp = Invoke-RestMethod -Method Post -Uri ($ollamaUrl.TrimEnd("/") + "/api/chat") -ContentType "application/json" -Body $payload -TimeoutSec 60
  $text = ($resp.message.content | Out-String).Trim()

  if ($text -match '^(?i)PONG\b') {
    if ($text -notmatch '^(?i)PONG\s*$') {
      Write-Host ("Chat OK [WARN]  Response started with PONG but had extra text: {0}" -f $text) -ForegroundColor Yellow
    } else {
      Write-Host ("Chat OK [OK]  Response: {0}" -f $text) -ForegroundColor Green
    }
  } else {
    throw ("Chat response did not start with PONG. Got: {0}" -f $text)
  }
} catch {
  Write-Host "Chat FAILED [FAIL]" -ForegroundColor Red
  throw
}

Write-Host "`nALL CHECKS PASSED [OK]" -ForegroundColor Green