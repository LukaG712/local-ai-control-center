import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Command,
  Cpu,
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
import MarkdownContent from "./MarkdownContent";

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
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [active, setActive] = useState<Conversation | null>(null);
  const [model, setModel] = useState("");
  const [view, setView] = useState<"chat" | "playground">("chat");
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
          aria-label="Close sidebar"
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
        <Plus size={16} /> New conversation <span>⌘ K</span>
      </button>
      <div className="side-label">WORKSPACE</div>
      <button
        className={`nav-item ${view === "chat" ? "selected" : ""}`}
        onClick={() => setView("chat")}
      >
        <MessageSquare size={15} /> Conversations{" "}
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
        <Sparkles size={15} /> Prompt Playground
      </button>
      <div className="convo-heading">
        <div className="side-label">RECENT</div>
        <span>{conversations.length}</span>
      </div>
      <label className="search-box">
        <Search size={14} />
        <input
          ref={searchInput}
          placeholder="Search conversations"
          aria-label="Search conversations"
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
                {item.model || "No model selected"}
              </span>
            </button>
            <div className="row-actions">
              {renaming === item.id ? (
                <>
                  <button
                    onClick={() => void renameConversation(item.id)}
                    title="Save"
                    aria-label={`Save ${item.title}`}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setRenaming(null)}
                    title="Cancel"
                    aria-label={`Cancel renaming ${item.title}`}
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
                    title="Rename"
                    aria-label={`Rename ${item.title}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => void deleteConversation(item)}
                    title="Delete"
                    aria-label={`Delete ${item.title}`}
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
              ? "Loading conversations…"
              : search
                ? "No matches found"
                : "Your conversations will appear here."}
          </div>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className={`engine-card ${isConnected ? "online" : ""}`}>
          <div className="engine-indicator">
            <Cpu size={15} />
          </div>
          <div>
            <strong>Ollama Engine</strong>
            <small>
              {isConnected
                ? `Connected${status?.version ? ` · v${status.version}` : ""}`
                : "Not connected"}
            </small>
          </div>
          <span className="engine-dot" />
        </div>
        <div className="profile">
          <div className="avatar">LC</div>
          <div>
            <b>Local workspace</b>
            <small>Private environment</small>
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
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <b>
                {view === "playground"
                  ? "Prompt Playground"
                  : active?.title || "New conversation"}
              </b>
            </span>
          </div>
          <div className="topbar-right">
            <span
              className={`status-pill ${isConnected ? "connected" : status ? "" : "checking"}`}
            >
              <i />
              {status
                ? isConnected
                  ? "Ollama connected"
                  : "Ollama offline"
                : "Checking Ollama"}
            </span>
          </div>
        </header>
        {view === "playground" ? (
          <Playground models={models} />
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
                      <span /> YOUR LOCAL AI WORKSPACE
                    </div>
                    <h1>
                      Think freely.
                      <br />
                      <em>Run locally.</em>
                    </h1>
                    <p className="welcome-copy">
                      A private space to explore ideas with open models
                      <br className="desktop" /> running entirely on your
                      machine.
                    </p>
                    <div className="starter-card">
                      <div className="starter-icon">
                        <Zap size={17} />
                      </div>
                      <div>
                        <b>
                          {isConnected
                            ? models.length
                              ? "Ready when you are"
                              : "Ollama is running"
                            : status
                              ? "Connect your local models"
                              : "Checking local Ollama connection…"}
                        </b>
                        <span>
                          {isConnected
                            ? models.length
                              ? "Choose a model below and start a conversation."
                              : "No models found. Pull one in Ollama to get started."
                            : "Start Ollama locally, then your workspace is ready."}
                        </span>
                        {status && !isConnected && <code>ollama serve</code>}
                      </div>
                      <Activity size={15} className="starter-activity" />
                    </div>
                    <div className="privacy-note">
                      <span className="privacy-lock">◈</span> Your prompts stay
                      on your machine
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
                            {active.model || "Assistant"}{" "}
                            <span className="model-badge">LOCAL</span>
                          </>
                        ) : (
                          "You"
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
                              {compactDuration(message.total_duration_ns)} total
                            </span>
                            <span>
                              {compactDuration(message.prompt_duration_ns)}{" "}
                              prompt
                            </span>
                            <span>{message.eval_count ?? "—"} tokens</span>
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
                      <div className="message-label">You</div>
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
                        {model || "Assistant"}{" "}
                        <span className="model-badge">LOCAL</span>
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
                      <b>Something went wrong</b>
                      <p>{error}</p>
                    </div>
                    <button
                      onClick={() => setError("")}
                      aria-label="Dismiss error"
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
                    aria-label="Message Ollama"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={keyDown}
                    placeholder={
                      isConnected
                        ? "Ask anything... your conversation stays local"
                        : "Start Ollama to begin chatting"
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
                          <span>{model || "Select a model"}</span>
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
                        <span /> LOCAL
                      </span>
                    </div>
                    <div className="composer-right">
                      <span className="send-hint">
                        ↵ to send <span>·</span> shift ↵ for newline
                      </span>
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
                          streaming ? "Stop response" : "Send message"
                        }
                      >
                        {streaming ? <X size={15} /> : <Send size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="composer-disclaimer">
                  AI responses can be inaccurate. Verify important information.
                </div>
              </div>
            </div>
            <footer className="workspace-footer">
              <span>
                <span className="footer-dot" /> All inference happens locally
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
