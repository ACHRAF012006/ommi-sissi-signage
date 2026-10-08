$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js introuvable. Lancez .\install.ps1" }
& node server.js
exit $LASTEXITCODE
