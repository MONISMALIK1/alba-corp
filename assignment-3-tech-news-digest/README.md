# Tech News Digest (n8n + OpenRouter)

Assignment 3 in [alba-corp](../README.md). An n8n workflow that runs every morning, pulls fresh
articles from three tech RSS feeds, filters out anything off-topic, skips articles it's already
sent before, summarizes what's left with an LLM (via OpenRouter), and produces a CSV of the day's
articles. Email is available as an off-by-default option — flip one switch to also get the digest
emailed to you with the CSV attached. If the LLM call fails, a failure record is produced the same
way (and emailed too, if the option is on).

Three docs cover different angles of this project:
- **This README** — what it is, node-by-node, setup/credentials, how to run it, how to verify it.
- [**BUILD_LOG.md**](./BUILD_LOG.md) — the process journal: decisions made while building, hard
  parts (including two real bugs caught by actually running this live), and known limitations.

## 01 — What and why

Reading three separate tech feeds every morning and mentally filtering the noise is a small but
real daily chore. This workflow automates that end-to-end: fetch → score for relevance → dedupe
against everything already sent → summarize → deliver — so instead of scanning three feeds, you
get one CSV per day with exactly the articles that mattered, and the option to also have it
emailed if you'd rather read it that way.

## 02 — Node-by-node walkthrough

| Node | What it does |
|---|---|
| **Daily 8am Trigger** | Schedule Trigger, fires once a day at 08:00 server time. Change the hour/interval directly on the node if you want a different cadence. |
| **Config** | `Edit Fields` (Set) node — **the one on/off switch for the whole workflow**. A single boolean field, `sendEmailEnabled`, defaults to `false`. Open this node and flip it to `true` if you also want the digest emailed alongside the CSV. Both `Email Enabled?` gates later in the workflow read this same value, so it's the only place you ever need to change it. |
| **RSS - TechCrunch / The Verge / Hacker News** | Three `RSS Feed Read` nodes, each pulling one feed. All three connect into the *same* input on the next node — n8n concatenates multiple incoming connections automatically, so this is the "merge" step; no separate Merge node needed. `onError: continue` is set on each, so if one feed is temporarily down, the other two still get processed instead of the whole run failing. |
| **Score & Normalize** | Code node. Normalizes each RSS item's fields (`title`, `link`, `summary`, `pubDate`) and computes a `relevanceScore` — a count of how many of a keyword list (`ai`, `startup`, `llm`, `chip`, etc.) appear in the title/summary. Edit the `KEYWORDS` array at the top of this node to retarget the topic. |
| **Is Relevant?** | IF node — the conditional logic. Keeps only items where `relevanceScore > 0`; everything else is dropped (its "false" output isn't connected to anything). |
| **Dedupe (Seen Before?)** | `Remove Duplicates` node in "Remove Items Seen In Previous Executions" mode, comparing on the `link` field. n8n persists what it's seen between runs internally — this is what makes re-running the workflow idempotent: articles already digested once are never sent again, even if they're still in the RSS feed tomorrow. |
| **Build Digest Prompt** | Code node. Combines every surviving article into one LLM prompt asking for a single cohesive digest (not one API call per article), and carries the raw `articles` array forward for the CSV step later. **If zero articles survive filtering + dedupe, this node returns an empty array and every node after it simply doesn't run** — no digest, no CSV, no wasted LLM call on a "day with nothing new." |
| **OpenRouter - Summarize** | HTTP Request node — the LLM step. `POST`s to `https://openrouter.ai/api/v1/chat/completions` (OpenRouter's OpenAI-compatible endpoint) with the prompt, using model `openai/gpt-4o-mini` (cheap, fast, good enough for a summary — change the `model` field in the node's JSON body to use any other OpenRouter-hosted model). Has `retryOnFail: true` (3 tries, 2s apart) for transient network/rate-limit errors, and `onError: continueErrorOutput` — a real failure after retries routes to the error branch below instead of stopping the workflow. |
| **Parse LLM Response** *(success path)* | Code node. Extracts `choices[0].message.content` from OpenRouter's response into a plain `digest` string. |
| **Format Digest Content** | Code node. Turns the digest into an HTML block with today's date as a heading — used both as context for the CSV step and, if enabled, the email body. |
| **Build CSV File** | Code node. Pulls the original article list back via a direct reference to `Build Digest Prompt` (`$('Build Digest Prompt').item.json.articles`), builds a CSV (title, link, summary, pubDate, relevanceScore — one row per article), and converts it to binary with `prepareBinaryData`. **This node's output is the primary verifiable artifact** — its binary attachment (`digest-articles.csv`) is viewable/downloadable directly from this node's output panel, both live and from past runs in n8n's Executions history. No disk write needed — n8n Cloud doesn't allow writing to the local filesystem at all (a sandboxing restriction, not a missing-folder issue), so this workflow deliberately doesn't use a `Read/Write Files from Disk` node. |
| **Email Enabled? (Digest)** | IF node, checks `Config`'s `sendEmailEnabled`. False (default) → the run ends here, with the CSV downloadable from this run's execution record. True → continues to `Send Digest Email`. |
| **Send Digest Email** | `Send Email` node (SMTP), only runs if the option above is on. Sends the digest as the body with `digest-articles.csv` attached. |
| **Format Failure Content** *(error path)* | Code node, only runs if `OpenRouter - Summarize` errored out after its retries. Builds both a failure text attachment and a failure email body including the actual error text. |
| **Email Enabled? (Failure)** | Same gate as the digest path, applied to the failure notification — false (default) leaves the failure record downloadable from the execution, same as the success path. |
| **Send Failure Email** | Only runs if email is enabled — sends the failure alert. |

**Data flow in one line**: 3 RSS feeds → normalize + score → filter irrelevant → drop
already-seen → one LLM prompt → OpenRouter → CSV built (downloadable from the execution) →
(optionally) emailed too. On LLM failure: a failure record is built the same way → (optionally)
emailed too.

## 03 — Setup and credentials

Only the LLM step strictly needs a credential — email is optional and can be skipped entirely if
`Config`'s `sendEmailEnabled` stays `false`. Nothing below is stored in `workflow.json` — every
secret and address is a placeholder you fill in after importing:

1. **n8n instance** — free [n8n Cloud](https://n8n.io) tier works fine, or any self-hosted n8n.
2. **OpenRouter API key** (required) — sign up at [openrouter.ai](https://openrouter.ai), create a
   key under **Keys**. n8n has a native **OpenRouter** predefined credential type — when you open
   the `OpenRouter - Summarize` node, set Authentication to **Predefined Credential Type**,
   Credential Type to **OpenRouter**, then **Set up credential** and paste your raw API key (no
   `Bearer` prefix needed — n8n adds that for you with this credential type).
3. **SMTP credential** (optional, only needed if you turn email on) — for `Send Digest Email` and
   `Send Failure Email`. Two options:
   - **SendGrid** (recommended — no 2FA prerequisite): free account at
     [sendgrid.com](https://sendgrid.com) → **Settings → API Keys → Create API Key** (Mail Send
     permission is enough). Then **Settings → Sender Authentication → Verify a Single Sender** with
     the address you'll send from (SendGrid will warn that a free email domain like Gmail "is not
     recommended" — that's fine to proceed past for personal use) and confirm via the email it
     sends you. SMTP credential in n8n: user `apikey`, password = the API key, host
     `smtp.sendgrid.net`, port `465`, SSL on.
   - **Gmail SMTP**: host `smtp.gmail.com`, port `465` (SSL), your Gmail address as user, and a
     [Google App Password](https://myaccount.google.com/apppasswords) (not your normal password)
     as the password — requires 2-Step Verification enabled first, and some personal Google
     accounts restrict App Passwords entirely with no user-facing fix, which is why SendGrid is the
     recommended default here.

   Once you have the credential, open `Send Digest Email` and `Send Failure Email`, point each at
   it, and replace the placeholder `fromEmail`/`toEmail` values with real addresses (they must
   match your verified sender if using SendGrid).

No Slack, no Google Sheets, no OAuth flows, no filesystem access needed.

## 04 — How to run it

- **Automatically**: leave the workflow **Active** (toggle top-right in the n8n editor) — it
  fires daily at 8am per the Schedule Trigger.
- **Manually, right now**: open the workflow and click **Execute Workflow** (or the play button
  on the `Daily 8am Trigger` node). Manual runs execute the exact same path as the scheduled one.
- **To also enable email**: open the `Config` node, change `sendEmailEnabled` to `true`, save. No
  other changes needed.

## 05 — How to verify it worked

- **The CSV**: after a run, click the **Build CSV File** node → its output panel shows a binary
  attachment named `digest-articles.csv` with **View** and **Download** buttons — open it to see
  every article that went into that day's summary (title, link, summary, pubDate,
  relevanceScore). Past runs' CSVs are retrieved the same way from n8n's **Executions** tab.
- **The email** (if enabled): an email titled `Daily Tech Digest — YYYY-MM-DD` lands in the
  `toEmail` inbox, with the digest as the HTML body and `digest-articles.csv` attached.
- **In the n8n editor**: after a run, each node shows a small item count and a green check; click
  any node to open its output panel and inspect the actual data at that step (e.g. click `Score &
  Normalize` to see every article's computed `relevanceScore`, or `Dedupe (Seen Before?)` to see
  how many were dropped as repeats).
- **Idempotency check**: run the workflow twice in a row without new articles appearing in the
  feeds in between — the second run's `Dedupe` node should show 0 items passing through, and
  `Build CSV File` shouldn't run at all (nothing new to summarize).
- **Failure path check**: temporarily point the `OpenRouter - Summarize` node's credential at an
  invalid key, run manually, and confirm `Format Failure Content` produces a `digest-failure.txt`
  attachment (downloadable the same way) instead of the run just failing red with no trace.

### Sample successful run

![A full successful execution of the Tech News Digest workflow, every node green: 3 RSS feeds (50 items) → Score & Normalize → Is Relevant? (24 pass) → Dedupe (3 new) → Build Digest Prompt → OpenRouter - Summarize → Parse LLM Response → Format Digest Content → Build CSV File → Email Enabled? (Digest) → Send Digest Email (6 items). The failure branch (Format Failure Content → Email Enabled? (Failure) → Send Failure Email) sits idle below, unused because this run succeeded.](./docs/sample-run.png)

A real end-to-end run: 50 articles came in across the three feeds, 24 passed the relevance filter,
3 were new (not seen in a previous run), and those 3 became one digest — summarized, turned into a
CSV, and emailed (`sendEmailEnabled` was `true` for this run). The failure branch along the bottom
stayed idle, as expected on a successful run.

## Known limitations

- Relevance filtering is a simple keyword-match score, not semantic — it'll miss on-topic
  articles that don't use any listed keyword, and can occasionally let through an off-topic
  article that happens to mention one. Good enough for a daily digest; a real classifier would
  need its own LLM call per article, which trades cost/latency for precision.
- The `Dedupe` node's "seen before" memory lives inside n8n's own execution history for this
  workflow — if you ever **duplicate** the workflow (rather than edit this one in place), the
  duplicate starts with no memory of what's already been sent.
- No persistent, browsable "CSV folder" on n8n Cloud by design — Cloud sandboxes execution
  containers and doesn't allow local disk writes at all. The CSV is always produced and
  downloadable per-execution (see "How to verify it worked"), which is sufficient for review, but
  if you want a real folder of files you can browse anytime outside of n8n, swap the end of the
  success/failure branches for a node that uploads to somewhere persistent (Google Drive, S3,
  Dropbox) — or self-host n8n with a mounted volume and use `Read/Write Files from Disk` there,
  where local paths do work.
- RSS-only for now — no scraping fallback if a feed disappears or changes format.
