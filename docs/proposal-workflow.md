# Flujo de propuestas

`/proposals` es la cuarentena local para cambios narrativos. Importar un patch solo crea un registro en IndexedDB: no modifica el workspace ni `data/universe_master.json`.

## Recorrido autoral

1. Importa un `patch.json` desde Settings o el Centro de propuestas.
2. Revisa Validación: formato, rutas, IDs, referencias, Zod, compatibilidad e idempotencia.
3. Revisa Cambios: operaciones por módulo, clasificación `SAFE`, `REVIEW REQUIRED` o `REJECTED`, y valores antes/después.
4. Elige los motores locales en Settings. Los presets rápido, completo, continuidad y conexiones no cambian `analysisConfig` del canon.
5. Pulsa **Simular propuesta**. Se clona la base, se aplica el patch a la copia y se comparan índices, cobertura, diagnósticos, grafo y foreshadowing.
6. Conserva como borrador, rechaza, archiva o aprueba. Aprobar exige validación, simulación vigente, hash base coincidente y confirmación explícita.
7. **Abrir candidato en workspace** muestra temporalmente la copia. El banner `CANDIDATO SIMULADO — NO CANÓNICO` permanece visible. **Restaurar canon base** vuelve a la base sin perder la propuesta.
8. **Preparar promoción canónica** exporta patch, patch normalizado, master candidato, informe y manifiesto. La incorporación al repositorio ocurre fuera de la app mediante revisión y commit.

## Lectura de resultados

- Seguridad estructural resume esquema, referencias, IDs, operaciones destructivas e idempotencia.
- Compatibilidad canónica es un cálculo estructural explicable; no juzga calidad narrativa.
- Cobertura mide datos utilizables y se presenta separada del score.
- Plausibilidad solo aplica a una hipótesis estructurada introducida por el autor.
- Enlaces canónicos (`refs` y `foreshadowing`) y aristas derivadas del grafo se muestran por separado.

## Persistencia y recuperación

Propuestas: IndexedDB. Preferencias, snapshots y anotaciones: almacenamiento local separado. Candidato: memoria React. Canon fuente: `data/universe_master.json`. Crear un snapshot antes de abrir el candidato está activado por defecto; también puede guardarse el candidato desde Simulación.

El mismo patch ya simulado se reconoce como `ALREADY_APPLIED` en la copia, sin anexar referencias por segunda vez. Un cambio en el hash base obliga a volver a importar o simular contra la nueva base.
