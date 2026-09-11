[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$launcherDirectory = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $launcherDirectory "..")).Path
$executablePath = Join-Path $repositoryRoot "TantaloLauncher.exe"

if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    Write-Error "Primero ejecuta launcher\Build-TantaloLauncher.ps1."
    exit 1
}

$shell = New-Object -ComObject WScript.Shell
$desktopDirectory = [Environment]::GetFolderPath("Desktop")
$programsDirectory = [Environment]::GetFolderPath("Programs")
$displayName = "Sistema T$([char]0x00E1)ntalo"
$shortcutTargets = @(
    (Join-Path $desktopDirectory "$displayName.lnk"),
    (Join-Path $programsDirectory "$displayName.lnk")
)

foreach ($shortcutPath in $shortcutTargets) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $executablePath
    $shortcut.WorkingDirectory = $repositoryRoot
    $shortcut.IconLocation = "$executablePath,0"
    $shortcut.Description = "Abrir el Centro de Control $displayName"
    $shortcut.Save()
    Write-Host "Acceso directo creado: $shortcutPath" -ForegroundColor Green
}
