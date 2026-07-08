// ---------------------------------------------------------------------------
// Client-side voice playback. Asks the server to synthesize speech (Edge TTS
// for the lower tiers, Fish Audio for the higher ones) and plays it. Returns
// null if the server can't speak — callers fall back to the browser's own
// speechSynthesis so no one is ever mute.
// ---------------------------------------------------------------------------

export type SpeechTier = "low" | "high";

export async function speakViaServer(
  text: string,
  tier: SpeechTier,
  onEnd: () => void,
): Promise<HTMLAudioElement | null> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tier }),
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("audio/")) return null;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const finish = () => {
      URL.revokeObjectURL(url);
      onEnd();
    };
    audio.onended = finish;
    audio.onerror = finish;
    await audio.play();
    return audio;
  } catch {
    return null;
  }
}
