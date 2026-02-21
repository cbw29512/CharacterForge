$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
py -m venv .venv
Write-Host 'Venv created: .\.venv' -ForegroundColor Green