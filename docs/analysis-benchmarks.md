# Analysis benchmarks

Measurements are real wall-clock results from the local release environment. They are not estimates and should be compared only with runs using the same generator, seed, machine, and Node version.

## Environment

- Measured: `2026-07-14T14:39:57.190Z`
- Command: `npm run analysis:benchmark`
- Generator seed: `42`
- Runs per size: `1`, after a 100-entity warm-up
- Node: `v24.14.0`
- OS: Windows `10.0.19045`
- CPU: Intel Core i5-9400F at 2.90 GHz, 6 logical CPUs
- Installed RAM: 47.93 GiB reported by Windows

## Results

| Entities | Events | Relations | Validation | Normalization | Hashing | Indexing | Continuity | Causality | Knowledge | Graphs | Serialization | Cache payload |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 500 | 3,026 | 33.88 ms | 0.53 ms | 47.53 ms | 20.54 ms | 6.43 ms | 30.68 ms | 11.47 ms | 80.36 ms | 6.90 ms | 1,668,705 B |
| 5,000 | 2,500 | 15,146 | 108.00 ms | 1.35 ms | 142.74 ms | 68.44 ms | 19.97 ms | 97.56 ms | 121.77 ms | 473.22 ms | 33.50 ms | 8,492,298 B |
| 10,000 | 5,000 | 30,296 | 156.91 ms | 1.62 ms | 228.81 ms | 125.20 ms | 40.13 ms | 125.62 ms | 402.72 ms | 876.19 ms | 65.23 ms | 17,069,179 B |

Each generated universe produced two low-severity structural issues. `cache payload` is the UTF-8 byte size of the serialized compilation, engine issues, and connection result; browser IndexedDB overhead is not included. Heap usage after each run was 42,345,560 B, 159,879,952 B, and 230,274,392 B respectively.

## Demonstrated bottleneck and correction

The first 10,000-entity run failed with `RangeError: Maximum call stack size exceeded` in causal cycle detection. The recursive SCC traversal was replaced with an iterative two-pass traversal. The 10,000-entity regression now completes, and the measured causal stage is 125.62 ms.

Graphs remain the largest measured stage at 10,000 entities. No further optimization was made because the stage completed in 876.19 ms, betweenness is already bounded, and no correctness or release threshold failed. Re-run the benchmark before optimizing on a different target device.

## Pre-certification reproduction

The checkpoint repeated the command once on the same machine at `2026-07-14T14:57:03.229Z`. Graph time was 90.72 ms, 460.27 ms, and 828.54 ms for 1,000, 5,000, and 10,000 entities. The 10,000-entity value differs by -47.65 ms from the first run, illustrating normal run-to-run variation.

There is still only one recorded sample per checkpoint, so no median, percentile, standard deviation, or reliable variability range is available. These measurements are an environment-specific reproducibility check, not a universal performance guarantee.
