"""Build FlyBreak's compact MaleCNS v1.0 level from the official type-edge table."""
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/source/mcns_fw_edge_comp.feather"
OUTPUT = ROOT / "data/derived/malecns_lc4_dng108.json"

ROLES = {
    "LC4": "source", "DNg108": "target", "DNa13": "protected",
    "DNa02": "protected", "DNp02": "gate", "DNp04": "gate",
    "DNp35": "gate", "DNp06": "gate", "DNp11": "gate", "DNg52": "gate",
    "AN_multi_12": "shared_gate", "CL342": "shared_gate",
}
NODES = {
    "LC4", "SAD064", "DNp02", "PVLP046", "DNp04", "DNp35", "DNp06", "DNp11",
    "PVLP137", "DNg52", "DNg108", "PVLP141", "LT51", "DNa13",
    "LC31b", "LAL028", "DNa02", "CB0623", "AN_multi_12", "PLP060", "CL342",
}

# Two weaker but biologically measured routes deliberately terminate in shared gates:
# both gates also feed DNa13, making a late cut collateral-heavy.
CURATED_LOW_WEIGHT_EDGES = {
    ("LC4", "CB0623"), ("CB0623", "AN_multi_12"),
    ("LC4", "PLP060"), ("PLP060", "CL342"),
}

df = pd.read_feather(SOURCE, columns=["pre", "post", "weight_m"])
edges = df[
    df.pre.isin(NODES) & df.post.isin(NODES) &
    ((df.weight_m >= 120) | pd.MultiIndex.from_frame(df[["pre", "post"]]).isin(CURATED_LOW_WEIGHT_EDGES)) &
    (df.pre != df.post)
].copy()

payload = {
    "metadata": {
        "dataset": "MaleCNS v1.0",
        "artifact": "mcns_fw_edge_comp.feather",
        "source": "flyconnectome/2025malecns supplemental_data",
        "license": "CC BY",
        "source_population": "LC4",
        "target_population": "DNg108",
        "protected_populations": ["DNa13", "DNa02"],
        "aggregation": "cross-matched cell-type groups",
        "minimum_male_synapse_weight": 19,
        "selection_note": "Curated LC4-to-descending subgraph with two measured low-weight shared-gate routes and protected off-target outputs."
    },
    "nodes": [{"id": n, "role": ROLES.get(n, "relay")} for n in sorted(NODES)],
    "edges": [
        {"source": r.pre, "target": r.post, "weight": int(r.weight_m)}
        for r in edges.itertuples(index=False)
    ]
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(payload, indent=2) + "\n")
print(f"wrote {len(payload['nodes'])} nodes and {len(payload['edges'])} edges to {OUTPUT}")
