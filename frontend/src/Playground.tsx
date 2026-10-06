import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Cpu,
  Gauge,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { api, type Model } from "./api/client";
import MarkdownContent from "./MarkdownContent";

type Result = {
  model: string;
  response?: string;
  error?: string;
  total_duration?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};
function time(ns?: number) {
  if (ns == null) return "—";
  return ns >= 1e9 ? `${(ns / 1e9).toFixed(2)}s` : `${Math.round(ns / 1e6)}ms`;
}
function rate(r: Result) {
  return r.eval_count && r.eval_duration
    ? `${(r.eval_count / (r.eval_duration / 1e9)).toFixed(1)} tok/s`
    : "—";
}

export default function Playground({ models }: { models: Model[] }) {
  const [prompt, setPrompt] = useState(
    "Write a short, friendly explanation of why keeping AI local can be useful.",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  function toggle(name: string) {
    setSelected((list) =>
      list.includes(name)
        ? list.filter((item) => item !== name)
        : list.length < 4
          ? [...list, name]
          : list,
    );
  }
  async function compare() {
    setError("");
    setResults([]);
    setLoading(true);
    try {
      const result = await api.compare(prompt, selected);
      setResults(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="playground-page">
      <div className="playground-header">
        <div>
          <div className="play-kicker">
            <Sparkles size={13} /> PROMPT PLAYGROUND{" "}
            <span>LOCAL MODEL BENCH</span>
          </div>
          <h1>
            One prompt.
            <br />
            <em>Different perspectives.</em>
          </h1>
          <p>
            Run the same prompt across your local models and compare their
            responses side by side.
          </p>
        </div>
        <div className="play-orb">
          <Cpu size={21} />
          <span />
        </div>
      </div>
      <div className="playground-controls">
        <section className="control-card">
          <div className="control-heading">
            <span className="step-number">01</span>
            <div>
              <b>Choose models</b>
              <small>Select two to four installed models to compare</small>
            </div>
            <span className="selected-count">{selected.length} / 4</span>
          </div>
          <div className="model-options">
            {models.map((item) => (
              <button
                key={item.name}
                className={`model-option ${selected.includes(item.name) ? "picked" : ""}`}
                aria-pressed={selected.includes(item.name)}
                onClick={() => toggle(item.name)}
              >
                <span className="checkbox">
                  {selected.includes(item.name) && <Check size={12} />}
                </span>
                <span className="option-copy">
                  <b>{item.name}</b>
                  <small>
                    {item.details?.parameter_size || "Local model"}
                    {item.details?.quantization_level
                      ? ` · ${item.details.quantization_level}`
                      : ""}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {!models.length && (
              <div className="no-models">
                No local models available. Start Ollama and install a model
                first.
              </div>
            )}
          </div>
        </section>
        <section className="control-card prompt-card">
          <div className="control-heading">
            <span className="step-number">02</span>
            <div>
              <b>Your prompt</b>
              <small>Every model receives exactly the same input</small>
            </div>
            <span className="prompt-private">
              <span /> PRIVATE
            </span>
          </div>
          <textarea
            value={prompt}
            aria-label="Prompt to compare across models"
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={20_000}
            placeholder="Write the prompt you want to compare..."
          />
          <div className="prompt-bottom">
            <span>{prompt.length.toLocaleString()} / 20,000</span>
            <button
              className="compare-btn"
              disabled={selected.length < 2 || !prompt.trim() || loading}
              onClick={() => void compare()}
            >
              {loading ? (
                <>
                  <span className="button-spinner" /> Running models
                </>
              ) : (
                <>
                  <Zap size={14} /> Compare responses
                </>
              )}
            </button>
          </div>
        </section>
      </div>
      {error && <div className="play-error">{error}</div>}
      {results.length > 0 ? (
        <section className="results-section">
          <div className="results-title">
            <div>
              <span className="play-kicker">
                RESULTS <span>·</span> {results.length} MODELS
              </span>
              <h2>Response comparison</h2>
            </div>
            <button className="rerun-btn" onClick={() => void compare()}>
              <RotateCcw size={13} /> Run again
            </button>
          </div>
          <div className="result-grid">
            {results.map((result) => (
              <article key={result.model} className="result-card">
                <header>
                  <div className="result-model-icon">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <b>{result.model}</b>
                    <small>LOCAL MODEL</small>
                  </div>
                  <span
                    className={result.error ? "result-failed" : "result-done"}
                  >
                    {result.error ? "FAILED" : "COMPLETE"}
                  </span>
                </header>
                {result.error ? (
                  <div className="result-error">{result.error}</div>
                ) : (
                  <>
                    {result.response ? (
                      <MarkdownContent className="result-response markdown-body">
                        {result.response}
                      </MarkdownContent>
                    ) : (
                      <div className="result-response">
                        <span className="result-empty">
                          No response text returned.
                        </span>
                      </div>
                    )}
                    <div className="result-stats">
                      <div>
                        <Clock3 size={13} />
                        <span>
                          <small>GENERATION</small>
                          <b>{time(result.total_duration)}</b>
                        </span>
                      </div>
                      <div>
                        <Cpu size={13} />
                        <span>
                          <small>PROMPT</small>
                          <b>{time(result.prompt_eval_duration)}</b>
                        </span>
                      </div>
                      <div>
                        <Gauge size={13} />
                        <span>
                          <small>THROUGHPUT</small>
                          <b>{rate(result)}</b>
                        </span>
                      </div>
                    </div>
                    <div className="result-token-count">
                      {result.eval_count ?? "—"} tokens generated
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="playground-footnote">
          <span>◈</span> Responses stay local. Only installed Ollama models are
          available for comparison.
        </div>
      )}
    </div>
  );
}
