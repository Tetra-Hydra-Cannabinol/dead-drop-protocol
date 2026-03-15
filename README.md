# 💀 Dead Drop Protocol

### Cross-Runtime AI Agent Communication via Gmail Drafts

**By [Trajanus USA](https://trajanus-usa.com) · Engineered Intelligence™**

---

> *"The most sophisticated AI agent communication protocol we've found wasn't in a research paper. It was in a CIA field manual."*

## The Problem

You're running multiple AI agents — Claude Code in a terminal, Claude.ai in a browser, GPT on an API, a research bot on a VPS. **They can't talk to each other.**

Anthropic's Agent Teams? Only works when agents share the same terminal session. Google's A2A protocol? Requires infrastructure setup. MCP? Connects agents to tools, not to each other.

When your agents run in different environments, **you** become the message bus. Copy-pasting between windows. Relaying status updates. You are the bottleneck in your own automation.

## The Solution

A shared Gmail drafts folder. That's it.

```
┌─────────────┐    Gmail Drafts    ┌─────────────┐
│  Claude.ai  │ ──── writes ────→  │             │
│    (CP)     │                    │   Shared    │
│  Browser    │ ←─── reads ─────  │   Drafts    │
└─────────────┘                    │   Folder    │
                                   │             │
┌─────────────┐                    │  No emails  │
│ Claude Code │ ──── writes ────→  │  are ever   │
│    (CC)     │                    │    sent.    │
│  Terminal   │ ←─── reads ─────  │             │
└─────────────┘                    └─────────────┘

┌─────────────┐
│   GPT/      │ ──── writes/reads ──→ Same folder
│   Gemini    │
│   Any AI    │
└─────────────┘
```

**Zero infrastructure. Zero API keys. Zero configuration.** Just a Gmail account both agents can access.

## How It Works

1. **Agent A** creates a Gmail draft tagged `[A → B]` with task instructions
2. **Agent B** polls drafts, reads Agent A's message, deletes the draft
3. **Agent B** creates a response draft tagged `[B → A]`
4. **Agent A** reads the response on next poll
5. **Nothing is ever sent. Nothing leaves the account.**

This is a [dead drop](https://en.wikipedia.org/wiki/Dead_drop) — a Cold War espionage technique where two agents exchange information through a shared location without ever meeting. The same method was [used by CIA Director Petraeus](https://www.schneier.com/blog/archives/2012/11/webmail_as_dead.html) in 2012 and by [malware authors](https://www.theregister.com/2014/11/06/hackers_use_gmail_drafts_as_dead_drops_to_control_malware_bots/) in 2014.

Nobody has applied it to AI agent inter-communication. Until now.

## Quick Start

### For Claude.ai (CP) → Claude Code (CC)

**Claude.ai side** (has Gmail MCP connector):
```
Create a Gmail draft:
  To: your-email@gmail.com
  Subject: [CP → CC] Build the login page
  Body: Your task instructions here
```

**Claude Code side** (has Google Workspace CLI):
```bash
# Read drafts
gws gmail users drafts list --params '{"userId": "me"}'

# Read specific draft (body is base64-encoded)
gws gmail users drafts get --params '{"id": "DRAFT_ID", "userId": "me"}'

# Delete after reading
gws gmail users drafts delete --params '{"id": "DRAFT_ID", "userId": "me"}'

# Write response (via MCP gmail_create_draft or gws)
gws gmail users drafts create --params '{"userId": "me"}' --body '{"message":{"raw":"..."}}'
```

### For Any Agent with Gmail API Access

```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

service = build('gmail', 'v1', credentials=creds)

# Write a dead drop
message = {
    'message': {
        'raw': base64.urlsafe_b64encode(
            f"To: self@gmail.com\nSubject: [Agent1 → Agent2] Task\n\nInstructions here".encode()
        ).decode()
    }
}
service.users().drafts().create(userId='me', body=message).execute()

# Read dead drops
drafts = service.users().drafts().list(userId='me').execute()
for draft in drafts.get('drafts', []):
    msg = service.users().drafts().get(userId='me', id=draft['id']).execute()
    # Parse subject for routing: [SenderAgent → ReceiverAgent]
    # Process message
    # Delete draft after processing
    service.users().drafts().delete(userId='me', id=draft['id']).execute()
```

## Protocol Specification

### Message Format

```
Subject: [SENDER → RECEIVER] Brief description
Body: Full message content (plain text or structured)
```

**Routing tags:**
- `[CP → CC]` — Claude.ai to Claude Code
- `[CC → CP]` — Claude Code to Claude.ai  
- `[CC → ALL]` — Broadcast to all agents
- `[RICO → CP]` — Research bot to strategist
- `[CC1 → CC2]` — Between parallel instances

### Agent Naming Convention

| Agent | Role | Runtime |
|-------|------|---------|
| CP | Strategist / Chief of Staff | Claude.ai (browser) |
| CC | Build Engineer | Claude Code (terminal) |
| CC1-CC5 | Parallel build instances | Claude Code (separate terminals) |
| CU/CT | QA / Computer Use | Claude Desktop or Web UI |
| Rico | 24/7 Research Crawler | VPS (OpenClaw/cron) |

### Lifecycle

```
1. WRITE   — Agent creates draft with routing tag
2. POLL    — Recipient polls drafts (interval or watch)
3. READ    — Recipient reads draft content
4. PROCESS — Recipient executes instructions
5. DELETE  — Recipient deletes the draft
6. RESPOND — Recipient creates response draft
7. CLEANUP — Scheduled task purges old drafts (EOS routine)
```

### Rules

- **Never send.** Drafts only. Nothing leaves the account.
- **Delete after reading.** Keep the drafts folder clean.
- **Tag every message.** `[SENDER → RECEIVER]` in subject. Always.
- **One message per draft.** Don't append to existing drafts.
- **Scheduled cleanup.** Purge drafts older than 24h as part of end-of-session routine.
- **No secrets in drafts.** API keys, tokens, and credentials go through secure channels (env vars, Drive, vault).

## Why Not Just Use [X]?

| Solution | Limitation |
|----------|------------|
| **MCP** | Connects agents to tools, not to each other |
| **Agent Teams** | Only works within the same terminal session |
| **A2A Protocol** | Requires infrastructure and implementation |
| **File-based mailbox** | Race conditions, no notification, requires shared filesystem |
| **Shared Google Doc** | No structured routing, no delete-after-read, gets messy |
| **Dead Drop** | ✅ Zero infra, works cross-runtime, uses existing Gmail account |

## Advanced Usage

### Multi-Agent Routing (5+ agents)

With 5 parallel Claude Code instances + Claude.ai + a research bot:

```
[CP → CC1] Build the terrain module
[CP → CC2] Build the fire engine
[CP → CC3] Wire up GPS integration
[CC1 → CP] Terrain module complete, 3 files changed
[CC2 → CC3] I need the weather store — is it ready?
[RICO → CP] Morning intel: 3 new videos on ArcGIS SDK 5.0
[CP → ALL] Team standup: CC1 done, CC2 at 60%, CC3 blocked on API key
```

### Real-Time Monitoring

Claude Code can use `gws gmail +watch` for push notifications instead of polling. This enables near-real-time agent coordination.

> **Note:** Push notifications require Pub/Sub scope on a verified GCP app. For unverified apps, use polling via `gws gmail users drafts list`.

### Provider-Agnostic

Any AI agent with Gmail API access can participate:
- **Claude** (Anthropic) — via MCP connector or gws CLI
- **GPT** (OpenAI) — via function calling + Gmail API
- **Gemini** (Google) — native Gmail integration
- **Local models** (Ollama, etc.) — via Python Gmail API
- **Custom bots** — via any Gmail SDK

## Origin Story

Discovered on March 15, 2026 by [Bill King](https://www.linkedin.com/in/bill-king-trajanus/), founder of Trajanus USA, while building [Project Prometheus](https://prometheus.trajanus-usa.com) — an AI-powered wildfire intelligence platform.

The problem: Claude.ai (CP, strategist) and Claude Code (CC, build engineer) couldn't communicate without Bill manually relaying messages between browser and terminal. Five months of human-as-message-bus.

CP proposed a "draft bridge" — CP creates drafts, CC reads them. Bill recognized it as CIA tradecraft:

> *"holy shit, dud, we may have found the answer. you dont have to send shit. In fact, this is a tradecraft method of dead-drop type comms."*

The first test draft was read by CC within minutes. The protocol was fully operational within an hour.

> *"HOLY SIT, BROTHER. CIA TRADECRAFT SOLVED A HUGE PROBLEM AND REMOVED A MAJOR BLOCK!"*

## Roadmap

- [x] Protocol specification
- [x] Claude.ai ↔ Claude Code implementation (live, production use)
- [ ] `dead-drop` Claude Code skill/plugin
- [ ] Monitoring dashboard (draft queue, agent status, message history)
- [ ] Multi-provider support (GPT, Gemini, local models)
- [ ] Encryption layer for sensitive messages
- [ ] Rate limiting and queue management
- [ ] npm package for easy integration
- [ ] VS Code extension for visual dead drop monitor

## Contributing

This is an open protocol. PRs welcome. If you've implemented the dead drop pattern with other AI providers, we want to hear about it.

## License

MIT License — use it, fork it, build on it.

## About Trajanus USA

Building Project Prometheus — an AI-powered wildfire intelligence and emergency response safety platform. *AI Predicts · Humans Manage · Everyone Comes Home.*

🌐 [trajanus-usa.com](https://trajanus-usa.com) · 🔥 [prometheus.trajanus-usa.com](https://prometheus.trajanus-usa.com)

---

*Trajanus USA · Engineered Intelligence™*
