[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$panelIndex = Join-Path $repoRoot "tantalo-panel\index.html"

if (-not (Test-Path -LiteralPath $panelIndex -PathType Leaf)) {
    Write-Error "No se encontró tantalo-panel\index.html en: $repoRoot"
    exit 1
}

$npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    Write-Error "No se encontró npm. Sistema Tántalo necesita Node.js y npm disponibles."
    exit 1
}

function Get-FreeLoopbackPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $freePort = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    return $freePort
}

function Test-LoopbackPortAvailable([int]$TargetPort) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $TargetPort)
    try {
        $probe.Start()
        return $true
    } catch {
        return $false
    } finally {
        try { $probe.Stop() } catch { }
    }
}

function Test-LocalPage([string]$Url, [string]$Pattern) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match $Pattern
    } catch {
        return $false
    }
}

function Test-LoreSystemEndpoint([int]$TargetPort) {
    return Test-LocalPage -Url "http://127.0.0.1:$TargetPort/" -Pattern '<title>\s*MEME\b'
}

function Wait-LoreSystem([int]$TargetPort, [System.Diagnostics.Process]$TargetProcess) {
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if (Test-LoreSystemEndpoint -TargetPort $TargetPort) { return $true }
        if ($TargetProcess.HasExited) { return $false }
        Start-Sleep -Milliseconds 100
    }
    return $false
}

$lorePort = 5173
$loreServer = $null
$loreReady = Test-LoreSystemEndpoint -TargetPort $lorePort

if (-not $loreReady) {
    if (-not (Test-LoopbackPortAvailable -TargetPort $lorePort)) {
        $lorePort = Get-FreeLoopbackPort
    }

    $loreArguments = @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$lorePort", "--strictPort")
    $loreServer = Start-Process -FilePath $npmCommand.Source -ArgumentList $loreArguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
    $loreReady = Wait-LoreSystem -TargetPort $lorePort -TargetProcess $loreServer

    if (-not $loreReady) {
        if (-not $loreServer.HasExited) { Stop-Process -Id $loreServer.Id -Force }
        Write-Error "LoreSystem v2 no pudo iniciarse en 127.0.0.1:$lorePort."
        exit 1
    }
}

$encodedRoot = [System.Uri]::EscapeDataString($repoRoot)
$loreUrl = "http://127.0.0.1:$lorePort/"
$encodedLoreUrl = [System.Uri]::EscapeDataString($loreUrl)
$panelUrl = "http://127.0.0.1:$lorePort/tantalo-panel/?repo=$encodedRoot&lore=$encodedLoreUrl"

if (-not (Test-LocalPage -Url $panelUrl -Pattern '<title>.*Tántalo')) {
    if ($loreServer -and -not $loreServer.HasExited) { Stop-Process -Id $loreServer.Id -Force }
    Write-Error "El Centro de Control Tántalo no respondió en: $panelUrl"
    exit 1
}

if (-not $NoBrowser) {
    Start-Process -FilePath $panelUrl
}

$loreProcessId = if ($loreServer) { $loreServer.Id } else { $null }
$loreProcessLabel = if ($loreProcessId) { "PID: $loreProcessId" } else { "servidor existente reutilizado" }

Write-Host "Centro de Control Tántalo disponible en: $panelUrl" -ForegroundColor Green
Write-Host "LoreSystem v2: $loreUrl | $loreProcessLabel" -ForegroundColor Cyan

[pscustomobject]@{
    Url = $panelUrl
    ProcessId = $loreProcessId
    LoreUrl = $loreUrl
    LoreProcessId = $loreProcessId
    Repository = $repoRoot
}
