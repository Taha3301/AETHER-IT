"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import AIRobot, { type RobotState } from "./ai-robot";

type ChatMessage = {
  id: string;
  sender: "USER" | "AI";
  content: string;
};

type Project = {
  id: string;
};

type ApiMessage = {
  id: string;
  sender: "USER" | "AI";
  content: string;
};

type SavedChat = {
  projectId: string;
  conversationId: string;
  guestToken: string | null;
};

type JsonObject = Record<string, unknown>;

const savedChatKey = "aether.activeConversation";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<JsonObject> {
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Le service a renvoyé une réponse illisible. Réessayez.");
  }
  if (!isObject(result)) {
    throw new Error("Le service a renvoyé une réponse inattendue. Réessayez.");
  }
  return result;
}

function isProject(value: unknown): value is Project {
  return isObject(value) && typeof value.id === "string";
}

function isApiMessage(value: unknown): value is ApiMessage {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    (value.sender === "USER" || value.sender === "AI") &&
    typeof value.content === "string"
  );
}

function isSavedChat(value: unknown): value is SavedChat {
  return (
    isObject(value) &&
    typeof value.projectId === "string" &&
    typeof value.conversationId === "string" &&
    (value.guestToken === null || typeof value.guestToken === "string")
  );
}

const PROMPT_SUGGESTIONS = [
  {
    icon: "💡",
    title: "Concevoir un SaaS IA sur mesure",
    prompt:
      "Bonjour Aether, je souhaite concevoir une plateforme SaaS moderne avec intégration d’intelligence artificielle et architecture cloud évolutive.",
    desc: "Architecture cloud scalable, modèle LLM dédié et interface réactive.",
  },
  {
    icon: "⚡",
    title: "Auditer notre infrastructure Cloud",
    prompt:
      "Bonjour Aether, nous souhaitons réaliser un audit de notre infrastructure cloud pour optimiser les performances, la sécurité et réduire les coûts.",
    desc: "Audit de sécurité, conteneurisation et haute disponibilité.",
  },
  {
    icon: "📱",
    title: "Développer une application Mobile",
    prompt:
      "Bonjour Aether, nous avons un projet d'application mobile pour iOS et Android avec synchronisation temps réel et API sécurisée.",
    desc: "Expérience native fluide, offline-first et intégration d'APIs.",
  },
  {
    icon: "🤖",
    title: "Intégrer un Agent IA métier",
    prompt:
      "Bonjour Aether, nous voulons déployer un agent conversationnel IA autonome connecté à nos bases de connaissances internes.",
    desc: "Agent intelligent autonome branché sur vos données d’entreprise.",
  },
];

export default function AiHero() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [formError, setFormError] = useState("");
  const [projectReady, setProjectReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [robotState, setRobotState] = useState<RobotState>("idle");
  const [inputValue, setInputValue] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechCancelRef = useRef<(() => void) | null>(null);
  const speechTimerRef = useRef<number | null>(null);

  // Restore session
  useEffect(() => {
    async function restoreSession() {
      const accessToken = window.sessionStorage.getItem("aether.accessToken");
      setIsSignedIn(Boolean(accessToken));

      const savedChatValue = window.sessionStorage.getItem(savedChatKey);
      if (!savedChatValue) {
        setIsRestoring(false);
        return;
      }

      let savedChatJson: unknown;
      try {
        savedChatJson = JSON.parse(savedChatValue);
      } catch {
        window.sessionStorage.removeItem(savedChatKey);
        setIsRestoring(false);
        return;
      }

      if (!isSavedChat(savedChatJson)) {
        window.sessionStorage.removeItem(savedChatKey);
        setIsRestoring(false);
        return;
      }

      const token = savedChatJson.guestToken || accessToken;
      if (!token) {
        window.sessionStorage.removeItem(savedChatKey);
        setIsRestoring(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const savedChat = savedChatJson;
      if (!savedChat.conversationId) {
        setProjectReady(true);
        setRobotState("listening");
        setIsRestoring(false);
        return;
      }

      async function restoreMessages() {
        try {
          const response = await fetch(
            `/api/conversations/${encodeURIComponent(savedChat.conversationId)}/messages`,
            { headers },
          );
          if (!response.ok) {
            if (response.status === 401 || response.status === 403 || response.status === 404) {
              window.sessionStorage.removeItem(savedChatKey);
              return;
            }
            throw new Error("Les messages précédents n’ont pas pu être chargés.");
          }
          const result = await readJson(response);
          const loadedMessages = Array.isArray(result.messages)
            ? result.messages.filter(isApiMessage)
            : [];
          const chatMsgs: ChatMessage[] = loadedMessages.map(({ id, sender, content }) => ({
            id,
            sender,
            content,
          }));
          setMessages(chatMsgs);
          const dispMap: Record<string, string> = {};
          chatMsgs.forEach((m) => {
            dispMap[m.id] = m.content;
          });
          setDisplayedMessages(dispMap);
          setProjectReady(true);
          setRobotState("listening");
        } catch {
          setFormError("La conversation précédente n’a pas pu être chargée. Vous pouvez recommencer.");
        } finally {
          setIsRestoring(false);
        }
      }

      void restoreMessages();
    }

    void Promise.resolve().then(restoreSession);
  }, []);

  // Auto-scroll on new messages: scroll the chat container, NOT the window/page
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, displayedMessages, isSending]);

  // Clean speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (speechCancelRef.current) speechCancelRef.current();
      if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [inputValue]);

  // Speech synthesis runner
  function triggerSpeech(text: string) {
    if (speechCancelRef.current) {
      speechCancelRef.current();
      speechCancelRef.current = null;
    }
    if (speechTimerRef.current !== null) {
      window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }

    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setRobotState("talking");
      const duration = Math.max(3200, Math.min(9500, text.length * 52));
      speechTimerRef.current = window.setTimeout(() => {
        setRobotState("listening");
        speechTimerRef.current = null;
      }, duration);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 1.04;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find((v) => v.lang.startsWith("fr") || v.lang === "fr-FR");
      if (frenchVoice) utterance.voice = frenchVoice;

      utterance.onstart = () => {
        setRobotState("talking");
      };
      utterance.onend = () => {
        setRobotState("listening");
      };
      utterance.onerror = () => {
        setRobotState("listening");
      };

      window.speechSynthesis.speak(utterance);
      speechCancelRef.current = () => window.speechSynthesis.cancel();
    } catch {
      setRobotState("talking");
      speechTimerRef.current = window.setTimeout(() => {
        setRobotState("listening");
        speechTimerRef.current = null;
      }, 3500);
    }
  }

  // Typewriter streaming effect for AI response
  function streamAiMessage(id: string, fullContent: string) {
    setDisplayedMessages((prev) => ({ ...prev, [id]: "" }));
    let charIndex = 0;
    const chunkSize = Math.max(1, Math.floor(fullContent.length / 80));
    const timer = window.setInterval(() => {
      charIndex += chunkSize;
      if (charIndex >= fullContent.length) {
        window.clearInterval(timer);
        setDisplayedMessages((prev) => ({ ...prev, [id]: fullContent }));
      } else {
        setDisplayedMessages((prev) => ({
          ...prev,
          [id]: fullContent.slice(0, charIndex),
        }));
      }
    }, 20);
  }

  // Handle message submission
  async function sendMessage(contentToSend: string) {
    const trimmed = contentToSend.trim();
    if (!trimmed || isSending) return;

    if (!isSignedIn && !projectReady && (!guestName.trim() || !guestEmail.trim())) {
      setFormError("Pour enregistrer votre projet et débuter l'échange, veuillez indiquer votre prénom et e-mail ci-dessous.");
      return;
    }

    setFormError("");
    setIsSending(true);
    setRobotState("thinking");
    setInputValue("");

    const pendingMessageId = `pending-${Date.now()}`;
    let userMessageSaved = false;

    setMessages((current) => [
      ...current,
      { id: pendingMessageId, sender: "USER", content: trimmed },
    ]);
    setDisplayedMessages((prev) => ({ ...prev, [pendingMessageId]: trimmed }));

    try {
      const savedChatValue = window.sessionStorage.getItem(savedChatKey);
      let savedChat: SavedChat | null = null;
      if (savedChatValue) {
        try {
          const parsed: unknown = JSON.parse(savedChatValue);
          if (isSavedChat(parsed)) savedChat = parsed;
        } catch {
          window.sessionStorage.removeItem(savedChatKey);
        }
      }

      const accountToken = window.sessionStorage.getItem("aether.accessToken");
      let guestToken = savedChat?.guestToken ?? null;
      let projectId = savedChat?.projectId ?? null;
      let conversationId = savedChat?.conversationId ?? null;
      let authorizationToken = guestToken || accountToken;

      if (!projectId) {
        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authorizationToken ? { Authorization: `Bearer ${authorizationToken}` } : {}),
          },
          body: JSON.stringify({
            title: trimmed.slice(0, 200),
            description: trimmed,
            ...(!accountToken ? { guestName: guestName.trim(), guestEmail: guestEmail.trim() } : {}),
          }),
        });
        const projectResult = await readJson(projectResponse);
        if (!projectResponse.ok || !isProject(projectResult.project)) {
          throw new Error("Impossible de créer votre projet. Vérifiez vos informations et réessayez.");
        }
        projectId = projectResult.project.id;
        if (!accountToken && typeof projectResult.guestProjectToken === "string") {
          guestToken = projectResult.guestProjectToken;
          authorizationToken = guestToken;
        }
        if (!authorizationToken) {
          throw new Error("Le projet a été créé, mais son accès sécurisé n’a pas été renvoyé.");
        }

        savedChat = { projectId, conversationId: "", guestToken };
        window.sessionStorage.setItem(savedChatKey, JSON.stringify(savedChat));
      }

      if (!conversationId) {
        const conversationResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/conversations`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${authorizationToken}` },
          },
        );
        const conversationResult = await readJson(conversationResponse);
        if (
          !conversationResponse.ok ||
          !isObject(conversationResult.conversation) ||
          typeof conversationResult.conversation.id !== "string"
        ) {
          throw new Error("Votre projet est enregistré, mais la conversation n’a pas pu démarrer.");
        }
        conversationId = conversationResult.conversation.id;
        savedChat = { projectId, conversationId, guestToken };
        window.sessionStorage.setItem(savedChatKey, JSON.stringify(savedChat));
        setProjectReady(true);
      }

      if (!authorizationToken || !conversationId) {
        throw new Error("Impossible de retrouver l’accès à cette conversation. Rechargez la page.");
      }

      const messageResponse = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authorizationToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: trimmed }),
        },
      );
      const messageResult = await readJson(messageResponse);

      const returnedUserMessage = isApiMessage(messageResult.userMessage)
        ? { ...messageResult.userMessage, sender: "USER" as const }
        : null;

      if (returnedUserMessage) {
        userMessageSaved = true;
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId ? returnedUserMessage : message,
          ),
        );
        setDisplayedMessages((prev) => ({
          ...prev,
          [returnedUserMessage.id]: returnedUserMessage.content,
        }));
      }

      if (!messageResponse.ok) {
        throw new Error(
          messageResponse.status === 502 || messageResponse.status === 503
            ? "Votre message est enregistré, mais l’assistant ne peut pas répondre pour le moment. Réessayez dans un instant."
            : "Votre message n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.",
        );
      }

      if (!isApiMessage(messageResult.aiMessage)) {
        throw new Error("L’assistant n’a pas renvoyé de réponse valide. Réessayez.");
      }

      const aiMessage = messageResult.aiMessage;

      // Update messages list
      setMessages((current) => [
        ...current.filter((message) => message.id !== pendingMessageId),
        ...(returnedUserMessage ? [returnedUserMessage] : []),
        { ...aiMessage, sender: "AI" },
      ]);

      // Trigger progressive streaming text and mouth speaking animation
      streamAiMessage(aiMessage.id, aiMessage.content);
      triggerSpeech(aiMessage.content);
    } catch (error) {
      if (!userMessageSaved) {
        setMessages((current) => current.filter((message) => message.id !== pendingMessageId));
      }
      setFormError(
        error instanceof Error ? error.message : "Une erreur inattendue est survenue. Réessayez.",
      );
      setRobotState("listening");
    } finally {
      setIsSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(inputValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(inputValue);
    }
  }

  function handleCopy(id: string, text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId(null), 2000);
      });
    }
  }

  function handleResetChat() {
    window.sessionStorage.removeItem(savedChatKey);
    setMessages([]);
    setDisplayedMessages({});
    setProjectReady(false);
    setFormError("");
    setRobotState("idle");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <section
      aria-label="Interface conversationnelle Aether IT"
      className={`ai-hero chatgpt-mode${hasMessages ? " chatgpt-has-messages" : ""}${isSending ? " ai-hero-thinking" : ""}`}
      id="approche"
    >
      {/* Background ambient lighting */}
      <div aria-hidden="true" className="scene-glow scene-glow-one" />
      <div aria-hidden="true" className="scene-glow scene-glow-two" />
      <div aria-hidden="true" className="scene-grid" />
      <div aria-hidden="true" className="scene-stars">
        {Array.from({ length: 24 }, (_, index) => (
          <span className={`scene-star scene-star-${index % 6}`} key={index} />
        ))}
      </div>

      {/* ChatGPT Workspace */}
      <div className="chatgpt-workspace">
        {/* Top Minimalist Header */}
        <header className="chatgpt-topbar">
          <div className="chatgpt-model-badge">
            <span className="model-dot" />
            <span className="model-name">Aether 4.0 Omni</span>
            <span className="model-tag">Assistant IT</span>
          </div>

          <div className="chatgpt-top-actions">
            <button
              aria-label={voiceEnabled ? "Désactiver la voix IA" : "Activer la voix IA"}
              className={`chatgpt-icon-btn${voiceEnabled ? " active" : ""}`}
              onClick={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              title={voiceEnabled ? "Voix IA activée" : "Voix IA désactivée"}
              type="button"
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                {voiceEnabled ? (
                  <path
                    d="M11 5L6 9H2v6h4l5 4V5zm4.5 3c.8 1 1.5 2.4 1.5 4s-.7 3-1.5 4m3-10.5C19.8 7 21 9.3 21 12s-1.2 5-2.5 6.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                ) : (
                  <path
                    d="M11 5L6 9H2v6h4l5 4V5zm12 4l-6 6m0-6l6 6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                )}
              </svg>
              <span className="btn-label">{voiceEnabled ? "Voix ON" : "Voix OFF"}</span>
            </button>

            {hasMessages && (
              <button
                aria-label="Nouvelle conversation"
                className="chatgpt-icon-btn"
                onClick={handleResetChat}
                title="Nouvelle conversation"
                type="button"
              >
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M4 12a8 8 0 0 1 14.9-4M20 12a8 8 0 0 1-14.9 4M4 4v4h4m12 12v-4h-4"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
                <span className="btn-label">Nouveau chat</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Conversation Canvas */}
        <div className="chatgpt-main-container" ref={scrollContainerRef}>
          {/* Welcome Screen (When no messages yet) */}
          {!hasMessages ? (
            <div className="chatgpt-welcome-hero">
              {/* Central 3D Robot Presentation */}
              <div className="chatgpt-robot-hero-pod">
                <div className="pod-halo" />
                <div className="portal-floor" />
                <AIRobot started={true} state={robotState} />
                <div className="robot-nameplate">
                  <span className="nameplate-mark">a</span>
                  <span className="nameplate-copy">
                    <strong>AETHER</strong>
                    <span>COMPAGNON INTELLIGENT</span>
                  </span>
                  <span className={`nameplate-status${robotState === "talking" ? " speaking" : ""}`} />
                </div>
              </div>

              <div className="welcome-titles">
                <span className="welcome-kicker">✦ VOTRE PARTENAIRE D’INGÉNIERIE NUMÉRIQUE</span>
                <h1>Parlez-moi de votre vision.</h1>
                <p>
                  Partagez votre idée, une intuition ou un besoin technique. Explorons-le ensemble
                  et façonnons la solution idéale étape par étape.
                </p>
              </div>

              {/* Prompt Suggestion Cards */}
              <div className="chatgpt-suggestions-grid">
                {PROMPT_SUGGESTIONS.map((item, index) => (
                  <button
                    className="chatgpt-suggestion-card"
                    key={index}
                    onClick={() => void sendMessage(item.prompt)}
                    type="button"
                  >
                    <div className="suggestion-header">
                      <span className="suggestion-icon">{item.icon}</span>
                      <strong className="suggestion-title">{item.title}</strong>
                    </div>
                    <p className="suggestion-desc">{item.desc}</p>
                    <span className="suggestion-arrow">
                      <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                        <path
                          d="M4 10h12m-5-5 5 5-5 5"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Conversation View with Companion Pod */
            <div className="chatgpt-active-thread-layout">
              {/* Persistent 3D Robot Floating Companion */}
              <aside className="chatgpt-companion-aside">
                <div className="companion-stage-card">
                  <div className="companion-status-row">
                    <span className="companion-dot" data-state={robotState} />
                    <span className="companion-state-text">
                      {robotState === "talking"
                        ? "Aether vous répond..."
                        : robotState === "thinking"
                          ? "En réflexion..."
                          : "À votre écoute"}
                    </span>
                    {robotState === "talking" && (
                      <span className="voice-wave-mini">
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>
                  <div className="companion-robot-viewport">
                    <AIRobot started={true} state={robotState} />
                  </div>
                  <div className="companion-meta">
                    <strong>Aether AI</strong>
                    <span>Architecture & Code</span>
                  </div>
                </div>
              </aside>

              {/* Messages Thread */}
              <div className="chatgpt-messages-stream">
                {messages.map((message) => {
                  const isUser = message.sender === "USER";
                  const text = displayedMessages[message.id] ?? message.content;

                  return (
                    <article
                      className={`chatgpt-message-row${isUser ? " user-row" : " ai-row"}`}
                      key={message.id}
                    >
                      {!isUser && (
                        <div className="message-avatar-wrap">
                          <span aria-hidden="true" className="message-avatar">
                            <Image
                              alt="Aether IT Logo"
                              className="message-avatar-img"
                              height={22}
                              src="/images/aetherit-logo.png"
                              width={22}
                            />
                          </span>
                        </div>
                      )}

                      <div className="message-bubble-wrap">
                        <div className="message-header">
                          <span className="message-author">
                            {isUser ? "Vous" : "Aether IT"}
                          </span>
                        </div>
                        <div className="message-text">
                          <p>{text}</p>
                        </div>

                        {!isUser && (
                          <div className="message-actions-bar">
                            <button
                              aria-label="Copier le texte"
                              className="msg-action-btn"
                              onClick={() => handleCopy(message.id, message.content)}
                              type="button"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                                    <path
                                      d="M5 10l3.5 3.5L15 6"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="1.8"
                                    />
                                  </svg>
                                  <span>Copié !</span>
                                </>
                              ) : (
                                <>
                                  <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                                    <rect
                                      height="11"
                                      rx="2"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      width="11"
                                      x="6"
                                      y="6"
                                    />
                                    <path
                                      d="M4 14V4a1 1 0 0 1 1-1h10"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeWidth="1.5"
                                    />
                                  </svg>
                                  <span>Copier</span>
                                </>
                              )}
                            </button>

                            <button
                              aria-label="Écouter la réponse"
                              className="msg-action-btn"
                              onClick={() => triggerSpeech(message.content)}
                              type="button"
                            >
                              <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                                <path
                                  d="M9 4L5 7H2v6h3l4 3V4zm4 4a3 3 0 0 1 0 4"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.5"
                                />
                              </svg>
                              <span>Écouter</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}

                {/* Shimmer Thinking Indicator */}
                {isSending && (
                  <article className="chatgpt-message-row ai-row thinking-row">
                    <div className="message-avatar-wrap">
                      <span aria-hidden="true" className="message-avatar pulse-avatar">
                        <Image
                          alt="Aether IT Logo"
                          className="message-avatar-img"
                          height={22}
                          src="/images/aetherit-logo.png"
                          width={22}
                        />
                      </span>
                    </div>
                    <div className="message-bubble-wrap">
                      <div className="message-header">
                        <span className="message-author">Aether IT</span>
                      </div>
                      <div className="thinking-bubble">
                        <span className="thinking-text">Aether réfléchit à votre projet</span>
                        <span className="typing-dots">
                          <span />
                          <span />
                          <span />
                        </span>
                      </div>
                    </div>
                  </article>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Floating Bottom Pill Composer (ChatGPT Style) */}
        <div className="chatgpt-composer-dock">
          {/* Guest registration inline badge */}
          {!projectReady && !isSignedIn && (
            <div className="guest-info-strip">
              <span className="guest-strip-label">
                <span className="strip-sparkle">✦</span> Pour enregistrer votre projet et débuter l’échange :
              </span>
              <div className="guest-strip-inputs">
                <input
                  autoComplete="given-name"
                  maxLength={100}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Votre prénom"
                  required
                  type="text"
                  value={guestName}
                />
                <input
                  autoComplete="email"
                  maxLength={254}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Votre adresse e-mail"
                  required
                  type="email"
                  value={guestEmail}
                />
              </div>
            </div>
          )}

          {formError && (
            <div className="chatgpt-composer-error" role="alert">
              <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v5m0 3h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
              <span>{formError}</span>
            </div>
          )}

          <form className="chatgpt-pill-composer" onSubmit={handleSubmit}>
            <textarea
              autoComplete="off"
              disabled={isSending || isRestoring}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Envoyez un message à Aether IT… (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)"
              ref={textareaRef}
              rows={1}
              value={inputValue}
            />

            <div className="composer-action-group">
              <button
                aria-label="Envoyer votre message"
                className={`chatgpt-send-button${inputValue.trim().length > 0 && !isSending ? " can-send" : ""}`}
                disabled={!inputValue.trim() || isSending || isRestoring}
                type="submit"
              >
                {isSending ? (
                  <span className="send-spinner" />
                ) : (
                  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M12 19V5m0 0l-7 7m7-7l7 7"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.4"
                    />
                  </svg>
                )}
              </button>
            </div>
          </form>

          <footer className="chatgpt-disclaimer">
            <span>Aether IT peut faire des erreurs. Vos données et projets restent strictement confidentiels.</span>
          </footer>
        </div>
      </div>
    </section>
  );
}
