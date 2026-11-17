"""Generate README branding and charts from checked-in sources.

Documentation tooling only: Python 3.10+ and matplotlib. No account access.
Run from any directory: python docs/assets/generate.py
"""

import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator


ROOT = Path(__file__).resolve().parents[2]
ASSETS = Path(__file__).resolve().parent
MEASUREMENTS = ROOT / "docs/audit-2026-10-24-measurements.json"


def count_database_calls(events):
    return sum(" /rest/v1/" in event["message"] for event in events)


def generate_logos():
    source = (ROOT / "src/components/vantra/Primitives.tsx").read_text(encoding="utf-8")
    wordmark = source.split("export function Wordmark()", 1)[1].split("export function PosterCard", 1)[0]
    path = re.search(r'<path d="([^"]+)"', wordmark).group(1)
    for theme, color in [("dark", "#f5f5f7"), ("light", "#18181c")]:
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 184 38" role="img" aria-labelledby="title">
  <title id="title">VANTRA</title>
  <path d="{path}" fill="none" stroke="{color}" stroke-width="3.4" stroke-linejoin="miter"/>
  <circle cx="173" cy="25" r="2.4" fill="#e50914"/>
</svg>
'''
        (ASSETS / f"vantra-wordmark-{theme}.svg").write_text(svg, encoding="utf-8")


def generate_chart():
    measurements = json.loads(MEASUREMENTS.read_text(encoding="utf-8"))
    scenarios = [
        ("Open a series detail", count_database_calls(measurements["open"]["before"]), count_database_calls(measurements["open"]["after"])),
        ("Switch a season", count_database_calls(measurements["seasonSwitch"]["before"]), count_database_calls(measurements["seasonSwitch"]["after"])),
    ]
    # These counts come directly from the anonymised, checked-in request log.
    assert [(before, after) for _, before, after in scenarios] == [(5, 3), (2, 1)]
    data = {
        "measured_on": "2026-10-24",
        "unit": "client database API requests per tested interaction",
        "source": "../audit-2026-10-24-measurements.json",
        "excludes": ["Auth requests", "server-side requests", "SQL statement counts", "monthly egress and cost"],
        "scenarios": [
            {"name": name, "before": before, "after": after, "reduction_percent": (before - after) / before * 100}
            for name, before, after in scenarios
        ],
    }
    (ASSETS / "database-requests.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    for theme, bg, text, muted, grid, before_color in [
        ("dark", "#111114", "#f5f5f7", "#a8a8b6", "#29292f", "#737380"),
        ("light", "#ffffff", "#18181c", "#626270", "#e9e9ee", "#9a9aa5"),
    ]:
        plt.rcParams.update({"font.family": "DejaVu Sans", "svg.fonttype": "none", "svg.hashsalt": "vantra-docs"})
        fig, ax = plt.subplots(figsize=(11, 4.5), dpi=160)
        fig.patch.set_facecolor(bg)
        ax.set_facecolor(bg)
        fig.subplots_adjust(left=0.25, right=0.87, top=0.71, bottom=0.25)
        positions = [0, 1]
        ax.barh([y - 0.15 for y in positions], [row[1] for row in scenarios], height=0.23, color=before_color, label="Before", zorder=3)
        ax.barh([y + 0.15 for y in positions], [row[2] for row in scenarios], height=0.23, color="#e50914", label="After", zorder=3)
        for y, (_, before, after) in zip(positions, scenarios):
            ax.text(before + 0.08, y - 0.15, str(before), va="center", color=muted, fontsize=11)
            ax.text(after + 0.08, y + 0.15, str(after), va="center", color=text, fontsize=11, fontweight="bold")
            ax.text(6.05, y, f"{(before - after) / before:.0%} fewer", va="center", ha="left", color=text, fontsize=12, fontweight="bold", clip_on=False)
        ax.set_yticks(positions, [row[0] for row in scenarios], color=text, fontsize=11)
        ax.invert_yaxis()
        ax.set_xlim(0, 6)
        ax.set_xticks(range(6))
        ax.xaxis.set_major_locator(MaxNLocator(integer=True))
        ax.tick_params(axis="x", colors=muted, labelsize=9, length=0, pad=8)
        ax.tick_params(axis="y", length=0, pad=18)
        ax.set_xlabel("Client database API requests", color=muted, fontsize=10, labelpad=12)
        ax.grid(axis="x", color=grid, linewidth=0.7, zorder=0)
        for spine in ax.spines.values():
            spine.set_visible(False)
        fig.text(0.05, 0.9, "Less database traffic. Same private library.", color=text, fontsize=19, fontweight="bold")
        fig.text(0.05, 0.82, "Measured before and after the episode-state optimisation", color=muted, fontsize=10)
        legend = ax.legend(loc="upper left", bbox_to_anchor=(0, 1.18), ncol=2, frameon=False, fontsize=10, handlelength=1.3)
        for label in legend.get_texts():
            label.set_color(text)
        fig.text(0.05, 0.07, "24 OCT 2026  /  One account, two controlled interactions. Not a monthly usage or latency benchmark.", color=muted, fontsize=8)
        fig.savefig(ASSETS / f"database-requests-{theme}.png", facecolor=bg)
        fig.savefig(ASSETS / f"database-requests-{theme}.svg", facecolor=bg, metadata={"Title": "Measured client database request reductions", "Date": None})
        plt.close(fig)


if __name__ == "__main__":
    generate_logos()
    generate_chart()
    print("Generated transparent wordmarks and evidence-based request charts.")
