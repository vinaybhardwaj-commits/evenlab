// Even Lab — Vertex AI (Gemini) text generation via REST + service-account auth.
// Server-only. Inputs are DE-IDENTIFIED aggregates (see insights.ts); never PHI.
import { GoogleAuth } from "google-auth-library";

let auth: GoogleAuth | null = null;
function credentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) throw new Error("AI not configured: GOOGLE_APPLICATION_CREDENTIALS_JSON is not set.");
  return JSON.parse(raw);
}
function getAuth(creds: any): GoogleAuth {
  if (!auth) auth = new GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  return auth;
}

export async function generateText(system: string, user: string, maxOutputTokens = 2048): Promise<string> {
  const creds = credentials();
  const project = process.env.GCP_PROJECT_ID || creds.project_id;
  const location = process.env.VERTEX_LOCATION || "us-central1";
  const model = process.env.VERTEX_MODEL || "gemini-2.5-pro";
  if (!project) throw new Error("AI not configured: missing project id.");

  const token = await getAuth(creds).getAccessToken();
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens },
    }),
  });
  if (!res.ok) throw new Error(`Vertex ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  const out = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text).filter(Boolean).join("").trim();
  if (!out) throw new Error("Vertex returned no text (try again).");
  return out;
}

export function modelName(): string {
  return process.env.VERTEX_MODEL || "gemini-2.5-pro";
}
