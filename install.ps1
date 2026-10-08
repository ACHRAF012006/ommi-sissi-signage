$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
function Test-Node {
  if (!(Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  & node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)'
  return $LASTEXITCODE -eq 0
}
if (!(Test-Node) -or !(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 24 LTS et npm sont requis."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    $answer = Read-Host "Installer Node.js LTS avec winget ? [o/N]"
    if ($answer -eq "o") {
      & winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
      if ($LASTEXITCODE -ne 0) { throw "Installation Node.js échouée." }
      $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    }
  }
  if (!(Test-Node)) { throw "Installez Node.js 24 LTS depuis https://nodejs.org, rouvrez PowerShell puis relancez .\install.ps1" }
}
if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw "npm est manquant. Réinstallez Node.js avec l’option npm." }
foreach ($directory in @("data","uploads/images","uploads/videos","uploads/thumbnails","uploads/tmp","logs","backups")) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
$env:SHARP_IGNORE_GLOBAL_LIBVIPS = "1"
& npm.cmd install
if ($LASTEXITCODE -ne 0) { throw "npm install a échoué. Vérifiez le réseau et la version de Node.js." }
& node scripts/setup-env.js
if ($LASTEXITCODE -ne 0) { throw "Configuration échouée." }
& npm.cmd run init-db
if ($LASTEXITCODE -ne 0) { throw "Initialisation SQLite échouée." }
$answer = Read-Host "Créer un administrateur maintenant ? [O/n]"
if ($answer -ne "n") { & npm.cmd run create-admin; if ($LASTEXITCODE -ne 0) { throw "Création administrateur échouée. Relancez npm run create-admin." } }
Write-Host "Installation terminée. Développement : npm run dev"
Write-Host "Démarrage : .\start.ps1 | Administration : http://localhost:3000/admin"
Write-Host "TV : http://IP-DU-SERVEUR:3000/display"
