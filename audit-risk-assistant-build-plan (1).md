# BUILD PLAN — AI-Powered Audit Risk Prioritization Assistant (MVP)
### Instructions for Claude Code — company-centric, real file upload

> **Ground rules**
> - **MVP for a hackathon.** Smallest version of each piece that's still genuinely hierarchical multi-agent, fan-out/fan-in, RAG-grounded, guardrailed, and HITL-enabled.
> - **No Docker, no database server.** All state (companies, uploaded data, runs) lives in-memory (a Python dict). **ChromaDB in embedded local mode** (`chromadb.PersistentClient(path="./chroma_data")`) is the only "storage," no external service.
> - **Use LangGraph** for orchestration — `StateGraph`, `Send()` fan-out, reducer fan-in, `interrupt()` for HITL, `InMemorySaver` checkpointer.
> - **You (Claude Code) never run install/setup commands yourself.** Always tell me the exact command, what it does, and wait for my confirmation.
> - Go phase by phase. Each phase ends in something small and checkable.

---

## 1. Revised demo flow

1. **Create a company** — name + industry, via a simple form.
2. **Upload one or more CSVs** for that company — each upload **accumulates** into that company's working dataset rather than replacing it (e.g. one file from Procurement, another from IT, another from a compliance review) — so the picture builds up incrementally before you run anything.
3. **Run the audit whenever ready** — kicks off the hierarchical agent graph on the company's full accumulated dataset.
4. **View results** — prioritized risk report, drill-downs, HITL review for flagged areas.
5. **Repeat for another company** — the Companies list shows all companies side by side with their status and top risk tier, so the demo visibly shows multiple companies processed independently.

If you upload more files *after* a run has completed, that company's status flips to `"stale"` (data has changed since the last run) until you re-run — this makes the accumulate-then-run relationship visible in the UI rather than silent.

To de-risk the live demo, **two companies come pre-seeded and pre-run at backend startup** (using ready-made sample CSVs), so the Companies list isn't empty on first load — you then do the create → upload → run flow live for a third company on top of that.

---

## 2. Agent hierarchy (unchanged in shape, now scoped per company-run)

```
        SUPERVISOR (per company run)
        entry: input guardrails on that company's uploaded areas
              │ fan-out (Send, one per audit area in this company)
   ┌──────────┼──────────┐
   ▼          ▼          ▼
 Area       Area       Area          each fans out to 4 leaf scorers,
 Pipeline   Pipeline   Pipeline      fans in to a composite score
   │          │          │
   └──────────┴────┬─────┘
                    ▼ fan-in (all areas for this company)
          AGGREGATOR — output guardrails, ranks areas,
          flags low-confidence/borderline for HITL
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
  Auto-finalized areas   interrupt() → Human Review
                    │
                    ▼
     FINALIZE — this company's Prioritized Report
```

Leaf scorers (unchanged): Historical Findings, Regulatory Change (RAG), Compliance Gap (RAG), Time-Since-Audit.

---

## Phase 1 — Bare FastAPI

`backend/main.py`: `FastAPI()` + CORS + `/health`.
`backend/requirements.txt`: `fastapi`, `uvicorn[standard]`.

**Prompt me to run:**
1. `python3 -m venv backend/.venv && source backend/.venv/bin/activate`
2. `pip install -r backend/requirements.txt`
3. `uvicorn main:app --reload` from `backend/`

**Check**: `curl localhost:8000/health` → `{"status":"ok"}`.

---

## Phase 2 — Bare Vite + React frontend

**Prompt me to run:**
1. `npm create vite@latest frontend -- --template react-ts`
2. `cd frontend && npm install`
3. `npm run dev`

Edit `App.tsx` to fetch `/health` — connectivity check only, replaced in Phase 13.

**Check**: browser shows `{"status":"ok"}`.

---

## Phase 3 — Folder structure

```
audit-risk-assistant/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── config.py
│       ├── models.py
│       ├── data/
│       │   ├── sample_uploads/          # ready-made demo CSVs
│       │   └── reference_docs.py        # regulatory/compliance/methodology text (shared, not per-company)
│       ├── guardrails/
│       │   ├── input_guardrails.py
│       │   └── output_guardrails.py
│       ├── rag/
│       │   ├── chroma_client.py
│       │   ├── ingest.py
│       │   └── retriever.py
│       ├── agents/
│       │   ├── historical_findings.py
│       │   ├── regulatory_change.py
│       │   ├── compliance_gap.py
│       │   └── time_since_audit.py
│       ├── graph/
│       │   ├── area_pipeline.py
│       │   └── supervisor.py
│       └── storage/
│           └── store.py                 # in-memory companies + runs
├── frontend/src/
│   ├── pages/
│   ├── components/
│   └── lib/
├── README.md
└── DECISIONS.md
```

**Check**: apps still boot after reorg.

---

## Phase 4 — Config & environment

`backend/app/config.py` (pydantic-settings): `anthropic_api_key`, `risk_review_threshold=65.0`, `confidence_review_threshold=0.6`, `chroma_dir="./chroma_data"`.
`.env.example` mirrors these.

**Prompt me to run:**
1. `pip install pydantic-settings` (add to requirements.txt)
2. Copy `.env.example` → `.env`, fill in my real Anthropic key myself

**Check**: temporary `/config-check` route confirms the key loaded without printing it.

---

## Phase 5 — Data contracts (Pydantic schemas)

`backend/app/models.py` — same as before, **plus a `Company` model**:

```python
class Company(BaseModel):
    company_id: str
    name: str
    industry: str
    created_at: datetime
    uploaded_files: list[str] = []      # filenames, in upload order — shown in the UI as a running list
    upload_status: Literal["no_data", "uploaded", "running", "completed", "stale"] = "no_data"
    area_count: int = 0
    finding_count: int = 0
    latest_run_id: str | None = None

class Finding(BaseModel):
    finding_id: str
    date: date
    severity: Literal["low", "medium", "high", "critical"]
    description: str
    status: Literal["open", "remediated"]
    source_file: str | None = None      # which upload this finding came from — provenance for the drill-down view

class AuditArea(BaseModel):
    area_id: str
    name: str
    department: str
    last_audited: date
    findings: list[Finding]
    related_tags: list[str]

class FactorScore(BaseModel):
    factor_name: str
    score: float
    confidence: float
    rationale: str
    citations: list[str] = []

class AreaRiskResult(BaseModel):
    area_id: str
    composite_score: float
    confidence: float
    factors: list[FactorScore]
    explanation: str
    needs_review: bool
    review_reason: str | None = None

class ReviewDecision(BaseModel):
    area_id: str
    reviewer_id: str
    action: Literal["approve", "adjust", "reject"]
    adjusted_score: float | None = None
    comment: str | None = None

class PrioritizedItem(BaseModel):
    rank: int
    area_id: str
    name: str
    final_score: float
    tier: Literal["low", "medium", "high", "critical"]
    explanation: str
    reviewed: bool

class AuditRun(BaseModel):
    run_id: str
    company_id: str
    status: Literal["running", "awaiting_review", "completed"]
    ranked_results: list[PrioritizedItem] = []
    flagged_for_review: list[AreaRiskResult] = []
```

`RegulatoryUpdate` model stays as before but its data now lives in `data/reference_docs.py` as **shared, cross-company** reference content (regulations don't belong to one company).

**Check**: pytest instantiates each model with sample data, no errors.

---

## Phase 6 — CSV upload schema + sample demo files

**Define the CSV contract** (one row per finding; area-level fields repeat across rows sharing the same `area_id` — the parser groups them):

```
area_id,area_name,department,last_audited,finding_id,finding_date,severity,description,status,related_tags
AA-001,Vendor Payments - APAC,Procurement,2023-02-10,F-101,2023-01-15,high,"Duplicate vendor payments identified in Q4 reconciliation",open,"vendor-management;data-privacy"
AA-001,Vendor Payments - APAC,Procurement,2023-02-10,F-102,2022-11-02,medium,"Missing three-way match approval on 4 invoices",remediated,"vendor-management;data-privacy"
AA-002,Payroll Processing,HR,2025-06-01,,,,,,"payroll;sox-controls"
```
(An area with zero findings has one row with empty finding columns.)

**Build sample CSVs** in `backend/app/data/sample_uploads/`, mixing clear-high-risk / clear-low-risk / borderline areas (borderline is what should trigger HITL):
- `company_a_findings.csv` — e.g. a logistics company, ~6 areas, single file (pre-seeded, single-upload company)
- `company_b_findings.csv` — e.g. a fintech company, ~6 areas, single file (pre-seeded, single-upload company)
- `company_c_findings_part1.csv` + `company_c_findings_part2.csv` — a **two-file split** (e.g. part 1 = Procurement + IT areas, part 2 = HR + Finance areas, with one repeated `area_id` across both files carrying different findings) — used **live** in the demo specifically to show accumulation: upload part 1, show the area/finding count go up, upload part 2, show it go up again and the repeated area's findings merge, *then* run the audit.

`backend/app/data/reference_docs.py` — the **shared** (not per-company) content: 6–8 `RegulatoryUpdate` records, a handful of compliance-report excerpt strings, 3–4 risk-methodology notes — same as the previous version of this plan. These feed the RAG collections regardless of which company is being audited.

**Check**: each sample CSV parses cleanly into `list[AuditArea]` via the Phase 7 parser (write this check once Phase 7 exists).

---

## Phase 7 — Guardrails (input + output)

`backend/app/guardrails/input_guardrails.py`:
```python
def parse_and_validate_csv(file_bytes: bytes, source_file: str) -> list[AuditArea]:
    # parse CSV, group rows by area_id into AuditArea+Finding objects,
    # stamp each Finding.source_file = source_file,
    # validate against Pydantic models, raise a clear error listing bad rows
    ...

def anonymize(area: AuditArea) -> AuditArea:
    # regex-scrub name/email/employee-ID-looking tokens from finding descriptions
    ...

def merge_audit_areas(existing: list[AuditArea], incoming: list[AuditArea]) -> list[AuditArea]:
    # accumulate incoming into existing rather than replacing:
    # - same area_id already present -> append incoming findings to it,
    #   deduping on finding_id (if a finding_id repeats, the newer upload's version wins),
    #   union related_tags, and take the MAX last_audited date across uploads
    # - new area_id -> add it as a new AuditArea
    # returns the updated full list for the company
    ...
```

`backend/app/guardrails/output_guardrails.py` — same as before: `validate_factor_score`, `enforce_grounding`, `enforce_score_bounds`, `flag_for_review`.

**Check**: unit tests — malformed CSV (missing required column) raises a clear validation error; a fake PII string gets scrubbed; empty retrieved chunks force low confidence; borderline score sets `needs_review=True`; **uploading two CSVs where one repeats an `area_id` from the other correctly merges findings into a single `AuditArea` with both files' findings present, each tagged with the right `source_file`.**

---

## Phase 8 — RAG layer (embedded ChromaDB, shared across companies)

Same as before — `regulatory_updates`, `compliance_reports`, `risk_methodology` collections, ingested once from `reference_docs.py` (not per-company; these are reference knowledge every company's audit draws from).

**Prompt me to run:**
1. `pip install chromadb` (add to requirements.txt) — first run downloads a small local embedding model, confirm internet access
2. `python -m app.rag.ingest` from `backend/`

**Check**: a query against `regulatory_updates` returns a relevant chunk.

---

## Phase 9 — Leaf scorer agents (unchanged)

Same 4 agents as before (`historical_findings`, `time_since_audit`, `regulatory_change`, `compliance_gap`), each `async def run(area: AuditArea) -> FactorScore`.

**Prompt me to run:**
1. `pip install langchain-anthropic` (add to requirements.txt)
2. `pytest backend/tests -k agents`

**Check**: passing tests against a known high-risk and low-risk area.

---

## Phase 10 — Area pipeline (Tier 1, fan-out/fan-in)

**Prompt me to run:** `pip install langgraph` (add to requirements.txt).

Same as before — one `StateGraph` per area: fan-out to 4 leaf scorers, fan-in to a composite `AreaRiskResult`.

**Check**: run standalone against a high-risk and low-risk synthetic area from one of the sample CSVs.

---

## Phase 11 — Supervisor graph (Tier 0) + HITL, now company-scoped

`backend/app/graph/supervisor.py` — same structure as before (`entry` → `fan_out` per area → aggregate → `decision` with `interrupt()` for flagged areas → `finalize`), but now:
- Takes `company_id` + that company's **full accumulated** `list[AuditArea]` (merged across all uploads so far) as input.
- Writes results into `store.py` keyed by `run_id`, linked to `company_id`.
- Updates the `Company.upload_status` to `"running"` → `"completed"` (or stays a sub-state of `running` while `awaiting_review`).
- If a new file is uploaded for a company whose `upload_status` is already `"completed"`, the upload handler sets it to `"stale"` instead of re-triggering anything automatically — the user explicitly hits **Run Audit** again to refresh.

`backend/app/storage/store.py` — in-memory:
```python
COMPANIES: dict[str, dict] = {}   # company_id -> Company + its parsed AuditAreas
RUNS: dict[str, dict] = {}        # run_id -> AuditRun
```

**Also in this phase**: a small startup script that pre-seeds and pre-runs `company_a` and `company_b` (single-file companies) from their sample CSVs when the backend starts, so the Companies list is populated immediately (see Section 1 above — this de-risks the live demo). `company_c`'s two-part CSV is deliberately **not** pre-seeded — it's held back for the live accumulate-then-run demo.

**Check**: on backend startup, `GET /api/companies` already shows 2 completed companies with ranked results; running a 3rd company from its CSV live behaves the same way (auto-finalizes clear-cut areas, pauses for borderline ones).

---

## Phase 12 — FastAPI endpoints

```
POST   /api/companies                              body: {name, industry} -> {company_id}
GET    /api/companies                               -> list of Company summaries (status, area_count, top risk tier if completed)
GET    /api/companies/{company_id}                  -> full company detail
POST   /api/companies/{company_id}/upload           multipart CSV upload -> parses+validates+anonymizes, MERGES into existing accumulated areas (via merge_audit_areas), appends filename to uploaded_files, updates area_count/finding_count, sets upload_status="uploaded" (or "stale" if a run already completed)
POST   /api/companies/{company_id}/run-audit        -> starts the graph over the company's full accumulated dataset -> {run_id}
GET    /api/companies/{company_id}/runs/{run_id}    -> status, ranked results, any areas awaiting review
POST   /api/companies/{company_id}/runs/{run_id}/review   body: list[ReviewDecision] -> resumes interrupted graph
GET    /api/companies/{company_id}/runs/{run_id}/export   -> CSV download of the prioritized report
GET    /api/sample-csv/{filename}                   -> serves any of the ready-made sample CSVs, including both company_c parts, for download-then-reupload if needed
GET    /health
```

Run the graph via `asyncio.create_task`; MVP can synchronously wait-then-return for `run-audit` given the small dataset size (a few seconds).

**Check**: via `/docs` — create a company, upload `company_c_findings_part1.csv`, confirm `area_count` reflects part 1 only; upload `company_c_findings_part2.csv`, confirm `area_count`/`finding_count` increase and the shared `area_id`'s findings list now contains findings from both files; call `run-audit`; poll until it shows ranked results plus any areas awaiting review.

---

## Phase 13 — Frontend pages

1. **`CompaniesListPage`** (home) — table: company name, industry, status badge (No Data / Uploaded / Running / Completed), top risk tier if completed. "+ New Company" button. Click a row → `CompanyDetailPage`.
2. **`NewCompanyPage`** — simple form (name, industry) → `POST /api/companies` → redirect to detail page.
3. **`CompanyDetailPage`**:
   - **Upload widget is always visible**, not just when empty — labeled "Upload another file" once at least one file exists. Below it, a running list of `uploaded_files` with a live `N audit areas / M findings parsed so far` counter that updates after each upload.
   - A link to "Download a sample CSV to try" (hits `/api/sample-csv/company_c_findings_part1.csv`, then a second link for `part2` once part 1 is uploaded — makes the accumulate story obvious in the UI itself).
   - **Run Audit** button — enabled once at least one file is uploaded; stays enabled after a run too (so you can add more files and re-run).
   - If `upload_status === "stale"`: a visible banner — "Data has changed since the last run — re-run to refresh results" — instead of silently keeping old results on screen.
   - Once running: loading state.
   - Once completed: the ranked dashboard (table/cards, filter by department/tier), click-through drill-down per area (factor breakdown, rationale, citations — including which `source_file` each finding came from), and a **Review panel** for any `awaiting_review` areas (Approve / Adjust / Reject + comment).
   - **Export** button → downloads the CSV report.

**Prompt me to run, as needed:**
- `npm install axios` (and `recharts` only if you want a simple risk-tier distribution chart — optional)

**Check**: full flow works by clicking only — Companies list shows 2 pre-seeded companies with results → create a 3rd company → upload `company_c_findings_part1.csv`, watch the counter update → upload `company_c_findings_part2.csv`, watch it update again and the shared area show merged findings → run audit → see ranked dashboard → resolve any flagged areas → export → back on Companies list, all 3 now show side by side.

---

## Phase 14 — Smoke test + docs

1. Restart the backend once, confirm the 2 pre-seeded companies re-populate identically (deterministic thresholds/data) and the live-run company still behaves the same on a repeat run.
2. `README.md` — what this is, setup (venv, npm install, `.env`, run both servers, no Docker), the CSV upload format (include the header row as a copy-paste reference), how pre-seeding works, and the in-memory-state-resets-on-restart tradeoff.
3. `DECISIONS.md` — assumptions made along the way.

## Phase 15 — MCP server (mounted in the same FastAPI process)

**Goal**: Expose the app's core actions as MCP tools — a real MCP server, not just more REST routes — so any MCP client (including the Phase 16 chatbot, or Claude Desktop) can drive the whole workflow.

**Key decision for the MVP**: mount the MCP server **inside the same FastAPI process** using streamable-HTTP transport (not a separate subprocess over stdio). This means it shares the same in-memory `store.py` state as the REST API with zero extra plumbing — no file-sharing or DB needed to bridge two processes.

`backend/app/mcp_server.py`:
```python
from mcp.server.fastmcp import FastMCP
from app.storage.store import (
    create_company as _create_company, list_companies as _list_companies,
    get_company as _get_company,
)
from app.guardrails.input_guardrails import parse_and_validate_csv, anonymize, merge_audit_areas
from app.storage.attachments import get_attachment   # Phase 16 — resolves attachment_id -> bytes
from app.graph.supervisor import run_audit_graph

mcp = FastMCP("audit-risk-assistant")

@mcp.tool()
def create_company(name: str, industry: str) -> dict:
    """Create a new company entry for audit risk assessment."""
    return _create_company(name, industry)

@mcp.tool()
def list_companies() -> list[dict]:
    """List all companies with their status and top risk tier if completed."""
    return _list_companies()

@mcp.tool()
def upload_findings(company_id: str, attachment_id: str) -> dict:
    """Upload a previously-attached CSV of audit findings for a company; merges into its accumulated dataset."""
    raw = get_attachment(attachment_id)
    areas = [anonymize(a) for a in parse_and_validate_csv(raw.bytes, raw.filename)]
    return merge_audit_areas(company_id, areas)   # returns updated area/finding counts

@mcp.tool()
def run_audit(company_id: str) -> dict:
    """Run the hierarchical risk-scoring audit over a company's full accumulated dataset."""
    return run_audit_graph(company_id)

@mcp.tool()
def get_risk_report(company_id: str) -> dict:
    """Get the latest prioritized risk report for a company, including any areas awaiting human review."""
    return _get_company(company_id)
```

In `backend/main.py`, mount it:
```python
from app.mcp_server import mcp
app.mount("/mcp", mcp.streamable_http_app())
```

**Prompt me to run:** `pip install mcp` (add to requirements.txt).

**Check**: with the backend running, a quick manual MCP client script (or the MCP Inspector CLI, `npx @modelcontextprotocol/inspector`) connecting to `http://localhost:8000/mcp` lists all 5 tools and can successfully call `create_company` and `list_companies`.

---

## Phase 16 — Chatbot connected to the MCP server

**Goal**: A chat interface where natural language ("create a company called Acme Logistics in fintech, then upload the attached file and run the audit") drives the same MCP tools from Phase 15 — this is the actual demonstration of MCP working end-to-end.

1. `backend/app/storage/attachments.py` — tiny in-memory store: `save_attachment(filename, bytes) -> attachment_id`, `get_attachment(attachment_id) -> (filename, bytes)`. Needed because MCP tool arguments are structured (JSON), not raw file bytes — the chat UI uploads a file via plain REST first, gets back an `attachment_id`, and the chat message references that id; the `upload_findings` MCP tool then resolves it server-side.

2. `backend/app/chat_agent.py` — a LangGraph ReAct-style agent that connects to the MCP server as a real client:
```python
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent
from langchain_anthropic import ChatAnthropic

async def build_chat_agent():
    client = MultiServerMCPClient({
        "audit_risk": {"transport": "streamable_http", "url": "http://localhost:8000/mcp"}
    })
    tools = await client.get_tools()
    model = ChatAnthropic(model="claude-sonnet-4-6")
    return create_react_agent(model, tools)
```
   Keep one agent instance built at startup and reused across chat turns (rebuilding per-message is wasteful).

3. **Input guardrail on chat messages too**: run the same `anonymize()` scrub on the raw user message text before it enters the agent loop (a pasted finding description could contain PII just as easily via chat as via CSV).

4. **Output guardrail on the chat reply**: after the agent finishes, check that any company/run IDs it mentions actually exist in `store.py` (a cheap grounding check against hallucinated IDs) before returning the reply to the frontend.

5. New REST endpoints (plain REST, not MCP — this is the chat *transport* between your frontend and backend, separate from the MCP layer the agent itself uses):
```
POST /api/chat/attachments        multipart file upload -> {attachment_id, filename}
POST /api/chat                    body: {conversation_id, message, attachment_ids: []}
                                   -> {reply, tool_calls: [{name, args, result_summary}], conversation_id}
```
   Keep chat history in-memory per `conversation_id` (same pattern as everything else — no DB).

6. **Frontend `ChatPage`**:
   - Message bubbles (user/assistant), a text input, and a paperclip **attach file** button — attaching immediately POSTs to `/api/chat/attachments` and shows a chip like "📎 company_c_findings_part1.csv" in the compose box.
   - **Crucially for the demo**: under each assistant reply, render the `tool_calls` trace — e.g. "🔧 called `create_company(name="Acme Logistics", industry="fintech")`" → "🔧 called `upload_findings(...)`" → "🔧 called `run_audit(...)`" — so judges can *see* the MCP round-trip happening, not just trust that it did.
   - Add "Chat" as a nav item alongside the Companies list — same data, two ways in.

**Prompt me to run:** `pip install langchain-mcp-adapters` (add to requirements.txt).

**Check**: in the chat UI, attach `company_c_findings_part1.csv`, type "Create a company called Acme Logistics, industry fintech, then upload the attached file and run the audit" — confirm the reply shows the tool-call trace for all four calls in order, and the Companies list page now shows Acme Logistics with real results, proving both interfaces share the same underlying state.

---

## What's cut for MVP → natural next features

- Arbitrary/flexible CSV column mapping (currently a fixed schema) or Excel/PDF ingestion.
- Persisting companies/runs across restarts (would need a lightweight file-based or real DB store).
- Viewing run *history* per company (currently only the latest run is kept — re-running overwrites it).
- Removing/undoing an individual uploaded file from a company's accumulated dataset.
- WebSocket streaming of per-area scoring progress instead of a blocking response.
- Multi-user reviewer assignment / auth (currently `reviewer_id` is just a free-text field).
- "Alignment with expert assessment" scoring metric, richer dashboard charts, PDF export.
- Streaming the chatbot's reply token-by-token instead of returning the full message at once.
- Exposing the MCP server externally (e.g. via a public URL) so a real external client like Claude Desktop could connect to it, not just your own in-process chatbot.
- A `submit_review` MCP tool for resolving HITL-flagged areas via chat too (currently HITL resolution stays in the web dashboard's Review panel only).

---

## Standing rules

- Always prompt me before any terminal command, wait for confirmation.
- No Docker, no database server, no hosted service unless I ask later.
- Keep deterministic/auditable logic (composite scoring formula, time-since-audit calc, threshold checks) out of the LLM — it writes rationale/explanation text only.
- Every agent/endpoint uses the shared Pydantic models from Phase 5 — no ad hoc dicts.
- Read the API key only from `.env` via `pydantic-settings` — never hardcode it, never ask me to paste it in chat.
- Write a test alongside each new agent/guardrail before moving to the next phase.
