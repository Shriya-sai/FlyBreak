# FlyBreak data

The playable real-data level is derived from the official **MaleCNS v1.0**
type-level male edge-weight comparison table published by the MaleCNS authors:

`flyconnectome/2025malecns/supplemental_data/mcns_fw_edge_comp.feather`

The source file is not committed. Run `scripts/build_real_level.py` after placing
the official Feather file at `data/source/mcns_fw_edge_comp.feather`.

The derived level records its dataset, artifact, filtering threshold, selected
populations, aggregation level, and license. Edge weights are measured male
synapse totals between cross-matched cell-type groups.
