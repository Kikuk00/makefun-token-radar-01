# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Kikuk00/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Kikuk00/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: a web dashboard that ranks the protocols that record no token yet by what their launch would be worth, each with the steps to farm it. It reads a sealed DefiLlama snapshot, prices every pre-token protocol against the market-cap/TVL ratios of the tokens that already trade in its category, and renders a sortable, filterable board with a detail view per protocol. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

The program (Node 22, standard library only) writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to the output directory, plus `dossier.json`. Open `out/dashboard/index.html` in a browser — no network needed. The board covers the whole watchlist plus every other rankable pre-token protocol in the snapshot; protocols whose token already trades appear only in the Live view, at the market's own value.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wmk9f4s6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
