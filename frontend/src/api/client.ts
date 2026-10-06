export type Model = {
  name: string;
  size?: number;
  details?: { parameter_size?: string; quantization_level?: string };
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  total_duration_ns?: number;
  prompt_duration_ns?: number;
  eval_count?: number;
  eval_duration_ns?: number;
};
export type Conversation = {
  id: string;
  title: string;
  model: string | null;
  created_at: string;
  updated_at: string;
  messages?: Message[];
};
export type OllamaStatus = { connected: boolean; version?: string };
export type ComparisonResult = {
  model: string;
  response?: string;
  error?: string;
  total_duration?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};
export type LocalDocument = { id: string; name: string; created_at: string };
export type ToolResult = {
  answer?: string;
  explanation?: string;
  sources?: string[];
  total_duration?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const api = {
  health: () => request("/api/health"),
  status: () => request<OllamaStatus>("/api/ollama/status"),
  models: async () =>
    (await request<{ models: Model[] }>("/api/ollama/models")).models,
  conversations: async (search = "") =>
    (
      await request<{ conversations: Conversation[] }>(
        `/api/conversations${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      )
    ).conversations,
  conversation: (id: string) =>
    request<Conversation>(`/api/conversations/${id}`),
  create: (model: string | null) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ model }),
    }),
  rename: (id: string, title: string) =>
    request<Conversation>(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  remove: (id: string) =>
    request<void>(`/api/conversations/${id}`, { method: "DELETE" }),
  compare: async (prompt: string, models: string[]) =>
    (
      await request<{ results: ComparisonResult[] }>(
        "/api/playground/compare",
        { method: "POST", body: JSON.stringify({ prompt, models }) },
      )
    ).results,
  documents: async () =>
    (await request<{ documents: LocalDocument[] }>("/api/tools/documents"))
      .documents,
  addDocument: (name: string, content: string) =>
    request<LocalDocument>("/api/tools/documents", {
      method: "POST",
      body: JSON.stringify({ name, content }),
    }),
  removeDocument: (id: string) =>
    request<void>(`/api/tools/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  askDocuments: (model: string, question: string) =>
    request<ToolResult>("/api/tools/documents/ask", {
      method: "POST",
      body: JSON.stringify({ model, question }),
    }),
  explainCode: (model: string, code: string, question: string) =>
    request<ToolResult>("/api/tools/explain-code", {
      method: "POST",
      body: JSON.stringify({ model, code, question }),
    }),
  stream: async (
    id: string,
    model: string,
    message: string,
    onToken: (text: string) => void,
    signal: AbortSignal,
  ) => {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: id, model, message }),
      signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed (${response.status})`);
    }
    if (!response.body)
      throw new Error("Streaming is not available in this browser.");
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const raw of events) {
        const line = raw.split("\n").find((item) => item.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === "token") onToken(event.content);
        if (event.type === "error") throw new Error(event.message);
      }
      if (done) break;
    }
  },
};
