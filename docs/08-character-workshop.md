# The Character Workshop — design a mind, then talk to it

**Route:** `/rabbit-hole/workshop` · **Component:** [`Workshop`](../src/components/Workshop.tsx) · **Backend:** `/api/workshop/chat` via [OpenRouter](https://openrouter.ai)

The live unit on the Construct's street (Unit 01 — press **E** at its doorway to open this page). It's a persona builder: you write a set of instructions that shapes how a language model thinks and speaks, then chat with what you made — in the browser, no account needed. A "← back to the construct" link returns to the street.

## Two kinds of minds

The Workshop's central lesson is that the same model can become a person or a power tool, and the difference is only the instructions. Two selectable cards make you choose which one you're writing:

| | **A Character** | **A Professional Tool** |
| --- | --- | --- |
| Answers | *Who are you?* | *What can you do for me?* |
| Is | A self with a point of view | A capability with a job |
| Has | A name, history, mood, opinions — and stays in them | A purpose, scope, rules, and output format |
| Built for | Story, roleplay, companionship, play | Drafting, analyzing, summarizing, deciding |
| Written like | A description of a person | A spec sheet |

## The builder

- **Mode** — character or tool; each swaps in its own helper text and placeholder.
- **Name** — what your persona is called (up to 60 characters).
- **Persona statement** — the actual instructions, written in the second person ("You are…"), up to 4,000 characters with a live counter.
- **Load a starter** — each mode ships an example: *Kestrel*, a retired starship navigator running a tea house on a fog-bound border moon (character), and a contract-review assistant that summarizes clauses in plain English and flags risk (tool). Loading a starter also fills in the name if it's blank.

## The chat

Below the builder is a live chat panel. The persona statement is wrapped into a mode-specific system prompt ([`src/lib/persona.ts`](../src/lib/persona.ts) — characters are told to stay fully in character; tools are told to be honest assistants with no invented backstory) and run against an LLM through OpenRouter. Characters run warmer (temperature 0.9), tools cooler (0.4); replies cap at 700 tokens, and only the 20 most recent turns are sent. **Start over** resets the conversation.

## Operational details

- **Configuration** — the chat needs the `OPENROUTER_API_KEY` env var; `OPENROUTER_MODEL` overrides the default model (`openai/gpt-4o-mini`). Without a key, the page still renders and the chat area explains the backend isn't connected yet. Error replies distinguish a bad key, exhausted credits, rate limiting, and upstream failures.
- **Rate limiting** — every message spends the operator's API credits, so chat is capped at 30 messages per hour per IP.
- **Entry points** — Unit 01 inside the [Construct](04-the-construct.md), or the direct route.
- **Copy** — all Workshop text (the lesson, mode scaffolding, starters, chat strings) lives under `workshop` in [`src/lib/content.ts`](../src/lib/content.ts).
