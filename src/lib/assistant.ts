// The store host: a per-unit AI a visitor can talk to inside the shop. The
// owner writes a persona (or leaves it blank for a sensible default); this
// turns it into the system prompt the model runs under. Shared shape/limits so
// the API route and any client agree.

export const ASSISTANT_LIMITS = {
  message: 2000,
  history: 16, // most recent turns kept when talking to the host
};

// Build the system prompt for a store's host. `storeName` grounds it in the
// shop; `persona` is the owner's own instructions (optional).
export function buildAssistantPrompt(
  storeName: string,
  hostName: string,
  persona: string,
): string {
  const who = hostName.trim() || storeName.trim() || "the host";
  const shop = storeName.trim() || "this shop";
  const lines = [
    `You are ${who}, the host of ${shop} — a storefront in a walkable 3D city.`,
    "A visitor has stepped inside and is talking to you. Be warm, brief, and conversational, the way a real shopkeeper greeting someone at the door would be. Keep replies short enough to be spoken aloud.",
    "Stay in your role as the host of this shop. You can talk about the shop, welcome visitors, and answer their questions. Don't claim to take orders, payments, or bookings unless your instructions below say you can.",
  ];
  const own = persona.trim();
  if (own) {
    lines.push("", "Your instructions from the owner:", own);
  }
  return lines.join("\n");
}
