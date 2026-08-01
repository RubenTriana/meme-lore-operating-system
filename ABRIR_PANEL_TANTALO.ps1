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

$pythonCommand = Get-Command "py.exe" -ErrorAction SilentlyContinue
$pythonArguments = @()
if ($pythonCommand) {
    $pythonArguments += "-3"
} else {
    $pythonCommand = Get-Command "python.exe" -ErrorAction SilentlyContinue
}

if (-not $pythonCommand) {
    Write-Error "No se encontró Python. Instálalo o configura un runtime disponible; el lanzador no instalará software automáticamente."
    exit 1
}

& $pythonCommand.Source @pythonArguments --version *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python existe, pero no pudo ejecutarse correctamente."
    exit 1
}

$npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    Write-Error "No se encontró npm. LoreSystem v2 necesita el runtime Node.js configurado en este repositorio."
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

function Test-LoreSystemEndpoint([int]$TargetPort) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$TargetPort/" -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match '<title>\s*MEME\b'
    } catch {
        return $false
    }
}

function Wait-LocalPort([int]$TargetPort, [System.Diagnostics.Process]$TargetProcess) {
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        Start-Sleep -Milliseconds 100
        try {
            $client = [System.Net.Sockets.TcpClient]::new()
            $client.Connect("127.0.0.1", $TargetPort)
            $client.Dispose()
            return $true
        } catch {
            if ($TargetProcess.HasExited) { return $false }
        }
    }
    return $false
}

$port = Get-FreeLoopbackPort
$lorePort = 5173
$loreServer = $null
$loreReady = Test-LoreSystemEndpoint -TargetPort $lorePort

if (-not $loreReady) {
    if (-not (Test-LoopbackPortAvailable -TargetPort $lorePort)) {
        $lorePort = Get-FreeLoopbackPort
    }
    $loreArguments = @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$lorePort", "--strictPort")
    $loreServer = Start-Process -FilePath $npmCommand.Source -ArgumentList $loreArguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
    $loreReady = Wait-LocalPort -TargetPort $lorePort -TargetProcess $loreServer
    if (-not $loreReady) {
        if (-not $loreServer.HasExited) { Stop-Process -Id $loreServer.Id -Force }
        Write-Error "LoreSystem v2 no pudo iniciarse en 127.0.0.1:$lorePort."
        exit 1
    }
}

$serverArguments = @($pythonArguments) + @("-m", "http.server", "$port", "--bind", "127.0.0.1", "--directory", $repoRoot)
$quotedArguments = ($serverArguments | ForEach-Object {
    if ($_ -match "\s") { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
}) -join " "

$server = Start-Process -FilePath $pythonCommand.Source -ArgumentList $quotedArguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
$ready = Wait-LocalPort -TargetPort $port -TargetProcess $server

if (-not $ready) {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
    if ($loreServer -and -not $loreServer.HasExited) { Stop-Process -Id $loreServer.Id -Force }
    Write-Error "El servidor local no pudo iniciarse en 127.0.0.1:$port."
    exit 1
}

$encodedRoot = [System.Uri]::EscapeDataString($repoRoot)
$loreUrl = "http://127.0.0.1:$lorePort/"
$encodedLoreUrl = [System.Uri]::EscapeDataString($loreUrl)
$panelUrl = "http://127.0.0.1:$port/tantalo-panel/?repo=$encodedRoot&lore=$encodedLoreUrl"

if (-not $NoBrowser) {
    Start-Process $panelUrl
}

Write-Host "Centro de Control Tántalo disponible en: $panelUrl" -ForegroundColor Green
Write-Host "Servidor local: 127.0.0.1 | PID: $($server.Id)" -ForegroundColor DarkGray
$loreProcessId = if ($loreServer) { $loreServer.Id } else { $null }
$loreProcessLabel = if ($loreProcessId) { "PID: $loreProcessId" } else { "servidor existente reutilizado" }
Write-Host "LoreSystem v2: $loreUrl | $loreProcessLabel" -ForegroundColor Cyan

[pscustomobject]@{
    Url = $panelUrl
    ProcessId = $server.Id
    LoreUrl = $loreUrl
    LoreProcessId = $loreProcessId
    Repository = $repoRoot
}
