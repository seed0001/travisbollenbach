# The Character Workshop — design a mind, then talk to it

**Route:** `/rabbit-hole/workshop` · **Component:** [`Workshop`](../src/components/Workshop.tsx) · **Backend:** `/api/workshop/chat` via [OpenRouter](https://openrouter.ai)

The live storefront on the Construct's street (Unit 01). It's a persona builder: you write a set of instructions that shapes how a language model thinks and speaks, then chat with what you made — all in the browser, no account needed.

## Two kinds of minds

The Workshop's central lesson is that the same model can become a person or a power tool, and the difference is only the instructions. The builder makes you choose which one you're writing:

| | **A Character** | **A Professional Tool** |
| --- | --- | --- |
| Answers | *Who are you?* | *What can you do for me?* |
| Is | A self with a point of view | A capability with a job |
| Has | A name, history, mood, opinions — and stays in them | A purpose, scope, rules, and output format |
| Built for | Story, roleplay, companionship, play | Drafting, analyzing, summarizing, deciding |
| Written like | A description of a person | A spec sheet |

## The builder

- **Mode picker** — character or tool; each mode swaps in its own helper text and placeholder.
- **Name** — what your persona is called.
- **Persona statement** — the actual instructions, written in the second person ("You are…").
- **Starters** — each mode ships a loadable example: *Kestrel*, a retired starship navigator running a tea house on a fog-bound border moon (character), and a contract-review assistant that summarizes clauses in plain English and flags risk (tool).

## The chat

Below the builder is a live chat panel. The persona statement is turned into a system prompt ([`src/lib/persona.ts`](../src/lib/persona.ts)) and run against an LLM through OpenRouter. Say hello and see who answers — or give it a task and watch it work. **Start over** resets the conversation.

## Operational details

- **Configuration** — the chat needs the `OPENROUTER_API_KEY` env var; `OPENROUTER_MODEL` overrides the default model. Without a key, the page still renders and the chat area explains the backend isn't connected yet.
- **Rate limiting** — every message spends the operator's API credits, so chat is rate-limited per IP.
- **Entry points** — visitors reach the Workshop three ways: walking up to Unit 01 inside the [Construct](05-the-construct.md), the direct route, or links from the rabbit-hole page.
- **Copy** — all Workshop text (the lesson, mode scaffolding, starters, chat strings) lives under `workshop` in [`src/lib/content.ts`](../src/lib/content.ts).
