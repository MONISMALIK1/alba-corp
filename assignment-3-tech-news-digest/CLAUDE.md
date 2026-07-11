# CLAUDE.md — Tech News Digest (Assignment 3)

Guidance for Claude Code when working in this repo. This project is a submission for the "n8n
automation" assignment — see [Assignment brief](#assignment-brief) below.

## What this is

An n8n workflow that runs daily, pulls articles from three tech RSS feeds, scores them for
relevance, drops anything already sent before, summarizes the survivors with an LLM (via
OpenRouter), and produces a CSV of that day's articles. Email is an off-by-default option — one
config switch turns it on to also get the digest emailed with the CSV attached. Failures produce
the same kind of record instead of failing silently.

## Why n8n, and why this idea

- **n8n** over a hand-rolled script: the assignment specifically asks for a workflow-automation
  tool, and n8n's node graph makes the branching/conditional logic and error paths visually
  inspectable — a reviewer can open the canvas and see the whole decision tree, not just read code.
- **Topic news digest** over the other suggested ideas (price watcher, listing aggregator, repo
  report, lead enrichment): it's the only one where an LLM node, multi-source merging, and
  idempotency all fall out naturally rather than being bolted on for the bonus points. A price
  watcher or repo report tends to be single-source and light on real conditional logic unless
  forced.

## Key design decisions

- **OpenRouter, not OpenAI/Anthropic directly** — user-requested; OpenRouter's chat completions
  endpoint is OpenAI-compatible, called via a plain HTTP Request node (not n8n's LangChain nodes)
  for reliability across n8n versions when hand-authoring workflow JSON without a live instance to
  test against first.
- **CSV as the primary verifiable output, email demoted to optional** — user-requested after
  initially building email-first. n8n Cloud does not allow writing to the local filesystem at all
  (a sandboxing restriction), so there's no "CSV folder" in the literal sense on Cloud — the CSV
  is instead built as a binary attachment on the `Build CSV File` node, downloadable from that
  node's output panel both live and from past runs in n8n's Executions history. That's the
  verifiable artifact.
- **One `Config` node as the single on/off switch for email** — both `Email Enabled?` gates (one
  on the success path, one on the failure path) read the same `sendEmailEnabled` boolean from this
  one node via a direct cross-node reference, so there's exactly one place to flip it.
- **Idempotency via n8n's built-in Remove Duplicates node** ("Remove Items Seen In Previous
  Executions" mode, comparing on `link`) rather than an external Google Sheet — n8n persists this
  internally, so re-running the workflow never re-sends an article, without needing a Google OAuth
  credential for something this workflow doesn't otherwise need.
- **SendGrid over Gmail SMTP** for the email option — arrived at after Gmail's App Password flow
  hit an account-level restriction ("The setting you are looking for is not available for your
  account") that couldn't be resolved from the account settings available. SendGrid's SMTP relay
  needs only an API key, no 2-Step Verification prerequisite.

## Setup and credentials (placeholders only — see README for the live walkthrough)

- `OpenRouter - Summarize` needs an OpenRouter credential (native "OpenRouter" predefined
  credential type in n8n, or a Header Auth credential with `Authorization: Bearer <key>`).
- `Send Digest Email` / `Send Failure Email` need an SMTP credential (SendGrid: user `apikey`,
  password = SendGrid API key, host `smtp.sendgrid.net`, port `465`) — only required if
  `Config`'s `sendEmailEnabled` is set to `true`.
- No database, no Google Sheets, no OAuth flows.

## Deliverables checklist (map to assignment)

- [x] Trigger — Schedule Trigger, daily
- [x] External data — 3 RSS feeds (TechCrunch, The Verge, Hacker News)
- [x] Transformation — normalize fields, build the LLM prompt, parse the LLM response, build the
      CSV
- [x] Conditional logic — `Is Relevant?` (relevance score filter), `Email Enabled?` ×2 (config gate)
- [x] Error handling — `onError: continueRegularOutput` on the RSS nodes, retry + `onError:
      continueErrorOutput` on the OpenRouter call, with a dedicated failure branch that still
      produces a verifiable record
- [x] Delivered, verifiable output — CSV downloadable from the execution (always), optionally
      emailed with the CSV attached
- [x] LLM/AI node — OpenRouter summarization step (bonus)
- [x] Merging 2+ sources — 3 RSS feeds combined before scoring (bonus)
- [x] Retry/backoff on flaky calls — OpenRouter HTTP Request node, 3 tries, 2s apart (bonus)
- [x] Idempotency — Remove Duplicates node, "seen before" persisted across executions (bonus)
- [x] `workflow.json` (exported, importable, no real secrets)
- [x] README.md (what/why, node-by-node, setup/credentials, how to run, how to verify)

## Conventions

- No emojis in README/BUILD_LOG.
- Never commit real API keys, SMTP passwords, or credential IDs — `workflow.json` only ever
  contains placeholder credential references; real credentials live only inside the live n8n
  instance, created by whoever imports it.
- Personal email addresses in `workflow.json` stay as placeholders (`you@example.com`,
  `digest@example.com`) even though this repo is public — the live n8n instance has the real
  addresses filled in locally, not committed.

---

## Assignment brief

An n8n workflow that does something genuinely useful. It pulls or scrapes data, transforms it,
applies some logic, and delivers a result or report you can verify.

**What to Build**

Automate a real task end-to-end. Skip "fetch one URL and print it." Build something with
branching, transformation, and an output a real person would actually want.

Some ideas (pick one or bring your own): topic news digest (pull from a news API or RSS feeds,
dedupe, score and filter for relevance, summarise with an LLM node, and email or Slack a tidy
daily digest); price or availability watcher; job or listing aggregator; repo activity report;
lead enrichment pipeline.

Bonus points for: an LLM/AI node for summarising or classifying, merging data from two or more
sources, a reusable sub-workflow, retry/backoff on flaky calls, or idempotency (re-running doesn't
create duplicates).

**Core requirements**: a trigger, external data, transformation, conditional logic, error
handling, a delivered verifiable output.

**What to Hand In**

1. Live n8n instance (preferred) — Access to a live n8n instance (the free cloud tier is fine)
   with credentials so we can open and run it.
2. Or: exported workflow JSON — The exported workflow JSON, plus everything we need to import and
   run it.
3. README.md — Covering what the workflow does, a node-by-node walkthrough, setup and credentials
   (placeholders, never real secrets), how to run it, and how to verify it worked — with a
   screenshot or sample from a successful run.

**Documentation Requirements**

1. What and why — What the workflow does and why it's useful.
2. Node-by-node walkthrough — What each significant node does and how data moves between them.
3. Setup and credentials — Which API keys or connections are needed and how to set them up (use
   placeholders, never real secrets).
4. How to run it — Trigger manually or wait for the schedule.
5. How to verify it worked — Exactly what we should see and where (the email that lands, the
   sheet that fills, the Slack message that posts). Drop in a screenshot or sample from a
   successful run.
