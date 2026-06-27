# examples/ — copy-paste recipes

The fastest way to understand Repolis's public surface. Every file here runs as-is.

| File | What it shows |
|---|---|
| [`ask-the-taxi.sh`](ask-the-taxi.sh) | Query the live grounding Worker (taxi + scholars) from the shell. |
| [`share-links.md`](share-links.md) | URL parameters: share any user's town, wire a realtime server, point at a custom backend. |
| [`embed.html`](embed.html) | Drop the live city into any page with one `<iframe>`. |

Run the city itself with **no build**:

```bash
git clone https://github.com/hyeonsangjeon/Repolis && cd Repolis
python3 -m http.server 8000      # → http://localhost:8000
```

See [`../AGENTS.md`](../AGENTS.md) for the full operating manual and [`../docs/domain-model.md`](../docs/domain-model.md) for the model.
