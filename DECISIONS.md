# Decisions

Assumptions and decisions made along the way, in roughly chronological order.

- **Thin end-to-end slice before full breadth.** After Phase 7, the build order was
  reprioritized to get one scenario working through the entire pipeline (API -> graph ->
  guardrails -> HITL -> UI) before fleshing out every agent/page in isolation. Phases 9-13
  were built to the minimum needed for that slice, then Phase 14 added the remaining
  demo scenarios on top of the same infrastructure.

- **No local embedding model, no embeddings API yet.** Per instruction, the RAG layer
  never downloads a model or calls an external embeddings API. `HashEmbeddingFunction`
  (`app/rag/embeddings.py`) is a deterministic offline bag-of-words hash embedding used
  as a placeholder. Its cosine similarities are much lower than a real embedding model's,
  so worker-level RAG calls pass an explicit `min_similarity=0.15` (vs. the spec's
  documented default of 0.35, kept as the `retrieve()` default since that's calibrated
  for a real embedding model).

- **LLM calls degrade gracefully without an API key.** `app/tools/llm_client.py`
  returns a deterministic stub string (`"[stub explanation - no ANTHROPIC_API_KEY set] ..."`)
  when `settings.anthropic_api_key` is empty, instead of failing. This keeps every
  agent, lead, and the full supervisor graph runnable and testable with zero external
  calls; the only thing that changes once a key is added is the *explanation* text,
  never a pass/fail/warning verdict.

- **Topology hub reassigned to a clean device.** The synthetic topology generator
  originally made `dev-000` (index 0) the high-fanout hub, but index 0 is also one of
  the five deliberately-broken devices (expired cert). That made it impossible to
  demonstrate a "high blast radius but otherwise clean" scenario. `make_topology()` now
  uses `dev-005` (index 5, clean) as the hub instead.

- **`stream_end` only fires on a true terminal state.** The WebSocket runner
  (`app/graph/runner.py`) originally published `stream_end` after every `astream()` loop
  iteration finished — including when the loop ended because the graph merely paused for
  human approval, not because the run was actually done. That closed the frontend's
  WebSocket prematurely, so post-approval events (decision, finalized) were silently
  dropped into an unread queue. Fixed by checking the run's status and only publishing
  `stream_end` when it isn't `awaiting_approval`. Found via a real browser test (Playwright),
  not by inspection — the bug wasn't visible from curl/pytest alone because those tests
  don't hold a WebSocket connection open across an approve call.

- **Real rollback logic, not a placeholder.** `rollback_watch` in the supervisor graph
  is a second, real HITL gate: if the decision was "approve" and `blast_radius_sim`
  came back `warning`, it raises a second interrupt (reusing the same `raise_for_approval`
  payload shape and the same generic interrupt-handling code in the runner) asking the
  reviewer to confirm a rollback. Confirming sets `final_status="rolled_back"`.

- **Manual server restarts instead of `--reload`.** Uvicorn's `--reload` intermittently
  throws `WinError 10013` on this Windows environment and silently fails to pick up
  changes. Rather than debug the file watcher, the backend is restarted manually
  (`taskkill /F /IM python.exe` + relaunch) after backend code changes throughout the
  build.

- **Demo devices embedded in the frontend, not fetched.** Before scenarios existed
  (Phase 13), the "Submit Clean Device" / "Submit Broken Device" buttons use two
  hardcoded `DeviceProfile` objects copied from the synthetic inventory
  (`frontend/src/lib/demoDevices.ts`), since there was no "list devices" endpoint. Once
  Phase 14 added `/api/scenarios`, the scenario buttons became the primary demo path;
  the two manual buttons were kept as a lower-level way to exercise `/api/validate`
  directly.

## UI rebuild (Tailwind + React Flow + full page set)

The initial UI was one plain page proving the pipeline worked end-to-end. It was later
rebuilt into the originally-planned six-view app (Tailwind v4, React Router, React Flow,
Recharts, `react-diff-viewer-continued`, Zustand, a dataviz-skill-validated color
system). Two real bugs surfaced only by actually driving it in a real (Playwright)
browser — neither was visible from `tsc`, ESLint, or the backend test suite:

- **Duplicate agent results (18/9) from React 19 StrictMode.** `RunDetailLayout`'s mount
  effect calls `hydrate(runId)`; StrictMode double-invokes effects in dev, and the
  original guard (`runId matches AND results.length > 0`) didn't block the second call
  early enough, so it re-fetched and re-attached a second WebSocket, doubling every
  result. Fixed by guarding on `get().runId === runId` alone, checked synchronously
  before the first `await` — since `set()` is synchronous, the first call's guard-state
  is visible to the immediately-following duplicate call. Also added a belt-and-suspenders
  dedupe-by-`agent_name` in the `agent_result` message handler itself.

- **`request` never populated for scenario-started runs.** `startScenario` only gets a
  `run_id` back from `POST /api/scenarios/{id}/run` — the full `ProvisioningRequest`
  lives server-side. It relied on `hydrate()` to backfill `request` from `GET
  /api/runs/{id}`, but the StrictMode fix above made `hydrate()` a no-op whenever
  `runId` was already set (which `startScenario` always sets before navigating) — so
  `request` silently stayed `null` and the Impact/Compliance views hung on their loading
  state forever. Fixed by having `startScenario` fetch and set `request` itself,
  immediately after starting the run.

- **Agent-graph node overlap.** The first React Flow layout centered each lead's
  children independently around the lead's own x-position; with lead nodes spaced only
  210px apart, a 3-child group's outer children collided with the neighboring group's
  children. Rewrote the layout bottom-up: lay out every worker node in one evenly-spaced
  row first, then center each lead node over the mean x of its own children (and the
  supervisor over the mean of the leads) — a group's width no longer depends on its
  neighbors.

- **`react-diff-viewer-continued` shows a near-empty diff hunk for identical files.**
  When `oldValue === newValue`, the library still renders a stray one-line hunk instead
  of nothing. Rather than fight the library, the view now compares the two strings itself
  and shows a plain "identical, no diff to show" message in that case, falling back to
  the real diff viewer only when they actually differ.

## Neumorphic restyle

The UI was restyled to a neumorphic ("soft UI") look on request: every surface — page,
cards, buttons, inputs, graph nodes — shares one base color per theme, and depth comes
only from a paired light/dark drop-shadow (`.neu-raised`/`.neu-inset`/`.neu-btn` etc. in
`index.css`), never from a background-color or border difference. `--surface-0/1/2` were
collapsed to all alias the same `--neu-bg` token so existing inline styles didn't need
touching everywhere; borders were dropped in favor of shadows almost everywhere except
where dataviz-skill accessibility rules override the aesthetic:

- Status badges, risk-gauge fill, and graph-node rings keep their full-saturation status
  colors (never desaturated to fit the neumorphic palette) — the soft-UI treatment is
  layered *on top of* the color signal (a small dual-tone shadow), not instead of it.
- The Approve/Reject buttons keep solid, high-contrast status colors rather than
  matching the neutral base — a safety-critical action shouldn't blend into the
  background for the sake of a consistent look.

One real bug found via the browser check (not visible from `tsc`/`eslint`): React
Flow's default edge-label rendering (the "uplink"/"peer" labels in Impact Simulation)
ships its own opaque white label background, which read as a jarring unstyled box
against the dark-mode neumorphic surface. Fixed by setting `labelBgStyle`/`labelStyle`
per edge to the theme's `--neu-bg`/`--text-muted` tokens.
