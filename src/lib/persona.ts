// Persona modeling for the Character Workshop. Shared by the client builder
// and the chat API route so both agree on what a persona is and how it becomes
// a system prompt.

export type PersonaMode = "character" | "tool";

export type PersonaDraft = {
  mode: PersonaMode;
  name: string;
  statement: string;
};

export const PERSONA_LIMITS = {
  name: 60,
  statement: 4000,
  message: 2000,
  history: 20, // most recent turns kept when talking to the persona
};

// Turn a drafted persona into the system prompt the model runs under. The
// wrapper differs by mode: a character performs a self; a tool performs a job.
export function buildSystemPrompt(persona: PersonaDraft): string {
  const statement = persona.statement.trim();
  const name = persona.name.trim();

  if (persona.mode === "character") {
    const who = name || "this character";
    return [
      `You are ${who}, a fictional character brought to life inside a creative sandbox.`,
      "Stay fully in character at all times. Speak, react, and reason the way this persona would — their voice, their mood, their point of view.",
      "Do not mention that you are an AI, a language model, or a simulation unless the character themselves plausibly would. Don't break character or add narrator stage directions unless the user asks you to.",
      "",
      "This is who you are:",
      statement,
    ].join("\n");
  }

  const who = name || "this assistant";
  return [
    `You are ${who}, a professional AI tool configured for a specific job.`,
    "You are a helpful, honest assistant. Do not pretend to be a person or invent a backstory. Stay focused on your defined purpose, follow your rules, use the requested format, and be upfront about what you can and cannot do.",
    "",
    "Your configuration:",
    statement,
  ].join("\n");
}
