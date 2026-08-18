# Guía rápida

1. Para abrir la experiencia completa, ejecuta `C:\Codex\projects\meme_LoreSystem_v2\ABRIR_PANEL_TANTALO.bat`.
2. Si necesitas reinstalar dependencias, abre PowerShell en `C:\Codex\projects\meme_LoreSystem_v2` y ejecuta `npm.cmd ci`.
3. Para iniciar solo MEME LoreSystem, ejecuta `npm.cmd run dev` y abre la dirección local que muestre Vite.
4. La app carga `data/universe_master.json`. Un patch importado queda en `/proposals` y no cambia el workspace; un master completo exige confirmación explícita.
5. Comprueba el panel de validación. Si el canon es inválido, no ejecutes análisis ni reemplaces el archivo original.
6. En Settings activa motores o un preset local y ve a `/analysis`. Estas preferencias no modifican `analysisConfig` del canon.
7. Abre un issue para leer regla, severidad, confianza, entidades, fuentes y evidencia.
8. Si es intencional, selecciona **intentional** y añade una nota; queda en el navegador, no en el canon.
9. Ve a `/analysis/connections`, elige una entidad y explora un vecindario o una ruta limitada.
10. Antes de editar, crea un checkpoint en la rama experimental: revisa `git status`, usa `git add` solo para los archivos esperados y crea un commit descriptivo. No hagas push ni merge a `main` sin autorización.

Para revisar cambios: importar → validar → diff → simular → comparar → decidir → abrir candidato o exportar para promoción. Consulta [el flujo de propuestas](proposal-workflow.md) y [el manual completo](user-manual.md). Canon, workspace, derivados, caché, diagnósticos, snapshots, anotaciones y propuestas son capas distintas.
