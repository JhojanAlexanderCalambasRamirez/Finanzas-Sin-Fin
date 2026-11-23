param([ValidateRange(1024, 65535)][int]$Port = 3080)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'No se puede acceder a Docker. Inicia Docker Desktop y verifica el acceso desde tu PowerShell.' }
Write-Host "`nContenedores en ejecucion:"
docker ps --format 'table {{.Names}}\t{{.Ports}}'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Docker.' }
Write-Host "`nPuertos TCP en escucha:"
Get-NetTCPConnection -State Listen | Sort-Object LocalPort -Unique | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
# Consultar servicios activos no genera un error durante el primer arranque.
$running = docker compose ps --status running --services
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el estado de Docker Compose.' }
$existing = $null
if (@($running) -contains 'web') {
  $existing = docker compose port web 3000
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el puerto del servicio web.' }
}
if ($existing -and $existing -match ':(\d+)\s*$') {
  $Port = [int]$Matches[1]
} else {
  $selected = $false
  while ($Port -le 65535) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $probe.Start(); $selected = $true; break }
    catch [System.Net.Sockets.SocketException] { $Port++ }
    finally { $probe.Stop() }
  }
  if (-not $selected) { throw 'No se encontro un puerto disponible.' }
}
$env:APP_PORT = [string]$Port
$env:BIND_ADDRESS = '127.0.0.1'
Write-Host "`nIniciando Finanzas sin fin en http://localhost:$Port"
docker compose up -d --build --wait
if ($LASTEXITCODE -ne 0) { throw 'Docker no pudo iniciar la aplicacion. Revisa el mensaje anterior y docker compose logs web.' }
Write-Host "`nAplicacion disponible: http://localhost:$Port"
Write-Host "Para usar este mismo puerto despues, configura APP_PORT=$Port en .env."
