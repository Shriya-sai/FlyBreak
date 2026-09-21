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

# The challenge is a curated, directed subgraph rather than an unbiased circuit
# extraction. Keeping this explicit set makes the derived JSON reproducible and
# prevents the browser from maintaining a second hand-written edge list.
GAMEPLAY_EDGE_PAIRS = {
    ("LC4", "DNp02"), ("LC4", "DNp04"), ("LC4", "DNp06"),
    ("LC4", "DNp11"), ("LC4", "DNp35"), ("LC4", "SAD064"),
    ("SAD064", "DNp02"), ("SAD064", "DNp06"), ("SAD064", "DNp11"),
    ("LC4", "PVLP046"), ("PVLP046", "DNp04"), ("PVLP046", "DNp35"),
    ("PVLP046", "PVLP137"), ("DNp04", "DNp35"),
    ("DNp02", "DNg108"), ("DNp04", "DNg108"), ("DNp06", "DNg108"),
    ("DNp11", "DNg108"), ("DNp35", "DNg108"),
    ("LC4", "CB0623"), ("CB0623", "AN_multi_12"),
    ("AN_multi_12", "DNg108"), ("AN_multi_12", "DNa13"),
    ("LC4", "PLP060"), ("PLP060", "CL342"),
    ("CL342", "DNg108"), ("CL342", "DNa13"),
    ("LC4", "PVLP137"), ("PVLP137", "DNg52"), ("DNg52", "DNg108"),
    ("LC4", "LC31b"), ("LC31b", "PVLP137"), ("LC31b", "PVLP141"),
    ("LC31b", "LAL028"), ("LC4", "PVLP141"), ("PVLP141", "LT51"),
    ("PVLP141", "DNa13"), ("PVLP141", "DNa02"),
    ("PVLP137", "DNa13"), ("LT51", "DNa13"), ("LT51", "DNa02"),
    ("LAL028", "DNa13"), ("LAL028", "DNa02"),
}

df = pd.read_feather(SOURCE, columns=["pre", "post", "weight_m"])
edges = df[
    df.pre.isin(NODES) & df.post.isin(NODES) &
    pd.MultiIndex.from_frame(df[["pre", "post"]]).isin(GAMEPLAY_EDGE_PAIRS) &
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
        "selection_note": "Curated challenge derived from measured edges, with two low-weight shared-gate routes and protected off-target outputs.",
        "curated_low_weight_edges": [list(edge) for edge in sorted(CURATED_LOW_WEIGHT_EDGES)],
    },
    "rules": {
        "source": "LC4",
        "target": "DNg108",
        "max_target_paths": 8,
        "target_baseline_capacity": 2604,
        "protected_targets": [
            {"id": "DNa13", "path_count": 2, "baseline_capacity": 1052},
            {"id": "DNa02", "path_count": 2, "baseline_capacity": 906},
        ],
        "shared_gate_penalties": {"AN_multi_12": 14, "CL342": 8},
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
