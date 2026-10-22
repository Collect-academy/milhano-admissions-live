param([Parameter(Mandatory=$true)][string]$RepoPath)
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $MyInvocation.MyCommand.Path
$repo=(Resolve-Path $RepoPath).Path
$manifest=Get-Content (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
if (!(Test-Path (Join-Path $repo '.git'))) { throw 'No es un repositorio Git local. Use GitHub Desktop para clonarlo.' }
Write-Host "Verificando $($manifest.Count) archivos contra el ZIP (21)..."
foreach ($item in $manifest) {
  $dest=Join-Path $repo ($item.path -replace '/','\')
  $candidate=Join-Path $source ($item.path -replace '/','\')
  if (!(Test-Path $candidate)) {throw "Paquete incompleto: $($item.path)"}
  $candidateHash=(Get-FileHash -Path $candidate -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($candidateHash -ne $item.new_sha256) {throw "Archivo del parche alterado: $($item.path)"}
  if ($item.change -eq 'new') {
    if (Test-Path $dest) {
      $cur=(Get-FileHash -Path $dest -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($cur -ne $item.new_sha256) {throw "Existe un archivo nuevo distinto; no sobreescribir: $($item.path)"}
    }
  } elseif (!(Test-Path $dest)) {throw "Falta en GitHub: $($item.path)"}
  else {
    $cur=(Get-FileHash -Path $dest -Algorithm SHA256).Hash.ToLowerInvariant()
    if (($cur -ne $item.old_sha256) -and ($cur -ne $item.new_sha256)) {throw "Archivo cambiado desde el ZIP (21); ABORTADO sin modificar nada: $($item.path)"}
  }
}
$backup=Join-Path $env:TEMP ('milhano-ticketing-prelive-backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
foreach($item in $manifest) {
  $dest=Join-Path $repo ($item.path -replace '/','\')
  $candidate=Join-Path $source ($item.path -replace '/','\')
  $rel=$item.path -replace '/','\'
  if (Test-Path $dest) {
    $currentHash=(Get-FileHash -Path $dest -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($currentHash -eq $item.new_sha256) {continue}
    $b=Join-Path $backup $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $b) | Out-Null
    Copy-Item -Path $dest -Destination $b
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Copy-Item -Path $candidate -Destination $dest -Force
}
Write-Host 'Parche copiado a rutas correctas. Copia de seguridad: ' $backup -ForegroundColor Green
Write-Host 'Abra GitHub Desktop, revise cambios, ejecute tests y build antes del commit.'
