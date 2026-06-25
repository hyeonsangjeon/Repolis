<!-- 🌐 Language: **English** · [한국어](COUNCIL_PATTERN.ko.md) -->

# ⏳ The Kronos Council — a Horizontal Multi-Agent Deliberation Pattern

> *"The debate is theatre; the verdict is the judge's."*

Repolis' **Chronopolis** is a small but complete, production-deployed implementation of a
**horizontal multi-agent deliberation loop**: several peer LLM agents argue a topic *as equals*,
and a separate **chair** agent reads the whole transcript and rules. This document explains the
pattern, why it is shaped this way, and exactly where it lives in the code — so you can read it,
reuse it, or argue with it.

![Horizontal multi-agent deliberation — a topic is debated by three equal role-playing agents (advocate, skeptic, analyst) who react and rebut over several rounds, then a chair agent KRONOS aggregates the whole transcript into a verdict. Curated cases resolve deterministically; free topics use the chair LLM and are always labelled unverified.](assets/council-pattern.svg)

---

## The loop in one breath

```
topic ─▶ [ advocate ⇄ skeptic ⇄ analyst ]  ↻ rounds  ─▶ chair reads ALL ─▶ verdict
            (peers, no hierarchy)                         (aggregator/judge)
```

1. **A topic enters.** Free text — a full question, *or even a single noun* like `reasoning ratio`. The panel first frames what the term means, then takes positions.
2. **The panel argues as equals.** There is no "lead" agent. Each seat is assigned a **role** and the agents **react to and rebut each other by name** over several rounds, each reading the running transcript.
3. **The chair aggregates, then judges.** A distinct chair agent (KRONOS) reads the *whole* debate, **synthesises all positions**, and decides **by force of argument** — picking a side or stating a conditional middle, with a one-line *basis*.

The key property is **horizontality**: the debaters are peers. Intelligence is not in any single agent but in the *structured friction between them* plus a judge who weighs the result.

---

## Why give each seat a role

Early versions let three sages share the same "docs vs source vs community" personas. On a curated documentation question that worked; on a general topic it **rang hollow and looked like a fixed simulation**. Roles fix that — each seat gets a genuine debating stance that works for *any* subject:

| Seat | Role | Pushes for | Voice |
|------|------|-----------|-------|
| 🌿 Livewire | **Advocate** | the upside, benefits, practical value | *"here is why it works…"* |
| 📜 Olddoc | **Skeptic** | risks, traps, hype, counter-examples | *"is that really so?"* |
| 🌀 Hearsay | **Analyst** | context, conditions, trade-offs | *"it depends — the real…"* |

Roles create **productive disagreement**. The advocate proposes, the skeptic stress-tests, the analyst conditions — and because each agent sees the others' lines, they genuinely answer each other ("Olddoc, I agree the ratio shouldn't be maxed blindly, but…") rather than monologue in parallel.

---

## The golden rule — two verdict modes

A verdict is only as trustworthy as its source. Chronopolis is **honest about which kind it is**:

### ✅ Curated cases → deterministic
The six hand-authored cases (Pydantic, OpenAI SDK, Transformers, HTTP timeout, CSS centering, LangChain LCEL) resolve by a **fixed rule** — the newest *living* source wins. Same input → same verdict, every time. **Verified · reproducible · $0.** The debate above them is theatre; the math underneath is the truth. No LLM decides the answer.

### ⚡ Free topics → chair LLM
Any topic you type is judged **live** by the chair model. This is **AI inference, not computed fact**, so it is **always labelled `⚡ unverified`** in the UI, and it runs behind cost and rate guards. The value is the *reasoning you watch unfold*, not an oracle's decree.

This split is the heart of the pattern's integrity: **never dress up an LLM guess as a verified fact.**

---

## Reading-speed pacing (a UX rule, not just an LLM rule)

A live debate is worthless if it flashes past unread. The client runs a **producer/consumer pacing queue**: streamed turns are buffered, **split into sentence-sized bubbles**, and shown one at a time at **human reading speed** (≈2.4–7.2 s/bubble, auto-catching-up only when the model races far ahead). The **verdict is held until the queue drains**, so the conclusion never appears before you have read the argument. Deliberation you can't follow isn't deliberation.

---

## Cost & safety guards

Free-topic debates call a real model, so they sit behind layered guards: a lowered **daily live-count cap**, per-turn and per-debate **token bounds**, an **idle/abort timeout**, and a graceful **fallback to the zero-cost ambient stage** if the worker can't stream. A single debate costs roughly **$0.007–0.011**. The keyless Cloudflare worker reaches Azure OpenAI via Entra federation — no API key ships to the browser.

---

## Lineage

This pattern stands on a well-trodden line of work; Chronopolis is a playful, concrete instance of it:

- **Multi-Agent Debate** — independent agents debate and critique to improve factuality and reasoning, rather than trusting a single forward pass.
- **Mixture-of-Agents** — layered agents where later agents read and synthesise the outputs of earlier peers.
- **LLM-as-a-Judge** — a separate model scores or decides between candidate answers; here the chair judges a transcript.
- **Society of Mind** (Minsky, 1986) — intelligence as the emergent product of many simple, interacting agents.

> The contribution here is not a new algorithm but a **disciplined, honest packaging**: roles for real friction, reading-speed pacing for comprehensibility, and a hard line between *verified* (deterministic) and *unverified* (LLM) verdicts.

---

## Where it lives in the code

| Concern | File |
|---------|------|
| Free-topic roles, persona/prompt building, per-turn clamp | [`council/live.js`](council/live.js) |
| SSE streaming endpoint, universal chair system prompt, verdict prompt, token caps | [`cloudflare-taxi/src/grounded.js`](cloudflare-taxi/src/grounded.js) |
| Tunables: rounds, token budgets, clamp, chair max-tokens, daily cap | [`council/council.config.json`](council/council.config.json) |
| Client pacing queue, role chips, bubble split, verdict gate, live HUD | [`index.html`](index.html) (`renderChronoCase`, `conveneLive`, `streamDebate`, `pumpBubbles`, `showKronosVerdict`) |
| The sages themselves | [`SCHOLARS.md`](SCHOLARS.md) |

Open the live town, walk into **Chronopolis**, type a topic, and watch three peers argue while the Chair of Time rules — *the debate is theatre; the verdict is the judge's.*
