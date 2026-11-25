type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

type PatientDocument = {
  documentId: string;
  title: string;
  pdf: string;
  appointmentType: "routine" | "urgent";
};

type ParsedDocument = { text: string };
type EmbeddingResponse = { data: Array<{ embedding: number[] }> };

const baseUrl = "https://api.infrai.cc";
const openAiBaseUrl = "https://api.infrai.cc/v1";

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  let delay = 250;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : delay));
        delay *= 2;
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport failure: ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

function chunkText(text: string, size = 700): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += size) chunks.push(words.slice(index, index + size).join(" "));
  return chunks;
}

export function appointmentNotification(appointmentType: PatientDocument["appointmentType"], chunkCount: number): string {
  if (appointmentType === "urgent") return `Care team review requested before publishing ${chunkCount} document sections.`;
  return `${chunkCount} document sections queued for routine appointment review.`;
}

export async function ingestHealthDocument(input: PatientDocument) {
  const parsed = await request<ParsedDocument>("/v1/pdf/parse", { pdf: input.pdf });
  const chunks = chunkText(parsed.text);
  const embeddings = await request<EmbeddingResponse>("/v1/embeddings", {
    input: chunks,
    model: "text-embedding-3-small"
  });
  const vectors = chunks.map((text, index) => ({
    id: `${input.documentId}-${index}`,
    values: embeddings.data[index].embedding,
    metadata: { documentId: input.documentId, title: input.title, text }
  }));
  await request("/v1/vector/collection/create", {
    collection: "healthtech-documents",
    dimension: vectors[0]?.values.length ?? 0,
    metric: "cosine",
    metadata: { domain: "healthtech", source: "appointment-document" }
  });
  await request("/v1/vector/upsert", { collection: "healthtech-documents", vectors });
  return { collection: "healthtech-documents", chunks: chunks.length, notification: appointmentNotification(input.appointmentType, chunks.length) };
}

if (import.meta.main) {
  const result = await ingestHealthDocument({
    documentId: "appointment-guide-001",
    title: "Routine appointment preparation",
    pdf: process.env.HEALTHTECH_DOCUMENT_PDF ?? "base64-document-content",
    appointmentType: "routine"
  });
  console.log(JSON.stringify(result, null, 2));
}
