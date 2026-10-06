import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Command,
  Cpu,
  BookOpen,
  Braces,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  api,
  type Conversation,
  type Message,
  type Model,
  type OllamaStatus,
} from "./api/client";
import Playground from "./Playground";
import Tools from "./Tools";
import MarkdownContent from "./MarkdownContent";
import { messages, type Language, type MessageKey } from "./i18n";

function compactDuration(ns?: number) {
  if (ns == null) return "—";
  const s = ns / 1e9;
  return s >= 1 ? `${s.toFixed(2)}s` : `${Math.round(s * 1000)}ms`;
}
function speed(message: Message) {
  return message.eval_count && message.eval_duration_ns
    ? `${(message.eval_count / (message.eval_duration_ns / 1e9)).toFixed(1)} tok/s`
    : null;
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("lacc-language-v2") === "nl" ? "nl" : "en";
    } catch {
      return "en";
    }
  });
  const t = (key: MessageKey) => messages[language][key];
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [active, setActive] = useState<Conversation | null>(null);
  const [model, setModel] = useState("");
  const [view, setView] = useState<
    "chat" | "playground" | "documents" | "code"
  >("chat");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [pendingUser, setPendingUser] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelMenu, setModelMenu] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("lacc-language-v2", language);
    } catch {
      // The selected language still applies for this session.
    }
  }, [language]);

  const refresh = useCallback(async () => {
    try {
      const [s, m, c] = await Promise.allSettled([
        api.status(),
        api.models(),
        api.conversations(search),
      ]);
      setStatus(s.status === "fulfilled" ? s.value : { connected: false });
      const availableModels = m.status === "fulfilled" ? m.value : [];
      setModels(availableModels);
      if (c.status === "fulfilled") setConversations(c.value);
      setModel((current) => current || availableModels[0]?.name || "");
    } finally {
      setLoadingConversations(false);
    }
  }, [search]);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 12000);
    return () => window.clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    if (active)
      void api
        .conversation(active.id)
        .then(setActive)
        .catch(() => setActive(null));
  }, [active?.id]);
  useEffect(() => {
    function shortcuts(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setView("chat");
        void newConversation();
      }
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        searchInput.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  });

  async function selectConversation(item: Conversation) {
    setView("chat");
    setError("");
    setReply("");
    setActive(await api.conversation(item.id));
    if (item.model) setModel(item.model);
    setSidebarOpen(false);
  }
  async function newConversation() {
    setError("");
    setReply("");
    const created = await api.create(model || null);
    setActive({ ...created, messages: [] });
    setConversations((c) => [created, ...c]);
    setSidebarOpen(false);
    window.setTimeout(() => textarea.current?.focus(), 40);
  }
  async function deleteConversation(item: Conversation) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    try {
      await api.remove(item.id);
      setConversations((list) => list.filter((c) => c.id !== item.id));
      if (active?.id === item.id) setActive(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function renameConversation(id: string) {
    if (!renameText.trim()) return;
    try {
      await api.rename(id, renameText.trim());
      setRenaming(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function sendMessage() {
    const content = draft.trim();
    if (!content || !model || streaming) return;
    setError("");
    setDraft("");
    setReply("");
    setPendingUser(content);
    setStreaming(true);
    let current = active;
    try {
      if (!current) {
        current = await api.create(model);
        setActive({ ...current, messages: [] });
      }
      const controller = new AbortController();
      aborter.current = controller;
      await api.stream(
        current.id,
        model,
        content,
        (token) => setReply((text) => text + token),
        controller.signal,
      );
    } catch (e) {
      const msg = (e as Error).message;
      if (!aborter.current?.signal.aborted) setError(msg);
    } finally {
      if (current) {
        try {
          const [detail, list] = await Promise.all([
            api.conversation(current.id),
            api.conversations(search),
          ]);
          setActive(detail);
          setConversations(list);
        } catch {
          /* Keep the visible stream if a refresh races with a local disconnect. */
        }
      }
      setStreaming(false);
      aborter.current = null;
      setPendingUser("");
    }
  }
  function keyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  const isConnected = status?.connected === true;
  const sidebar = (
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="side-brand">
        <div className="brand-symbol">
          <Command size={16} />
        </div>
        <span>
          local<span className="brand-ai">ai</span>
        </span>
        <button
          className="icon-btn mobile-close"
          onClick={() => setSidebarOpen(false)}
          aria-label={t("closeSidebar")}
        >
          <X size={17} />
        </button>
      </div>
      <button
        className="new-chat"
        onClick={() => {
          setView("chat");
          void newConversation();
        }}
      >
        <Plus size={16} /> {t("newConversation")} <span>⌘ K</span>
      </button>
      <div className="side-label">{t("workspace")}</div>
      <button
        className={`nav-item ${view === "chat" ? "selected" : ""}`}
        onClick={() => setView("chat")}
      >
        <MessageSquare size={15} /> {t("conversations")}{" "}
        <span className="nav-count">{conversations.length}</span>
      </button>
      <button
        className={`nav-item playground-link ${view === "playground" ? "selected" : ""}`}
        onClick={() => {
          setError("");
          setView("playground");
          setSidebarOpen(false);
        }}
      >
        <Sparkles size={15} /> {t("promptPlayground")}
      </button>
      <button
        className={`nav-item ${view === "documents" ? "selected" : ""}`}
        onClick={() => {
          setError("");
          setView("documents");
          setSidebarOpen(false);
        }}
      >
        <BookOpen size={15} />{" "}
        {language === "nl" ? "Documentzoeker" : "Document Q&A"}
      </button>
      <button
        className={`nav-item ${view === "code" ? "selected" : ""}`}
        onClick={() => {
          setError("");
          setView("code");
          setSidebarOpen(false);
        }}
      >
        <Braces size={15} />{" "}
        {language === "nl" ? "Code-uitlegger" : "Code explainer"}
      </button>
      <div className="convo-heading">
        <div className="side-label">{t("recent")}</div>
        <span>{conversations.length}</span>
      </div>
      <label className="search-box">
        <Search size={14} />
        <input
          ref={searchInput}
          placeholder={t("searchConversations")}
          aria-label={t("searchConversations")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <div className="conversation-list">
        {conversations.map((item) => (
          <div
            key={item.id}
            className={`conversation-row ${active?.id === item.id ? "active" : ""}`}
          >
            <button
              className="conversation-select"
              onClick={() => void selectConversation(item)}
              title={item.title}
            >
              <span className="conversation-title">{item.title}</span>
              <span className="conversation-model">
                {item.model || t("noModelSelected")}
              </span>
            </button>
            <div className="row-actions">
              {renaming === item.id ? (
                <>
                  <button
                    onClick={() => void renameConversation(item.id)}
                    title={t("save")}
                    aria-label={`${t("save")} ${item.title}`}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setRenaming(null)}
                    title={t("cancel")}
                    aria-label={`${t("cancel")} ${item.title}`}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRenaming(item.id);
                      setRenameText(item.title);
                    }}
                    title={t("rename")}
                    aria-label={`${t("rename")} ${item.title}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => void deleteConversation(item)}
                    title={t("delete")}
                    aria-label={`${t("delete")} ${item.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
            {renaming === item.id && (
              <input
                className="rename-input"
                value={renameText}
                autoFocus
                aria-label={`Conversation title for ${item.title}`}
                onChange={(e) => setRenameText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void renameConversation(item.id);
                  if (e.key === "Escape") setRenaming(null);
                }}
              />
            )}
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="sidebar-empty">
            {loadingConversations
              ? t("loadingConversations")
              : search
                ? t("noMatches")
                : t("emptyConversations")}
          </div>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className={`engine-card ${isConnected ? "online" : ""}`}>
          <div className="engine-indicator">
            <Cpu size={15} />
          </div>
          <div>
            <strong>{t("ollamaEngine")}</strong>
            <small>
              {isConnected
                ? `${t("connected")}${status?.version ? ` · v${status.version}` : ""}`
                : t("notConnected")}
            </small>
          </div>
          <span className="engine-dot" />
        </div>
        <div className="profile">
          <div className="avatar">LC</div>
          <div>
            <b>{t("localWorkspace")}</b>
            <small>{t("privateEnvironment")}</small>
          </div>
          <MoreHorizontal size={16} />
        </div>
      </div>
    </aside>
  );

  return (
    <div className="app-shell">
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      {sidebar}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn menu-trigger"
              onClick={() => setSidebarOpen(true)}
              aria-label={t("openSidebar")}
            >
              <Menu size={18} />
            </button>
            <span className="breadcrumb">
              {t("breadcrumbWorkspace")} <span>/</span>{" "}
              <b>
                {view === "playground"
                  ? t("promptPlayground")
                  : view === "documents"
                    ? language === "nl"
                      ? "Documentzoeker"
                      : "Document Q&A"
                    : view === "code"
                      ? language === "nl"
                        ? "Code-uitlegger"
                        : "Code explainer"
                      : active?.title || t("newConversationTitle")}
              </b>
            </span>
          </div>
          <div className="topbar-right">
            <div
              className="language-switch"
              role="group"
              aria-label={t("language")}
            >
              <button
                type="button"
                className={language === "en" ? "selected" : ""}
                aria-pressed={language === "en"}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={language === "nl" ? "selected" : ""}
                aria-pressed={language === "nl"}
                onClick={() => setLanguage("nl")}
              >
                NL
              </button>
            </div>
            <span
              className={`status-pill ${isConnected ? "connected" : status ? "" : "checking"}`}
            >
              <i />
              {status
                ? isConnected
                  ? t("ollamaConnected")
                  : t("ollamaOffline")
                : t("checkingOllama")}
            </span>
          </div>
        </header>
        {view === "playground" ? (
          <Playground models={models} language={language} />
        ) : view === "documents" || view === "code" ? (
          <Tools
            key={view}
            initialTab={view}
            models={models}
            model={model}
            language={language}
          />
        ) : (
          <section className="workspace">
            <div className="chat-column">
              <div
                className={`chat-content ${active?.messages?.length || reply ? "has-messages" : ""}`}
              >
                {!active?.messages?.length && !reply && (
                  <div className="welcome">
                    <div className="welcome-orbit">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="welcome-mark">
                        <Sparkles size={23} />
                      </div>
                      <span className="orbit-dot dot-one" />
                      <span className="orbit-dot dot-two" />
                      <span className="orbit-dot dot-three" />
                    </div>
                    <div className="welcome-kicker">
                      <span /> {t("welcomeKicker")}
                    </div>
                    <h1>
                      {t("thinkFreely")}
                      <br />
                      <em>{t("runLocally")}</em>
                    </h1>
                    <p className="welcome-copy">{t("welcomeCopy")}</p>
                    <div className="starter-card">
                      <div className="starter-icon">
                        <Zap size={17} />
                      </div>
                      <div>
                        <b>
                          {isConnected
                            ? models.length
                              ? t("readyWhenYouAre")
                              : t("ollamaIsRunning")
                            : status
                              ? t("connectLocalModels")
                              : t("checkingConnection")}
                        </b>
                        <span>
                          {isConnected
                            ? models.length
                              ? t("chooseModelAndStart")
                              : t("noModelsFound")
                            : t("startOllama")}
                        </span>
                        {status && !isConnected && <code>ollama serve</code>}
                      </div>
                      <Activity size={15} className="starter-activity" />
                    </div>
                    <div className="privacy-note">
                      <span className="privacy-lock">◈</span>{" "}
                      {t("promptsStayLocal")}
                    </div>
                  </div>
                )}
                {active?.messages?.map((message) => (
                  <article
                    key={message.id}
                    className={`message ${message.role}`}
                  >
                    <div className="message-avatar">
                      {message.role === "assistant" ? (
                        <Sparkles size={15} />
                      ) : (
                        <span>Y</span>
                      )}
                    </div>
                    <div className="message-body">
                      <div className="message-label">
                        {message.role === "assistant" ? (
                          <>
                            {active.model || t("assistant")}{" "}
                            <span className="model-badge">{t("local")}</span>
                          </>
                        ) : (
                          t("you")
                        )}
                      </div>
                      {message.role === "assistant" ? (
                        <MarkdownContent className="message-text markdown-body">
                          {message.content}
                        </MarkdownContent>
                      ) : (
                        <div className="message-text">{message.content}</div>
                      )}
                      {message.role === "assistant" &&
                        (message.total_duration_ns || message.eval_count) && (
                          <div className="stats-row">
                            <span>
                              <Zap size={12} />
                              {compactDuration(message.total_duration_ns)}{" "}
                              {t("total")}
                            </span>
                            <span>
                              {compactDuration(message.prompt_duration_ns)}{" "}
                              {t("prompt")}
                            </span>
                            <span>
                              {message.eval_count ?? "—"} {t("tokens")}
                            </span>
                            {speed(message) && <span>{speed(message)}</span>}
                          </div>
                        )}
                    </div>
                  </article>
                ))}
                {streaming && pendingUser && (
                  <article className="message user">
                    <div className="message-avatar">
                      <span>Y</span>
                    </div>
                    <div className="message-body">
                      <div className="message-label">{t("you")}</div>
                      <div className="message-text">{pendingUser}</div>
                    </div>
                  </article>
                )}
                {streaming && (
                  <article className="message assistant">
                    <div className="message-avatar">
                      <Sparkles size={15} />
                    </div>
                    <div className="message-body">
                      <div className="message-label">
                        {model || t("assistant")}{" "}
                        <span className="model-badge">{t("local")}</span>
                      </div>
                      {reply ? (
                        <MarkdownContent className="message-text markdown-body">
                          {reply}
                        </MarkdownContent>
                      ) : (
                        <div className="message-text">
                          <span className="typing">
                            <i />
                            <i />
                            <i />
                          </span>
                        </div>
                      )}
                    </div>
                  </article>
                )}
                {error && (
                  <div className="error-banner">
                    <span>
                      <X size={14} />
                    </span>
                    <div>
                      <b>{t("somethingWentWrong")}</b>
                      <p>{error}</p>
                    </div>
                    <button
                      onClick={() => setError("")}
                      aria-label={t("dismissError")}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="composer-wrap">
                <div className="composer">
                  <textarea
                    ref={textarea}
                    aria-label={t("messageOllama")}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={keyDown}
                    placeholder={
                      isConnected ? t("askAnything") : t("startOllamaToChat")
                    }
                    disabled={!isConnected || streaming}
                    rows={1}
                    onInput={(e) => {
                      e.currentTarget.style.height = "auto";
                      e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`;
                    }}
                  />
                  <div className="composer-toolbar">
                    <div className="composer-left">
                      <div className="model-picker-wrap">
                        <button
                          className="model-picker"
                          onClick={() => setModelMenu((v) => !v)}
                          disabled={!isConnected || !models.length}
                        >
                          <span className="model-dot" />
                          <span>{model || t("selectModel")}</span>
                          <ChevronDown size={13} />
                        </button>
                        {modelMenu && (
                          <div className="model-menu">
                            {models.map((item) => (
                              <button
                                key={item.name}
                                onClick={() => {
                                  setModel(item.name);
                                  setModelMenu(false);
                                }}
                              >
                                <span className="model-dot" />
                                {item.name}
                                {model === item.name && <Check size={13} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="local-indicator">
                        <span /> {t("local")}
                      </span>
                    </div>
                    <div className="composer-right">
                      <span className="send-hint">{t("sendHint")}</span>
                      <button
                        className="send-btn"
                        onClick={() =>
                          streaming
                            ? aborter.current?.abort()
                            : void sendMessage()
                        }
                        disabled={
                          streaming
                            ? false
                            : !draft.trim() || !model || !isConnected
                        }
                        aria-label={
                          streaming ? t("stopResponse") : t("sendMessage")
                        }
                      >
                        {streaming ? <X size={15} /> : <Send size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="composer-disclaimer">
                  {t("aiMayBeInaccurate")}
                </div>
              </div>
            </div>
            <footer className="workspace-footer">
              <span>
                <span className="footer-dot" /> {t("inferenceLocal")}
              </span>
              <span>
                LOCAL AI CONTROL CENTER <b>·</b> v0.1
              </span>
            </footer>
          </section>
        )}
      </main>
    </div>
  );
}
