# Lanzador de Windows para Sistema Tántalo

`TantaloLauncher.exe` abre `ABRIR_PANEL_TANTALO.ps1` sin dejar una consola visible. El ejecutable debe permanecer en la raíz del repositorio, junto al script PowerShell.

El script localiza `npm.cmd` en `PATH`, instalaciones habituales de Node.js y el toolchain local de Codex. Esto permite abrirlo desde el Explorador o la barra de tareas aunque esa sesión de Windows no tenga Node añadido a `PATH`. Si el arranque falla, el cuadro de diálogo muestra ahora el diagnóstico real del script.

Para reconstruirlo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\launcher\Build-TantaloLauncher.ps1
```

Para crear accesos directos en el Escritorio y el menú Inicio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\launcher\Install-TantaloShortcut.ps1
```

Windows 11 no permite que una aplicación se ancle silenciosamente a la barra de tareas. Después de crear el acceso directo, abre **Sistema Tántalo** y usa clic derecho sobre su icono para elegir **Anclar a la barra de tareas**.
