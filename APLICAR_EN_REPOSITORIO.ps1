param([Parameter(Mandatory=$true)][string]$RepoPath)
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $MyInvocation.MyCommand.Path
$repo=(Resolve-Path $RepoPath).Path
if (!(Test-Path (Join-Path $repo '.git'))) { throw 'La ruta no es un repositorio Git. Abre GitHub Desktop y clona primero el repositorio.' }
$manifest=Get-Content (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
Write-Host "Verificando $($manifest.Count) archivos sin realizar cambios..."
foreach ($item in $manifest) {
 $rel=$item.path -replace '/','\'
 $candidate=Join-Path $source $rel; $dest=Join-Path $repo $rel
 if (!(Test-Path $candidate)) { throw "Parche incompleto: $($item.path)" }
 $newHash=(Get-FileHash $candidate -Algorithm SHA256).Hash.ToLowerInvariant()
 if ($newHash -ne $item.target_sha256) { throw "El archivo del parche fue modificado: $($item.path)" }
 if (Test-Path $dest) {
  $cur=(Get-FileHash $dest -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($cur -eq $item.target_sha256) { continue }
  if ($item.accepted_existing_sha256 -notcontains $cur) { throw "ABORTADO: $($item.path) difiere de ZIP(21) y del parche anterior. No reemplazado." }
 } elseif ($item.accepted_existing_sha256.Count -gt 0) {throw "ABORTADO: falta un archivo existente: $($item.path)"}
}
$backup=Join-Path $env:TEMP ('milhano-ticketing-backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
foreach ($item in $manifest) {
 $rel=$item.path -replace '/','\'
 $candidate=Join-Path $source $rel; $dest=Join-Path $repo $rel
 if (Test-Path $dest) {
  $cur=(Get-FileHash $dest -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($cur -eq $item.target_sha256) {continue}
  $destBackup=Join-Path $backup $rel
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destBackup) | Out-Null
  Copy-Item $dest $destBackup
 }
 New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
 Copy-Item $candidate $dest -Force
}
Write-Host 'Parche copiado respetando carpetas. Revise los cambios antes de Commit/Push.' -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host 'Luego: node --test scripts/ticketing-regression.test.mjs scripts/ticketing-mask-regression.test.mjs'
Write-Host 'Luego: npm run build'
