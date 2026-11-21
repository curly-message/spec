## Benchmark of @curly-message/conformance

Node v24.22.3, linux x64. A time is per run: the median of 20 samples, and the range of the samples without their fastest and slowest quarter.

| Row | Kind | 4.2.0 | |
|---|---|--:|---|
| dist/index.js | size | 29,936 B |  |
| dist/index.js, gzipped | size | 9,795 B |  |
| fixtures: reading the set | time | 1.34 ms (1.33 ms–1.37 ms) |  |
| plan: the set, for an adapter of every level | time | 1.54 ms (1.52 ms–1.67 ms) |  |
| run: the set, against an adapter that answers nothing | time | 6.73 ms (6.58 ms–7 ms) |  |

Passed; nothing was compared.
