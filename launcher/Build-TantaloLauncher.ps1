[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$launcherDirectory = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $launcherDirectory "..")).Path
$sourcePath = Join-Path $launcherDirectory "TantaloLauncher.cs"
$iconPath = Join-Path $launcherDirectory "TantaloLauncher.ico"
$outputPath = Join-Path $repositoryRoot "TantaloLauncher.exe"

Add-Type -AssemblyName System.Drawing

$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#0D1212"))

$borderPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#3D4745")), 6
$cyanPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#65D1CA")), 16
$whitePen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#D8E6E3")), 18
$redBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#DC7379"))
$cyanPen.StartCap = $cyanPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Square
$whitePen.StartCap = $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Square

$graphics.DrawRectangle($borderPen, 10, 10, 235, 235)
$graphics.DrawArc($cyanPen, 28, 28, 200, 200, 38, 310)
$graphics.DrawLine($whitePen, 74, 78, 182, 78)
$graphics.DrawLine($whitePen, 128, 78, 128, 188)
$graphics.DrawLine($whitePen, 98, 188, 158, 188)
$graphics.FillEllipse($redBrush, 194, 32, 32, 32)

$pngStream = New-Object System.IO.MemoryStream
$bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $pngStream.ToArray()

$iconStream = [System.IO.File]::Open($iconPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = New-Object System.IO.BinaryWriter $iconStream
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$pngBytes.Length)
$writer.Write([UInt32]22)
$writer.Write($pngBytes)
$writer.Dispose()

$pngStream.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$borderPen.Dispose()
$cyanPen.Dispose()
$whitePen.Dispose()
$redBrush.Dispose()

if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

$source = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourcePath
$compilerParameters = New-Object System.CodeDom.Compiler.CompilerParameters
$compilerParameters.GenerateExecutable = $true
$compilerParameters.GenerateInMemory = $false
$compilerParameters.IncludeDebugInformation = $false
$compilerParameters.OutputAssembly = $outputPath
$compilerParameters.CompilerOptions = "/target:winexe /optimize+ /win32icon:`"$iconPath`""
[void]$compilerParameters.ReferencedAssemblies.Add("System.dll")

$compiler = New-Object Microsoft.CSharp.CSharpCodeProvider
$result = $compiler.CompileAssemblyFromSource($compilerParameters, $source)
$compiler.Dispose()

if ($result.Errors.HasErrors) {
    $messages = $result.Errors | ForEach-Object { $_.ToString() }
    throw "No se pudo compilar TantaloLauncher.exe:`n$($messages -join [Environment]::NewLine)"
}

Write-Host "Ejecutable creado: $outputPath" -ForegroundColor Green
