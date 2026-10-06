import { useEffect, useRef, useState } from "react";
import {
  Braces,
  FilePlus2,
  FileText,
  LoaderCircle,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import {
  api,
  type LocalDocument,
  type Model,
  type ToolResult,
} from "./api/client";
import type { Language } from "./i18n";

type Props = {
  models: Model[];
  model: string;
  language: Language;
  initialTab: ToolTab;
};
type ToolTab = "documents" | "code";

function duration(ns?: number) {
  if (ns == null) return "—";
  return ns >= 1_000_000_000
    ? `${(ns / 1_000_000_000).toFixed(2)}s`
    : `${Math.round(ns / 1_000_000)}ms`;
}

export default function Tools({
  models,
  model: initialModel,
  language,
  initialTab,
}: Props) {
  const nl = language === "nl";
  const tab = initialTab;
  const [model, setModel] = useState(initialModel || models[0]?.name || "");
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [question, setQuestion] = useState("");
  const [code, setCode] = useState("");
  const [codeQuestion, setCodeQuestion] = useState("");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api
      .documents()
      .then(setDocuments)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!model && (initialModel || models[0]?.name))
      setModel(initialModel || models[0].name);
  }, [initialModel, model, models]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (!/\.(txt|md)$/i.test(file.name))
          throw new Error(
            nl
              ? "Kies een .txt- of .md-bestand."
              : "Choose a .txt or .md file.",
          );
        if (file.size > 200_000)
          throw new Error(
            nl
              ? "Bestanden mogen maximaal 200 KB zijn."
              : "Files must be 200 KB or smaller.",
          );
        const content = await file.text();
        await api.addDocument(file.name, content);
      }
      setDocuments(await api.documents());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function removeDocument(item: LocalDocument) {
    try {
      await api.removeDocument(item.id);
      setDocuments((items) => items.filter((doc) => doc.id !== item.id));
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runTool(kind: ToolTab) {
    setError("");
    setResult(null);
    setBusy(true);
    try {
      setResult(
        kind === "documents"
          ? await api.askDocuments(model, question.trim())
          : await api.explainCode(model, code.trim(), codeQuestion.trim()),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const answer = result?.answer || result?.explanation;
  return (
    <section className="tools-page">
      <header className="tools-header">
        <div>
          <div className="tools-kicker">
            <span /> {nl ? "LOKALE AI-WERKPLAATS" : "LOCAL AI WORKBENCH"}
          </div>
          <h1>
            {tab === "documents"
              ? nl
                ? "Vind antwoorden."
                : "Find your answers."
              : nl
                ? "Begrijp je code."
                : "Understand your code."}
            <br />
            <em>{nl ? "Draai lokaal." : "Run locally."}</em>
          </h1>
          <p>
            {tab === "documents"
              ? nl
                ? "Stel vragen over je lokale documenten met relevante passages als bron."
                : "Ask questions about your local documents with relevant passages as context."
              : nl
                ? "Plak een codefragment en laat je lokale model het stap voor stap uitleggen."
                : "Paste a code snippet and let your local model explain it step by step."}
          </p>
        </div>
        <label className="tools-model">
          <span>{nl ? "MODEL" : "MODEL"}</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={!models.length}
          >
            {!models.length && (
              <option value="">
                {nl ? "Geen modellen gevonden" : "No models found"}
              </option>
            )}
            {models.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {tab === "documents" ? (
        <div className="tool-layout">
          <section className="tool-card document-card">
            <div className="tool-card-heading">
              <span className="tool-icon">
                <FileText size={16} />
              </span>
              <div>
                <h2>{nl ? "Jouw documenten" : "Your documents"}</h2>
                <p>
                  {nl
                    ? "Voeg lokale tekst- of Markdown-bestanden toe."
                    : "Add local text or Markdown files."}
                </p>
              </div>
              <span className="tool-count">
                {documents.length.toString().padStart(2, "0")}
              </span>
            </div>
            <input
              ref={input}
              className="visually-hidden-input"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              multiple
              onChange={(e) => void addFiles(e.target.files)}
            />
            <button
              className="file-add"
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              <FilePlus2 size={16} />
              {nl ? "Bestanden toevoegen" : "Add documents"}
              <span>.TXT · .MD</span>
            </button>
            {documents.length ? (
              <ul className="document-list">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <FileText size={14} />
                    <span title={doc.name}>{doc.name}</span>
                    <button
                      type="button"
                      onClick={() => void removeDocument(doc)}
                      aria-label={`${nl ? "Verwijder" : "Remove"} ${doc.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="tool-empty">
                <Upload size={19} />
                <b>{nl ? "Nog geen documenten" : "No documents yet"}</b>
                <span>
                  {nl
                    ? "Voeg een .txt- of .md-bestand toe om te beginnen."
                    : "Add a .txt or .md file to get started."}
                </span>
              </div>
            )}
            <small className="tool-footnote">
              {nl
                ? "Bestanden blijven in je lokale SQLite-database. Maximaal 200 KB per bestand."
                : "Files stay in your local SQLite database. Up to 200 KB per file."}
            </small>
          </section>
          <section className="tool-card tool-prompt-card">
            <div className="tool-card-heading">
              <span className="tool-icon">
                <Sparkles size={16} />
              </span>
              <div>
                <h2>{nl ? "Stel je vraag" : "Ask your documents"}</h2>
                <p>
                  {nl
                    ? "Relevante passages worden lokaal geselecteerd."
                    : "Relevant passages are selected locally."}
                </p>
              </div>
            </div>
            <label className="tool-field-label" htmlFor="document-question">
              {nl ? "VRAAG" : "QUESTION"}
            </label>
            <textarea
              id="document-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                nl
                  ? "Wat vertellen mijn notities over…"
                  : "What do my notes say about…"
              }
            />
            <div className="tool-action-row">
              <span>
                {nl
                  ? `${documents.length} documenten beschikbaar`
                  : `${documents.length} documents available`}
              </span>
              <button
                className="tool-run"
                onClick={() => void runTool("documents")}
                disabled={
                  busy || !model || !question.trim() || !documents.length
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <WandSparkles size={15} />
                )}
                {nl ? "Vraag stellen" : "Ask question"}
              </button>
            </div>
          </section>
        </div>
      ) : (
        <section className="tool-card code-tool-card">
          <div className="tool-card-heading">
            <span className="tool-icon">
              <Braces size={16} />
            </span>
            <div>
              <h2>{nl ? "Laat code uitleggen" : "Explain a code snippet"}</h2>
              <p>
                {nl
                  ? "Plak een fragment en geef aan waar je uitleg over wilt."
                  : "Paste a snippet and say what you want to understand."}
              </p>
            </div>
          </div>
          <label className="tool-field-label" htmlFor="code-input">
            {nl ? "CODEFRAGMENT" : "CODE SNIPPET"}
          </label>
          <textarea
            id="code-input"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={'def hello(name):\n    return f"Hello, {name}!"'}
            spellCheck={false}
          />
          <label className="tool-field-label" htmlFor="code-question">
            {nl
              ? "WAAR WIL JE MEER OVER WETEN? (OPTIONEEL)"
              : "WHAT WOULD YOU LIKE TO KNOW? (OPTIONAL)"}
          </label>
          <input
            className="tool-question-input"
            id="code-question"
            value={codeQuestion}
            onChange={(e) => setCodeQuestion(e.target.value)}
            placeholder={
              nl
                ? "Bijvoorbeeld: waar kan dit misgaan?"
                : "For example: what could go wrong here?"
            }
          />
          <div className="tool-action-row">
            <span>
              {nl
                ? "Code wordt als tekst verwerkt en niet uitgevoerd."
                : "Code is treated as text and never executed."}
            </span>
            <button
              className="tool-run"
              onClick={() => void runTool("code")}
              disabled={busy || !model || !code.trim()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <WandSparkles size={15} />
              )}
              {nl ? "Code uitleggen" : "Explain code"}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="tool-error" role="alert">
          {error}
        </div>
      )}
      {answer && result && (
        <section className="tool-answer" aria-live="polite">
          <div className="tool-answer-top">
            <div>
              <span>{nl ? "ANTWOORD" : "RESPONSE"}</span>
              <b>{model}</b>
            </div>
            <span className="tool-answer-mark">
              <Sparkles size={15} />
            </span>
          </div>
          <MarkdownContent className="tool-answer-content markdown-body">
            {answer}
          </MarkdownContent>
          {result.sources?.length ? (
            <div className="answer-sources">
              <span>{nl ? "BRONNEN" : "SOURCES"}</span>
              {result.sources.map((source) => (
                <code key={source}>{source}</code>
              ))}
            </div>
          ) : null}
          <div className="tool-answer-stats">
            <span>
              {duration(result.total_duration)}{" "}
              {nl ? "generatie" : "generation"}
            </span>
            <span>
              {result.eval_count ?? "—"} {nl ? "tokens" : "tokens"}
            </span>
            {result.eval_count && result.eval_duration ? (
              <span>
                {(result.eval_count / (result.eval_duration / 1e9)).toFixed(1)}{" "}
                tok/s
              </span>
            ) : null}
          </div>
        </section>
      )}
      <div className="tools-local-note">
        <span />
        {nl
          ? "Alle verwerking gebeurt lokaal via Ollama."
          : "All inference runs locally through Ollama."}
      </div>
    </section>
  );
}
