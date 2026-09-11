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

function Find-NpmCommand {
    $pathCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($pathCommand) { return $pathCommand.Source }

    $directCandidates = @(
        (Join-Path $env:ProgramFiles "nodejs\npm.cmd"),
        (Join-Path $env:LOCALAPPDATA "Programs\nodejs\npm.cmd")
    )

    foreach ($candidate in $directCandidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }

    $codexToolchain = Join-Path $env:LOCALAPPDATA "CodexToolchain"
    if (Test-Path -LiteralPath $codexToolchain -PathType Container) {
        $toolchainNpm = Get-ChildItem -LiteralPath $codexToolchain -Directory -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            ForEach-Object { Join-Path $_.FullName "npm.cmd" } |
            Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
            Select-Object -First 1
        if ($toolchainNpm) { return $toolchainNpm }
    }

    return $null
}

$npmCommand = Find-NpmCommand
if (-not $npmCommand) {
    Write-Error "No se encontró npm.cmd en PATH, Program Files, LocalAppData\Programs ni CodexToolchain. Instala Node.js o vuelve a abrir Codex para restaurar su toolchain."
    exit 1
}

$nodeDirectory = Split-Path -Parent $npmCommand
$pathEntries = $env:Path -split ";"
if ($pathEntries -notcontains $nodeDirectory) {
    $env:Path = "$nodeDirectory;$env:Path"
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
    $loreServer = Start-Process -FilePath $npmCommand -ArgumentList $loreArguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
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
