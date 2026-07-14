# Guía rápida

1. Abre PowerShell y ejecuta `Set-Location "C:\Users\ruben\OneDrive\Documents\meme_LoreSystem_v2"`.
2. Instala exactamente el lockfile con `npm ci`.
3. Inicia la app con `npm run dev` y abre la dirección local que muestre Vite.
4. La app carga `data/universe_master.json`; para usar otro archivo, utiliza **Import JSON** en Ajustes.
5. Comprueba el panel de validación. Si el canon es inválido, no ejecutes análisis ni reemplaces el archivo original.
6. Ve a `/analysis` y pulsa **Analizar universo**. El canon actual trae los motores desactivados; habilítalos solo mediante `analysisConfig` en una copia validada.
7. Abre un issue para leer regla, severidad, confianza, entidades, fuentes y evidencia.
8. Si es intencional, selecciona **intentional** y añade una nota; queda en el navegador, no en el canon.
9. Ve a `/analysis/connections`, elige una entidad y explora un vecindario o una ruta limitada.
10. Antes de editar, crea un checkpoint en la rama experimental: revisa `git status`, usa `git add` solo para los archivos esperados y crea un commit descriptivo. No hagas push ni merge a `main` sin autorización.

Si un paso no es claro, consulta [el manual completo](user-manual.md). Canon, derivados, caché, diagnósticos, anotaciones y propuestas son capas distintas.
