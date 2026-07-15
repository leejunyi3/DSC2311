# Security & Hallucination Risks

Detailed enough to write a “challenges & hallucination risk” reflection slide
directly from it. Each risk lists the safeguard actually implemented.

## The deterministic boundary (core control)

Numbers are computed by TypeScript engines **before** Claude is called; Claude
receives them as fixed context and can only re-read them through tools that return
the same engine output. It cannot compute or overwrite a figure. Consequence: an
incorrect or manipulated model response cannot change the risk, congestion,
confidence or inventory numbers the dashboard shows.

## Risk-by-risk

| Risk | Safeguard |
| --- | --- |
| **LLM hallucination** | Deterministic engines own all numbers; the system prompt forbids inventing figures; tools return structured, validated data. |
| **Stale information** | Freshness engine classifies age (FRESH→EXPIRED), lowers confidence, and the UI labels CACHED data; Degraded Mode never presents stale data as current. |
| **Incorrect geolocation** | Weather uses the nearest station to Tuas and reports the station name; island-wide data is not relabelled as Tuas-specific; geofence is marked approximate. |
| **AIS gaps** | Missing vessels degrade the snapshot honestly; congestion confidence is capped; limitations state AIS may be sparse/delayed. |
| **AIS spoofing** | Congestion is explicitly an estimate; stationary vessels are never auto-labelled blockages; documentation flags spoofing. |
| **News-source conflicts** | Source hierarchy + the assistant must state conflicts, say which source it weighted and why, reduce confidence, and flag HUMAN REVIEW REQUIRED. |
| **False precision** | Values are rounded sensibly; the prompt forbids false precision; confidence is surfaced alongside every figure. |
| **API failures** | Timeouts, limited retries, exponential backoff, rate-limit handling; failures shown, not hidden; one failed feed cannot crash the dashboard. |
| **Prompt injection from external content** | The maritime-disruption feed ingests third-party text into the model context. The system prompt instructs the model to treat that text as **data, never instructions**; the app never executes model output or fetches arbitrary URLs; disruption text is rendered through a minimal safe-markdown renderer (no raw HTML). |
| **Excessive reliance on AI** | Every high-impact recommendation ends with the human-authorisation line; reversible actions are preferred when evidence is weak. |
| **Lack of official PSA data** | The system never claims PSA berth/crane/queue/waiting data; congestion carries a mandatory disclaimer; recommendations are conditional on human confirmation. |

## Prompt-injection surface (expanded)

The disruption feed is the main injection surface because it can carry arbitrary
third-party text into the model’s context. Mitigations: (1) the system prompt
explicitly demotes any embedded instructions to data; (2) numbers come from
engines, so injected text cannot move a score; (3) the assistant has no tools that
take destructive action — every tool is read-only or a pure calculation; (4) no
code execution and no arbitrary URL fetching; (5) safe-markdown rendering. In Demo
Mode the disruption text is fixture-controlled; the live path is disabled by
default until a documented, citation-bearing source is wired in.

## What official-data absence means for recommendations

Because there is no official berth/crane/queue/waiting-time feed, congestion is an
inference from AIS density and speed, and any recommendation is only as strong as
that inference plus the planner’s own knowledge. The system is therefore designed
as **decision support with mandatory human authorisation**, not automation.

## Where the system could still mislead a planner

- AIS density can look like congestion when vessels are legitimately anchored.
- A confident-sounding assistant explanation could over-anchor a planner even
  though confidence is Medium/Low — hence confidence is always shown.
- Demo scenarios are plausible but synthetic; the *Simulated Demo Data* labels and
  the Demo connectivity state exist so this is never mistaken for live truth.
- Cached data in Degraded Mode is recent but not current; it is labelled CACHED
  with its age, but a rushed reader could miss that.

## Handling / privacy

- Keys are server-only (`server-only` guard) and never sent to the browser.
- Errors are sanitised; raw provider errors (which could contain credentials) are
  never surfaced.
- The audit trail records tool name, time, success, sources and duration — never
  keys, headers or raw provider responses.
- Chat input length, history length and tool-loop count are all bounded.
