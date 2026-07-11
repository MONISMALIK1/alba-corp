# Build Log: Tech News Digest (Assignment 3)

## Goal & scope decision
Built an n8n workflow that turns three tech RSS feeds into one daily CSV of relevant, non-repeated
articles with an LLM-written summary, with email as an optional secondary delivery channel.
Deliberately left out: semantic relevance classification (keyword scoring is good enough for a
daily digest at this scope), a Google Sheets audit log (n8n's own execution history already serves
that purpose), and Slack delivery (swapped for email/CSV per instruction partway through).

## Stack & tooling
n8n (Cloud, free tier) for the workflow itself; OpenRouter (`openai/gpt-4o-mini`) for the
summarization step, called via a plain HTTP Request node rather than n8n's LangChain nodes;
SendGrid SMTP for the optional email delivery.

## Key decisions & trade-offs
- **Hand-authored the workflow JSON without a live n8n instance to test against first** — because
  that's what let me deliver a complete, importable workflow immediately rather than walking
  through node-by-node setup live. Trade-off: a few node parameter schemas had drifted from what I
  assumed (see "Hard parts" below), caught and fixed once the user actually imported and ran it.
- **Plain HTTP Request to OpenRouter instead of n8n's LangChain "AI Agent"/"Basic LLM Chain"
  nodes** — because those nodes use a separate sub-node connection type (`ai_languageModel`) that's
  more intricate and version-sensitive to hand-author correctly than a standard HTTP Request node,
  for the same reliability reason above. Functionally equivalent for this workflow's needs (a
  single summarization call, no tool use or multi-turn reasoning).
- **n8n's Remove Duplicates node over a Google Sheet for idempotency** — no extra credential needed,
  and n8n persists the "seen before" comparison internally across executions of the same workflow.
- **CSV downloadable from the execution output, not written to disk** — n8n Cloud doesn't allow
  local filesystem writes at all; this was discovered live (see "Hard parts"), and the fix — treat
  the `Build CSV File` node's binary output as the artifact, viewable/downloadable from n8n's
  Executions history — turned out to be a better fit for Cloud than the original disk-write design.
- **SendGrid over Gmail SMTP for the optional email path** — Gmail's App Password flow hit a wall
  (see "Hard parts"); SendGrid needs only an API key and a verified single sender, no 2FA
  prerequisite.

## Hard parts / dead ends
- **`Remove Duplicates` node's `fieldsToCompare` parameter** — authored as a nested
  `{ fields: [{ fieldName: "link" }] }` object based on an older schema; the live node actually
  wanted a plain string (`"link"`) or comma-separated string of field names. Surfaced immediately
  as a clear validation error in the n8n UI ("must be a string of fields separated by commas or an
  array of strings") once the user ran it — fixed in both the live workflow and `workflow.json`.
- **n8n Cloud does not support local disk writes** — the original design had `Build CSV File` write
  to `/data/digests/...` via a `Read/Write Files from Disk` node. First error was "the file or
  directory does not exist" (assumed a missing-folder issue, tried `/tmp/` instead); second error
  ("not writable") revealed it's not a path problem at all — n8n Cloud sandboxes execution
  containers and disallows filesystem writes outright. Removed both disk-write nodes entirely;
  the CSV/failure-record binaries are now terminal outputs of `Build CSV File` /
  `Format Failure Content`, downloadable directly from the n8n Executions UI — a legitimate
  verifiable output that doesn't depend on filesystem access at all.
- **Gmail App Passwords blocked at the account level** — after enabling 2-Step Verification, the
  App Passwords page still returned "The setting you are looking for is not available for your
  account," which (for a personal, non-Workspace Gmail account) generally means the feature is
  restricted for that account rather than something fixable via a settings toggle. Rather than
  keep debugging an opaque Google account restriction, switched the SMTP provider to SendGrid,
  which only needs an API key and sender verification (no 2FA dependency).
- **SendGrid sender verification friction** — SendGrid warns against using a free email domain
  (Gmail) as a sender, and requires a physical mailing address for CAN-SPAM/CASL compliance before
  it'll let *any* address send mail through the platform (not specific to their template designer).
  Both are expected, standard requirements for an individual account — not blockers, just steps
  that have to be completed once (verify a Gmail sender, accept the free-domain warning) before the
  email option works.

## How I verified it works
Ran the workflow manually end-to-end in the live n8n Cloud instance: confirmed `Score & Normalize`
computed relevance scores correctly, `Is Relevant?` filtered out low/zero-score items, `Dedupe`
passed through only new articles, `OpenRouter - Summarize` returned a real digest, `Build CSV File`
produced a downloadable CSV with real article data, and — after configuring the SendGrid SMTP
credential and flipping `Config`'s `sendEmailEnabled` to `true` — a real email arrived with the
digest as the body and the CSV attached. The `Remove Duplicates` schema bug and the disk-write
incompatibility were both caught this way, by actually running it rather than only reading the
JSON.

## Known limitations
See README.md "Known limitations" — keyword-based (not semantic) relevance scoring, no persistent
browsable CSV folder outside of n8n's own Executions history on Cloud, RSS-only with no scraping
fallback.

## Time spent
- Initial workflow design + hand-authored JSON (RSS → score → filter → dedupe → LLM → deliver):
  ~40 min
- Iterating on delivery channel per instruction (Slack → email+CSV → CSV-primary/email-optional):
  ~30 min
- Live debugging in n8n Cloud (dedupe schema fix, disk-write removal, Gmail → SendGrid credential
  pivot): ~45 min
- Docs (CLAUDE.md, README.md, this file): ~25 min
