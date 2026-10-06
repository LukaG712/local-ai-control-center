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
import { messages, type Language, type MessageKey } from "./i18n";

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

export default function Playground({
  models,
  language,
}: {
  models: Model[];
  language: Language;
}) {
  const t = (key: MessageKey) => messages[language][key];
  const [prompt, setPrompt] = useState(
    language === "nl"
      ? "Leg kort en vriendelijk uit waarom lokale AI handig kan zijn."
      : "Write a short, friendly explanation of why keeping AI local can be useful.",
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
            <Sparkles size={13} /> {t("playgroundKicker")}{" "}
            <span>{t("localModelBench")}</span>
          </div>
          <h1>
            {t("onePrompt")}
            <br />
            <em>{t("differentPerspectives")}</em>
          </h1>
          <p>{t("compareDescription")}</p>
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
              <b>{t("chooseModels")}</b>
              <small>{t("chooseModelsHelp")}</small>
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
                    {item.details?.parameter_size || t("localModel")}
                    {item.details?.quantization_level
                      ? ` · ${item.details.quantization_level}`
                      : ""}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {!models.length && (
              <div className="no-models">{t("noLocalModels")}</div>
            )}
          </div>
        </section>
        <section className="control-card prompt-card">
          <div className="control-heading">
            <span className="step-number">02</span>
            <div>
              <b>{t("yourPrompt")}</b>
              <small>{t("samePromptHelp")}</small>
            </div>
            <span className="prompt-private">
              <span /> {t("private")}
            </span>
          </div>
          <textarea
            value={prompt}
            aria-label={t("comparePromptLabel")}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={20_000}
            placeholder={t("promptPlaceholder")}
          />
          <div className="prompt-bottom">
            <span>
              {prompt.length.toLocaleString(
                language === "nl" ? "nl-NL" : "en-US",
              )}{" "}
              / 20,000
            </span>
            <button
              className="compare-btn"
              disabled={selected.length < 2 || !prompt.trim() || loading}
              onClick={() => void compare()}
            >
              {loading ? (
                <>
                  <span className="button-spinner" /> {t("runningModels")}
                </>
              ) : (
                <>
                  <Zap size={14} /> {t("compareResponses")}
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
                {t("results")} <span>·</span> {results.length} {t("models")}
              </span>
              <h2>{t("responseComparison")}</h2>
            </div>
            <button className="rerun-btn" onClick={() => void compare()}>
              <RotateCcw size={13} /> {t("runAgain")}
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
                    <small>{t("localModelBench")}</small>
                  </div>
                  <span
                    className={result.error ? "result-failed" : "result-done"}
                  >
                    {result.error ? t("failed") : t("complete")}
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
                          {t("noResponseText")}
                        </span>
                      </div>
                    )}
                    <div className="result-stats">
                      <div>
                        <Clock3 size={13} />
                        <span>
                          <small>{t("generation")}</small>
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
                          <small>{t("throughput")}</small>
                          <b>{rate(result)}</b>
                        </span>
                      </div>
                    </div>
                    <div className="result-token-count">
                      {result.eval_count ?? "—"} {t("tokensGenerated")}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="playground-footnote">
          <span>◈</span> {t("responsesStayLocal")}
        </div>
      )}
    </div>
  );
}
