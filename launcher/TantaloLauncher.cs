using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

internal static class TantaloLauncher
{
    private const uint ErrorIcon = 0x00000010;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr window, string text, string caption, uint type);

    [STAThread]
    private static int Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(root, "ABRIR_PANEL_TANTALO.ps1");

        if (!File.Exists(script))
        {
            ShowError("No se encontro ABRIR_PANEL_TANTALO.ps1 junto al ejecutable.\n\n" + root);
            return 2;
        }

        try
        {
            string arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\"";
            if (HasNoBrowserSwitch(args))
            {
                arguments += " -NoBrowser";
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = arguments,
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardError = true
            };

            using (Process process = Process.Start(startInfo))
            {
                if (process == null)
                {
                    ShowError("Windows no pudo iniciar el lanzador de Sistema T\u00e1ntalo.");
                    return 3;
                }

                string diagnostic = process.StandardError.ReadToEnd();
                process.WaitForExit();
                if (process.ExitCode != 0)
                {
                    ShowError("Sistema T\u00e1ntalo no pudo iniciarse.\n\n" + NormalizeDiagnostic(diagnostic));
                }
                return process.ExitCode;
            }
        }
        catch (Exception error)
        {
            ShowError("No fue posible abrir Sistema T\u00e1ntalo.\n\n" + error.Message);
            return 1;
        }
    }

    private static bool HasNoBrowserSwitch(string[] args)
    {
        foreach (string argument in args)
        {
            if (string.Equals(argument, "-NoBrowser", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private static string NormalizeDiagnostic(string diagnostic)
    {
        string result = string.IsNullOrWhiteSpace(diagnostic)
            ? "El proceso termino sin proporcionar un diagnostico."
            : diagnostic.Trim();
        const int maximumLength = 1800;
        return result.Length <= maximumLength ? result : result.Substring(0, maximumLength) + "\n\n[diagnostico recortado]";
    }

    private static void ShowError(string message)
    {
        MessageBoxW(IntPtr.Zero, message, "Sistema T\u00e1ntalo", ErrorIcon);
    }
}
