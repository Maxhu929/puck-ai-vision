import { buildAnalysisPrompt, parseAnalysis, type AnalysisArgs, type HockeyAnalysis } from "./twelvelabs.server";

const MODEL = "google/gemini-3.8-flash";

/** Grade a reviewed clip with Gemini (via Lovable AI) from a temporary video link. */
export async function analyzeVideoWithGemini(videoUrl: string, ...args: AnalysisArgs): Promise<HockeyAnalysis> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const [, , , shifts, , , , reviewed] = args;
  const { prompt, references } = buildAnalysisPrompt(...args);
  const refText = references.map((m, i) => `Reference photo ${i + 1} is a crop of the user-boxed target at video second ${m.time.toFixed(3)}. Use it for equipment/jersey details, not as proof of continuous tracking.`).join("\n");
  const content = [
    { type: "text", text: prompt + (refText ? "\n" + refText : "") + "\nAll timestamps refer to the video's own timeline." },
    { type: "video_url", video_url: { url: videoUrl } },
    ...references.map((m) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${m.referenceImage}` } })),
  ];
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: MODEL, stream: true, messages: [{ role: "user", content }] }),
    });
    if (res.ok || !(res.status === 429 || res.status >= 500)) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1) + Math.random() * 1000));
  }
  if (!res || !res.ok || !res.body) {
    const body = res ? await res.text() : "";
    console.error(`Gemini analysis failed [${res?.status}]: ${body}`);
    if (res?.status === 402) throw new Error("AI credits are used up. Add credits in Settings → Plans & credits, then send the clip again.");
    if (res?.status === 429) throw new Error("The AI is busy right now. Try sending the clip again in a few minutes.");
    throw new Error(`Video analysis failed [${res?.status}]. ${body.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const d = line.trim();
      if (!d.startsWith("data:")) continue;
      const payload = d.slice(5).trim();
      if (payload === "[DONE]") continue;
      try { text += JSON.parse(payload).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
    }
  }
  if (!text.trim()) throw new Error("The AI returned no answer for this clip.");
  return parseAnalysis(text, shifts, reviewed);
}
