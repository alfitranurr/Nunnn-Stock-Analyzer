/**
 * Pemanggil LLM bersama (server): output JSON terstruktur dengan rantai cadangan
 * Gemini (beberapa model) → Groq → OpenAI, masing-masing dengan timeout dan batas waktu total.
 * Dipakai rangkuman berita dan sentimen Analisis Saham.
 */

import { getErrorMessage } from '@/lib/utils';

export type LlmProvider = 'Gemini' | 'Groq' | 'OpenAI';

export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'];
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const OPENAI_MODEL = 'gpt-4o-mini';
const PER_CALL_TIMEOUT_MS = 12_000;

export function hasLlmKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

/** Bersihkan pembungkus ```json dari jawaban model. */
export function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  return first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
}

async function callGemini(key: string, model: string, prompt: string, schema: object | undefined, timeoutMs: number): Promise<unknown> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', ...(schema ? { responseSchema: schema } : {}) },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Gemini ${model} responded ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini ${model} returned no text`);
  return JSON.parse(cleanJsonString(text));
}

async function callOpenAICompatible(url: string, key: string, model: string, prompt: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${model} responded ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${model} returned no text`);
  return JSON.parse(cleanJsonString(text));
}

export interface GenerateJsonOptions<T> {
  prompt: string;
  /** Skema respons Gemini (format OpenAPI subset). */
  geminiSchema?: object;
  /** Epoch ms batas akhir seluruh percobaan. */
  deadline: number;
  /** Validasi & normalisasi; kembalikan null bila jawaban tidak layak. */
  normalize: (raw: unknown) => T | null;
  /** Label untuk log. */
  tag: string;
}

/** Coba setiap penyedia secara berurutan; kembalikan hasil pertama yang lolos `normalize`. */
export async function generateJson<T>({ prompt, geminiSchema, deadline, normalize, tag }: GenerateJsonOptions<T>): Promise<{ value: T; provider: LlmProvider; model: string } | null> {
  const attempts: Array<{ provider: LlmProvider; model: string; run: (timeout: number) => Promise<unknown> }> = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    for (const model of GEMINI_MODELS) attempts.push({ provider: 'Gemini', model, run: (t) => callGemini(geminiKey, model, prompt, geminiSchema, t) });
  }
  if (groqKey) {
    attempts.push({ provider: 'Groq', model: GROQ_MODEL, run: (t) => callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', groqKey, GROQ_MODEL, prompt, t) });
  }
  if (openAIKey) {
    attempts.push({ provider: 'OpenAI', model: OPENAI_MODEL, run: (t) => callOpenAICompatible('https://api.openai.com/v1/chat/completions', openAIKey, OPENAI_MODEL, prompt, t) });
  }

  for (const attempt of attempts) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    try {
      const raw = await attempt.run(Math.min(PER_CALL_TIMEOUT_MS, remaining - 1000));
      const value = normalize(raw);
      if (value !== null) return { value, provider: attempt.provider, model: attempt.model };
      console.warn(`[${tag}] ${attempt.provider} ${attempt.model}: jawaban tidak lolos validasi`);
    } catch (err) {
      console.warn(`[${tag}] ${attempt.provider} ${attempt.model} gagal:`, getErrorMessage(err));
    }
  }
  return null;
}
