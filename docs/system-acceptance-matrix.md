# Matriz de aceptación del sistema experimental

Estados permitidos: `PASS`, `PASS WITH LIMITATIONS`, `FAIL`, `NOT TESTED`. La matriz separa capacidad técnica, evidencia narrativa y experiencia autoral; no convierte un éxito técnico en aprobación de contenido.

| Área | Estado | Evidencia | Prueba o comando | Resultado | Limitación | Acción requerida |
| --- | --- | --- | --- | --- | --- | --- |
| Instalación | PASS WITH LIMITATIONS | Instalación desde `package-lock.json` en clon temporal | `npm ci` en clon limpio | Dependencias instaladas sin copiar `node_modules` | Simulación en el mismo equipo, no otro dispositivo | Repetir en el equipo objetivo antes de declarar estabilidad |
| Arranque | PASS WITH LIMITATIONS | Servidor de preview responde localmente | `npm run preview -- --host 127.0.0.1` y petición HTTP | Respuesta del build verificada | No sustituye una sesión manual larga en navegador | Hacer recorrido autoral en el navegador objetivo |
| Carga | PASS | Fixture canónico incluido y clon limpio | `npm test`, `npm run validate:canon` | 95 entidades cargadas | Solo se certifica el archivo incluido | Validar cada canon importado antes de usarlo |
| Validación | PASS | Zod, referencias, duplicados y fechas | `npm test`, caso `broken-reference` | Canon real: 0 errores; referencia deliberada rechazada | Los tipos son extensibles | Mantener revisión autoral de significado |
| Clasificación | PASS WITH LIMITATIONS | Diez entidades reales revisadas por módulo y `type` | `npm run validate:canon` | 10/10 coinciden con lo declarado | No prueba verdad narrativa de la prosa | Autor debe aprobar la clasificación semántica |
| Continuidad | PASS WITH LIMITATIONS | Casos de muerte, simultaneidad, causa/efecto y excepciones | `npm run validate:system` | Casos deliberados detectados; flashback/copia no disparan falso positivo | Canon real: 4 reglas con datos insuficientes | Añadir estructura solo cuando el autor la confirme |
| Causalidad | PASS WITH LIMITATIONS | Causa tardía y ciclo intencional certificados | `npm run validate:system`, suite general | Contradicción detectada; excepción respetada | Canon real: 0/17 eventos con `causes`/`effects` | No inferir causalidad desde resúmenes |
| Conocimiento | PASS WITH LIMITATIONS | Uso previo e insuficiencia controlados | `npm run validate:system` | Uso previo detectado; ausencia temporal conservada | Canon real: 0 declaraciones | No interpretar prosa libre |
| Conexiones | PASS | Grafo, observaciones y reciprocidad separadas | `npm run validate:system`, `npm run validate:canon` | 304 aristas; métricas/observaciones/issues diferenciados | Referencia no implica significado narrativo | Revisar topología con contexto autoral |
| Plausibilidad | PASS WITH LIMITATIONS | Score reproducible y cobertura parcial de 30% | `npm run validate:system` | Score y cobertura permanecen separados | Canon real carece de datos analíticos; no hay hipótesis automática | Usar solo hipótesis escritas por el autor |
| Determinismo | PASS | Hash, IDs y resultados repetidos | `npm run validate:system` | Mismo contenido produce mismo hash e IDs | `generatedAt` cambia solo trazabilidad | Mantener orden estable en futuras reglas |
| Incrementalidad | PASS | Modificación parcial y eliminación completa | `npm run validate:system` | Cambio seguro parcial; eliminación fuerza full rebuild | Prioriza corrección, no mínima recomputación | Conservar fallback completo |
| Caché | PASS | Entrada incompatible descartada | `npm run validate:system` | Limpia y recompila una snapshot completa | IndexedDB depende del navegador | Ofrecer **Limpiar caché** ante problemas |
| Recuperación | PASS | Worker cancelado, caché dañada y derivados parciales | `npm test`, `npm run validate:system` | No acepta parciales ni pierde el último canon | No cubre fallo físico de disco | Mantener backups Git y externos |
| Exportación | PASS | Export JSON filtra anotaciones al issue presente | `npm run validate:system`, `npm test` | Identidad y decisiones exportadas | El archivo exportado no es canon | Revisar antes de compartir o aplicar |
| Protección del canon | PASS | Comparación antes/después y diff contra `main` | `npm run validate:system`, `git diff main -- data/universe_master.json` | Sin mutación ni diff narrativo | Git no reemplaza backup físico | No aplicar propuestas automáticamente |
| Anotaciones | PASS | Storage separado, hash de evidencia y revisión | `npm run validate:system` | Decisión local persiste y se invalida al cambiar evidencia | Es local al navegador | Exportar si se necesita portabilidad |
| Claridad de diagnósticos | PASS WITH LIMITATIONS | Regla, mensaje, evidencia, limitación y glosario visibles | pruebas de `/analysis`; revisión del fixture | Contratos y ayuda presentes | Utilidad literaria final requiere evaluación del autor | Registrar feedback de una sesión real |
| Accesibilidad del flujo | PASS WITH LIMITATIONS | Labels, roles, estados vacíos y navegación probados | pruebas React existentes | Flujo básico automatizado pasa | Sin auditoría manual de lector de pantalla | Hacer auditoría WCAG manual antes de producción |
| Documentación | PASS | Manual, guía, matriz e informe canónico | `npm run validate:system` y revisión de archivos | 26 temas y guía de 10 pasos presentes | Rutas pueden evolucionar | Actualizar documentación junto a cada cambio |

## Decisión

Las funciones esenciales cumplen la certificación experimental. El sistema queda **aprobado con limitaciones**: protege el canon y los casos controlados son explicables, pero el canon MEME real aún no posee cobertura temporal, causal, cognitiva o de plausibilidad suficiente para certificar exactitud narrativa amplia. Debe permanecer experimental y puede pasar a release candidate, no a `stable` ni `production`.

## Registro exacto de gates

Ejecución local del 14 de julio de 2026:

| Gate | Resultado | Tiempo del proceso |
| --- | --- | ---: |
| Typecheck | PASS | 6,47 s |
| Lint | PASS | 3,64 s |
| Suite general | PASS — 18 archivos, 101/101 pruebas | 11,57 s |
| `validate:system` | PASS — 1 archivo, 12/12 pruebas | 2,68 s |
| `analysis:build` | PASS — hash `fnv1a64-e020c17d2e15924d`, 6 archivos | 1,30 s |
| Build | PASS — 2.870 módulos transformados | 13,37 s |
| `validate:canon` | PASS — 95 entidades, 0 errores | 1,30 s |
| Preview | PASS — HTTP 200 y mount `#root` | comprobación dirigida |

Simulación limpia en un clon nuevo bajo `%TEMP%`, sin copiar `node_modules`, cachés ni derivados:

| Gate | Resultado | Tiempo del proceso |
| --- | --- | ---: |
| `npm ci` | PASS — 327 paquetes, 0 vulnerabilidades | 18,84 s |
| Typecheck | PASS | 7,71 s |
| Suite general | PASS — 18 archivos, 101/101 pruebas | 11,62 s |
| `validate:system` | PASS — 12/12 pruebas | 2,37 s |
| `analysis:build` | PASS — 6 archivos | 1,04 s |
| Build | PASS — 2.870 módulos transformados | 13,78 s |
| Preview | PASS — HTTP 200 en `/` y `/analysis` | comprobación dirigida |

Esta simulación se ejecutó en la misma máquina y no sustituye una prueba física en otro equipo o sistema operativo.
