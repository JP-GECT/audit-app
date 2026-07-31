# Provisioning Guardian

A pre-provisioning validation platform: a multi-tier LangGraph agent system checks a
network device change request (certificate/NAC/fingerprint identity, DNS/NTP/mgmt-plane
reachability, template compatibility, blast-radius and config-diff impact) against a
local RAG corpus, scores risk deterministically, and gates risky changes behind a
human-in-the-loop approval step — with a live-streaming dashboard.

No Docker, no database server. Run state lives in memory (mirrored to flat JSON files
for completed runs); the vector store is ChromaDB in embedded/local persistent mode
(`backend/chroma_data/`, a plain folder, not a service).

## Architecture

```
Tier 0 (supervisor)      entry -> fan-out -> aggregator -> decision (HITL) -> rollback_watch (HITL) -> finalize
Tier 1 (leads)           identity_trust | reachability | template_compat | impact_compliance
Tier 2 (workers)         cert_validation, nac_posture, device_fingerprint,
                         dns_check, ntp_check, mgmt_plane_check,
                         blast_radius_sim, golden_config_diff
```

Every worker returns the shared `AgentResult` schema and passes through the guardrails
module (citation grounding, output validation, redaction, deterministic risk scoring).
Risk scoring, blast-radius traversal, and config diffing are all plain deterministic
code — LLM calls are used only to *explain* or *classify*, never to decide pass/fail.

## Frontend

Six pages/views over a single live-updating run store (Zustand):

- **Submit** (`/`) — canned demo-scenario cards, plus a full manual form for a custom
  device request.
- **Overview** (`/runs/:id`) — a live Tier0→Tier1→Tier2 agent graph (React Flow),
  streaming agent-result cards, a risk gauge, and the inline approval panel when a run
  is `awaiting_approval`.
- **Impact Simulation** (`/runs/:id/impact`) — the device topology graph with the
  blast radius (downstream dependents) highlighted.
- **Compliance Diff** (`/runs/:id/compliance`) — a split-view diff of the golden config
  template against the proposed config.
- **History** (`/history`) — aggregate metrics, a runs-by-outcome chart, and a table of
  every run this session.

All data comes from the same backend used by curl/pytest — the UI has no logic of its
own beyond rendering and the WebSocket→store wiring. Light/dark theme is a manual
toggle (persisted in `localStorage`) layered on `prefers-color-scheme`.

## Setup

Backend (PowerShell, from `backend/`):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Frontend (from `frontend/`):

```powershell
npm install
npm run dev
```

Then open the Vite dev URL printed in the terminal (usually `http://localhost:5173`).

Copy `backend/.env.example` to `backend/.env` and fill in `ANTHROPIC_API_KEY` to enable
real LLM explanations for `blast_radius_sim` and `golden_config_diff`. Without a key,
those agents fall back to a deterministic stub explanation string — every other check
is fully deterministic and works with no key at all.

To (re)generate synthetic fixture data and populate the RAG collections:

```powershell
python -m app.data.synthetic.generate
python -m app.rag.ingest
```

Run the backend test suite:

```powershell
pytest
```

## Demo scenarios

Three canned, deterministic scenarios are wired to `GET /api/scenarios` and
`POST /api/scenarios/{id}/run`, and exposed as buttons in the UI:

1. **Clean Pass** — every check passes; auto-approves with no human intervention.
2. **Blocked at Identity** — an expired certificate is a hard fail; the run pauses for
   human approval and the reviewer rejects it.
3. **Blast Radius Warning -> Rollback** — initial checks pass and the change
   auto-approves, but the device sits at a high-fanout point in the topology graph, so a
   second HITL gate asks the reviewer to confirm a rollback; confirming completes the
   run as `rolled_back`.

## Known tradeoffs

- **In-memory run state resets on restart.** `run_store.py` is a plain in-memory dict
  and the supervisor graph is checkpointed with LangGraph's `InMemorySaver`. A run that
  is paused awaiting approval is lost if the backend process restarts. Completed runs
  are mirrored to `backend/app/data/runs/{run_id}.json` as a nice-to-have, but that
  mirror isn't reloaded into `run_store` on startup.
- **Placeholder embeddings.** The RAG layer uses a deterministic, fully offline
  hash-based bag-of-words embedding (`app/rag/embeddings.py`) instead of downloading a
  local model or calling an embeddings API, per explicit instruction. It's good enough
  to demonstrate grounding/citation behavior, but retrieval quality is well below a real
  embedding model. Swap `HashEmbeddingFunction` for an API-based embedding function when
  ready — the retriever interface doesn't need to change.
- **Windows file-watcher reload is unreliable.** `uvicorn --reload` intermittently fails
  to pick up changes on this environment (`WinError 10013`); restart the server manually
  after backend code changes instead of relying on `--reload`.
- **Single WebSocket consumer per run.** The run's event stream is a single
  `asyncio.Queue`; if two clients connect to the same run's `/stream` endpoint, they
  compete for messages rather than both receiving every event.
