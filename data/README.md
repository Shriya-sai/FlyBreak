# FlyBreak data

The playable real-data level is derived from the official **MaleCNS v1.0**
type-level male edge-weight comparison table published by the MaleCNS authors:

`flyconnectome/2025malecns/supplemental_data/mcns_fw_edge_comp.feather`

The source file is not committed. Run `scripts/build_real_level.py` after placing
the official Feather file at `data/source/mcns_fw_edge_comp.feather`.

The derived level records its dataset, artifact, filtering threshold, selected
populations, aggregation level, license, rules, and curation note. Edge weights
are measured male synapse totals between cross-matched cell-type groups.

The playable level is a curated challenge subgraph, not the full connectome.
The build script retains a fixed, auditable set of 43 measured edges. Four
explicitly named edges below the general 120-synapse threshold are kept to
preserve two shared-gate routes to a protected output; no synthetic edges are
added. See `scripts/build_real_level.py` for the exact pairs and regenerate the
JSON after any selection change.
