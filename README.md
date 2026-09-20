# FlyBreak

**Save the cake. Spare the fly. Break the circuit.**

FlyBreak is a real-time structural-intervention game using a compact circuit
derived from the **MaleCNS v1.0** adult male *Drosophila* connectome.

## Real-data level

- Source population: `LC4`
- Target population: `DNg108`
- Protected outputs: `DNa13`, `DNa02`
- Aggregation: cross-matched cell-type groups
- Edge weights: measured male synapse totals
- Source artifact: `mcns_fw_edge_comp.feather`
- Display threshold: at least 120 male synapses
- Dataset license: CC BY

Official sources:

- https://male-cns.janelia.org/download/
- https://github.com/flyconnectome/2025malecns

The derived level is stored in `data/derived/malecns_lc4_dng108.json` and can
be regenerated with `scripts/build_real_level.py` after downloading the
official source artifact.

## Scientific boundary

FlyBreak performs graph propagation over structural connectivity. It is not a
biophysical simulation, does not reproduce measured activity, and does not
establish behavioral effects of an intervention.

## Run locally

```bash
npm run dev
```

Then open http://127.0.0.1:4173.
