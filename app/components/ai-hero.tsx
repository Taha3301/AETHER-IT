"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import AIRobot, { type RobotState } from "./ai-robot";
import {
  cleanSpeechText,
  replacePendingWithReply,
  type ChatLanguage,
} from "@/lib/chat-text";

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
  finished?: boolean;
};

type ProjectAnalysis = {
  summary: string;
  problem: string;
  solution: string;
  targetAudience: string;
  targetMarket: string;
  businessModel: string;
  valueProposition: string;
  features: string;
  competitors: string;
  technology: string;
  marketingStrategy: string;
  roadmap: string;
  risks: string;
};

const analysisFieldOrder: Array<keyof ProjectAnalysis> = [
  "problem",
  "solution",
  "targetAudience",
  "targetMarket",
  "businessModel",
  "valueProposition",
  "features",
  "competitors",
  "technology",
  "marketingStrategy",
  "roadmap",
  "risks",
];

type JsonObject = Record<string, unknown>;

const savedChatKey = "aether.activeConversation";
const languageStorageKey = "aether.chatLanguage";

const interfaceText: Record<
  ChatLanguage,
  {
    modelTag: string;
    language: string;
    voiceEnabled: string;
    voiceDisabled: string;
    enableVoice: string;
    disableVoice: string;
    newChat: string;
    newChatLabel: string;
    welcomeKicker: string;
    welcomeTitle: string;
    welcomeDescription: string;
    suggestions: Array<{ icon: string; title: string; prompt: string; desc: string }>;
    readyPromptsLabel: string;
    readyPromptsHint: string;
    readyPrompts: Array<{ label: string; prompt: string }>;
    robotTitle: string;
    robotSubtitle: string;
    speaking: string;
    thinking: string;
    listening: string;
    copy: string;
    copyLabel: string;
    copied: string;
    listen: string;
    thinkingMessage: string;
    guestDetails: string;
    firstName: string;
    email: string;
    sendPlaceholder: string;
    send: string;
    disclaimer: string;
    restoreError: string;
    guestRequired: string;
    createProjectError: string;
    projectAccessError: string;
    conversationError: string;
    messageError: string;
    messageSavedAiError: string;
    messageSendError: string;
    previousMessagesError: string;
    invalidReply: string;
    genericError: string;
    finishConversation: string;
    finishingConversation: string;
    finishSuccess: string;
    finishError: string;
    finishUnavailable: string;
    analysisTitle: string;
    analysisSummary: string;
    analysisDetails: string;
    analysisLabels: Record<keyof ProjectAnalysis, string>;
    unreadableResponse: string;
    unexpectedResponse: string;
    selectLanguage: string;
  }
> = {
  fr: {
    modelTag: "Assistant IT",
    language: "Langue",
    voiceEnabled: "Voix activée",
    voiceDisabled: "Voix désactivée",
    enableVoice: "Activer la voix IA",
    disableVoice: "Désactiver la voix IA",
    newChat: "Nouvelle conversation",
    newChatLabel: "Nouveau chat",
    welcomeKicker: "VOTRE PARTENAIRE D’INGÉNIERIE NUMÉRIQUE",
    welcomeTitle: "Parlez-moi de votre vision.",
    welcomeDescription:
      "Partagez votre idée, une intuition ou un besoin technique. Explorons-le ensemble et façonnons la solution idéale étape par étape.",
    suggestions: [
      {
        icon: "💡",
        title: "Concevoir un SaaS IA sur mesure",
        prompt:
          "Bonjour Aether, je souhaite concevoir une plateforme SaaS moderne avec intégration d’intelligence artificielle et architecture cloud évolutive.",
        desc: "Architecture cloud évolutive, modèle LLM dédié et interface réactive.",
      },
      {
        icon: "⚡",
        title: "Auditer notre infrastructure cloud",
        prompt:
          "Bonjour Aether, nous souhaitons réaliser un audit de notre infrastructure cloud pour optimiser les performances, la sécurité et réduire les coûts.",
        desc: "Audit de sécurité, conteneurisation et haute disponibilité.",
      },
      {
        icon: "📱",
        title: "Développer une application mobile",
        prompt:
          "Bonjour Aether, nous avons un projet d'application mobile pour iOS et Android avec synchronisation en temps réel et API sécurisée.",
        desc: "Expérience fluide, fonctionnement hors ligne et intégration d’API.",
      },
      {
        icon: "🤖",
        title: "Intégrer un agent IA métier",
        prompt:
          "Bonjour Aether, nous voulons déployer un agent conversationnel IA autonome connecté à nos bases de connaissances internes.",
        desc: "Agent intelligent connecté à vos données d’entreprise.",
      },
    ],
    readyPromptsLabel: "Besoin d’aide pour formuler votre message ?",
    readyPromptsHint: "Choisissez un modèle, complétez les éléments entre crochets, puis envoyez-le.",
    readyPrompts: [
      {
        label: "Décrire mon idée",
        prompt:
          "Je souhaite créer [type d’application ou de service] pour [public visé]. L’objectif principal est de [objectif].",
      },
      {
        label: "Expliquer le problème à résoudre",
        prompt:
          "Le problème que je souhaite résoudre est [problème]. Aujourd’hui, [expliquez comment les personnes concernées font face à ce problème].",
      },
      {
        label: "Présenter les futurs utilisateurs",
        prompt:
          "Les personnes qui utiliseront mon projet sont [public visé]. Elles ont surtout besoin de [besoin principal].",
      },
      {
        label: "Lister les fonctionnalités",
        prompt:
          "Voici les fonctionnalités que j’imagine : [fonctionnalités]. Aidez-moi à identifier et prioriser les plus importantes.",
      },
      {
        label: "Préciser mon budget et mes délais",
        prompt:
          "Je souhaite lancer ce projet vers [date ou délai] et mon budget approximatif est de [budget]. Quelles options seraient réalistes ?",
      },
      {
        label: "Être guidé pas à pas",
        prompt:
          "Je n’ai pas encore tous les détails de mon projet. Aidez-moi à clarifier mon idée en me posant des questions simples, une à la fois.",
      },
      {
        label: "Posez-moi les questions utiles",
        prompt:
          "Posez-moi toutes les questions nécessaires pour bien comprendre mon idée et mes besoins. Je vous répondrai au fur et à mesure. Commencez par la question la plus importante et posez-les une par une.",
      },
    ],
    robotTitle: "COMPAGNON INTELLIGENT",
    robotSubtitle: "Architecture et développement",
    speaking: "Aether vous répond…",
    thinking: "Réflexion en cours…",
    listening: "À votre écoute",
    copy: "Copier",
    copyLabel: "Copier le texte",
    copied: "Copié !",
    listen: "Écouter",
    thinkingMessage: "Aether réfléchit à votre projet",
    guestDetails: "Pour enregistrer votre projet et débuter l’échange :",
    firstName: "Votre prénom",
    email: "Votre adresse e-mail",
    sendPlaceholder:
      "Envoyez un message à Aether IT… (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)",
    send: "Envoyer votre message",
    disclaimer: "Aether IT peut faire des erreurs. Vos données et projets restent strictement confidentiels.",
    restoreError: "La conversation précédente n’a pas pu être chargée. Vous pouvez recommencer.",
    guestRequired: "Pour enregistrer votre projet, veuillez indiquer votre prénom et votre adresse e-mail.",
    createProjectError: "Impossible de créer votre projet. Vérifiez vos informations et réessayez.",
    projectAccessError: "Le projet a été créé, mais son accès sécurisé n’a pas été renvoyé.",
    conversationError: "Votre projet est enregistré, mais la conversation n’a pas pu démarrer.",
    messageError: "Impossible de retrouver l’accès à cette conversation. Rechargez la page.",
    messageSavedAiError:
      "Votre message est enregistré, mais l’assistant ne peut pas répondre pour le moment. Réessayez dans un instant.",
    messageSendError: "Votre message n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.",
    previousMessagesError: "Les messages précédents n’ont pas pu être chargés.",
    invalidReply: "L’assistant n’a pas renvoyé de réponse valide. Réessayez.",
    genericError: "Une erreur est survenue. Veuillez réessayer.",
    finishConversation: "Terminer la conversation et créer l’analyse",
    finishingConversation: "Création de l’analyse…",
    finishSuccess: "Votre analyse de projet est prête.",
    finishError: "Impossible de terminer la conversation et de créer l’analyse. Réessayez.",
    finishUnavailable: "La conversation n’a pas pu être retrouvée. Rechargez la page.",
    analysisTitle: "Analyse de votre projet",
    analysisSummary: "Résumé",
    analysisDetails: "Consulter l’analyse complète",
    analysisLabels: {
      summary: "Résumé",
      problem: "Problématique",
      solution: "Solution proposée",
      targetAudience: "Public cible",
      targetMarket: "Marché cible",
      businessModel: "Modèle économique",
      valueProposition: "Proposition de valeur",
      features: "Fonctionnalités",
      competitors: "Concurrence",
      technology: "Technologies",
      marketingStrategy: "Stratégie marketing",
      roadmap: "Feuille de route",
      risks: "Risques",
    },
    unreadableResponse: "Le service a renvoyé une réponse illisible. Réessayez.",
    unexpectedResponse: "Le service a renvoyé une réponse inattendue. Réessayez.",
    selectLanguage: "Choisir la langue de l’interface et des réponses de l’assistant",
  },
  en: {
    modelTag: "IT Assistant",
    language: "Language",
    voiceEnabled: "Voice on",
    voiceDisabled: "Voice off",
    enableVoice: "Enable AI voice",
    disableVoice: "Disable AI voice",
    newChat: "New conversation",
    newChatLabel: "New chat",
    welcomeKicker: "YOUR DIGITAL ENGINEERING PARTNER",
    welcomeTitle: "Tell me about your vision.",
    welcomeDescription:
      "Share an idea, an intuition, or a technical need. Let’s explore it together and shape the right solution step by step.",
    suggestions: [
      {
        icon: "💡",
        title: "Design a custom AI SaaS",
        prompt:
          "Hello Aether, I would like to design a modern SaaS platform with artificial intelligence integration and a scalable cloud architecture.",
        desc: "Scalable cloud architecture, a dedicated LLM, and a responsive interface.",
      },
      {
        icon: "⚡",
        title: "Audit our cloud infrastructure",
        prompt:
          "Hello Aether, we would like to audit our cloud infrastructure to improve performance and security while reducing costs.",
        desc: "Security audit, containerization, and high availability.",
      },
      {
        icon: "📱",
        title: "Build a mobile application",
        prompt:
          "Hello Aether, we are planning an iOS and Android mobile app with real-time synchronization and a secure API.",
        desc: "Smooth experience, offline support, and API integration.",
      },
      {
        icon: "🤖",
        title: "Integrate a business AI agent",
        prompt:
          "Hello Aether, we want to deploy an autonomous conversational AI agent connected to our internal knowledge bases.",
        desc: "An intelligent agent connected to your business data.",
      },
    ],
    readyPromptsLabel: "Not sure what to say?",
    readyPromptsHint: "Choose a template, fill in the brackets, then send your message.",
    readyPrompts: [
      {
        label: "Describe my idea",
        prompt:
          "I want to create a [type of app or service] for [target users]. Its main goal is to [goal].",
      },
      {
        label: "Explain the problem to solve",
        prompt:
          "The problem I want to solve is [problem]. Right now, [explain how the people affected deal with it].",
      },
      {
        label: "Describe the intended users",
        prompt:
          "The people who will use my project are [target users]. Their main need is [main need].",
      },
      {
        label: "List possible features",
        prompt:
          "Here are the features I have in mind: [features]. Help me identify and prioritize the most important ones.",
      },
      {
        label: "Share my budget and timeline",
        prompt:
          "I would like to launch this project around [date or timeline], and my approximate budget is [budget]. What would be realistic?",
      },
      {
        label: "Guide me step by step",
        prompt:
          "I do not have all the details of my project yet. Help me clarify the idea by asking simple questions, one at a time.",
      },
      {
        label: "Ask me what you need to know",
        prompt:
          "Ask me anything you need to understand my idea and requirements. I will answer as we go. Start with the most important question and ask them one at a time.",
      },
    ],
    robotTitle: "INTELLIGENT COMPANION",
    robotSubtitle: "Architecture and development",
    speaking: "Aether is responding…",
    thinking: "Thinking…",
    listening: "Ready to listen",
    copy: "Copy",
    copyLabel: "Copy text",
    copied: "Copied!",
    listen: "Listen",
    thinkingMessage: "Aether is thinking about your project",
    guestDetails: "Enter your details to save your project and start chatting:",
    firstName: "Your first name",
    email: "Your email address",
    sendPlaceholder:
      "Send a message to Aether IT… (Enter to send, Shift+Enter for a new line)",
    send: "Send your message",
    disclaimer: "Aether IT can make mistakes. Your data and projects remain strictly confidential.",
    restoreError: "The previous conversation could not be loaded. You can start a new one.",
    guestRequired: "Enter your first name and email address to save your project.",
    createProjectError: "Could not create your project. Check your details and try again.",
    projectAccessError: "The project was created, but secure access details were not returned.",
    conversationError: "Your project was saved, but the conversation could not be started.",
    messageError: "Could not restore access to this conversation. Reload the page.",
    messageSavedAiError:
      "Your message was saved, but the assistant cannot reply right now. Please try again shortly.",
    messageSendError: "Your message could not be sent. Check your connection and try again.",
    previousMessagesError: "Previous messages could not be loaded.",
    invalidReply: "The assistant did not return a valid response. Please try again.",
    genericError: "Something went wrong. Please try again.",
    finishConversation: "End conversation and create analysis",
    finishingConversation: "Creating your analysis…",
    finishSuccess: "Your project analysis is ready.",
    finishError: "Could not finish the conversation and create the analysis. Please try again.",
    finishUnavailable: "Could not find the conversation. Reload the page.",
    analysisTitle: "Your project analysis",
    analysisSummary: "Summary",
    analysisDetails: "View full analysis",
    analysisLabels: {
      summary: "Summary",
      problem: "Problem",
      solution: "Proposed solution",
      targetAudience: "Target audience",
      targetMarket: "Target market",
      businessModel: "Business model",
      valueProposition: "Value proposition",
      features: "Features",
      competitors: "Competitors",
      technology: "Technology",
      marketingStrategy: "Marketing strategy",
      roadmap: "Roadmap",
      risks: "Risks",
    },
    unreadableResponse: "The service returned an unreadable response. Please try again.",
    unexpectedResponse: "The service returned an unexpected response. Please try again.",
    selectLanguage: "Choose the language for the interface and assistant replies",
  },
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

async function readJson(
  response: Response,
  language: ChatLanguage = "fr",
): Promise<JsonObject> {
  const text = interfaceText[language];
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(text.unreadableResponse);
  }
  if (!isObject(result)) {
    throw new Error(text.unexpectedResponse);
  }
  return result;
}

function isProject(value: unknown): value is Project {
  return isObject(value) && typeof value.id === "string";
}

function isProjectAnalysis(value: unknown): value is ProjectAnalysis {
  const fields: Array<keyof ProjectAnalysis> = [
    "summary",
    "problem",
    "solution",
    "targetAudience",
    "targetMarket",
    "businessModel",
    "valueProposition",
    "features",
    "competitors",
    "technology",
    "marketingStrategy",
    "roadmap",
    "risks",
  ];
  return isObject(value) && fields.every((field) => typeof value[field] === "string");
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
    (value.guestToken === null || typeof value.guestToken === "string") &&
    (value.finished === undefined || typeof value.finished === "boolean")
  );
}

export default function AiHero() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [conversationFinished, setConversationFinished] = useState(false);
  const [projectAnalysis, setProjectAnalysis] = useState<ProjectAnalysis | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [formError, setFormError] = useState("");
  const [projectReady, setProjectReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [robotState, setRobotState] = useState<RobotState>("idle");
  const [inputValue, setInputValue] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [language, setLanguage] = useState<ChatLanguage>("fr");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingMessageSequenceRef = useRef(0);
  const speechCancelRef = useRef<(() => void) | null>(null);
  const speechTimerRef = useRef<number | null>(null);
  const ui = interfaceText[language];

  // Restore session
  useEffect(() => {
    async function restoreSession() {
      const savedLanguage = window.localStorage.getItem(languageStorageKey);
      const selectedLanguage: ChatLanguage = savedLanguage === "en" ? "en" : "fr";
      setLanguage(selectedLanguage);
      window.document.documentElement.lang = selectedLanguage;
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
      setConversationFinished(savedChat.finished === true);
      if (!savedChat.conversationId) {
        setProjectReady(true);
        setRobotState("listening");
        if (savedChat.finished) {
          const analysisResponse = await fetch(
            `/api/projects/${encodeURIComponent(savedChat.projectId)}/analysis`,
            { headers },
          );
          if (analysisResponse.ok) {
            const analysisResult = await readJson(analysisResponse, selectedLanguage);
            if (isProjectAnalysis(analysisResult.analysis)) {
              setProjectAnalysis(analysisResult.analysis);
            }
          }
        }
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
            throw new Error(interfaceText[selectedLanguage].previousMessagesError);
          }
          const result = await readJson(response, selectedLanguage);
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
          if (savedChat.finished) {
            const analysisResponse = await fetch(
              `/api/projects/${encodeURIComponent(savedChat.projectId)}/analysis`,
              { headers },
            );
            if (!analysisResponse.ok) {
              throw new Error(interfaceText[selectedLanguage].restoreError);
            }
            const analysisResult = await readJson(analysisResponse, selectedLanguage);
            if (!isProjectAnalysis(analysisResult.analysis)) {
              throw new Error(interfaceText[selectedLanguage].restoreError);
            }
            setProjectAnalysis(analysisResult.analysis);
          }
        } catch {
          setFormError(interfaceText[selectedLanguage].restoreError);
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
  }, [messages, displayedMessages, isSending, projectAnalysis]);

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
    const spokenText = cleanSpeechText(text);
    if (speechCancelRef.current) {
      speechCancelRef.current();
      speechCancelRef.current = null;
    }
    if (speechTimerRef.current !== null) {
      window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }

    if (!spokenText) {
      setRobotState("listening");
      return;
    }

    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setRobotState("talking");
      const duration = Math.max(3200, Math.min(9500, spokenText.length * 52));
      speechTimerRef.current = window.setTimeout(() => {
        setRobotState("listening");
        speechTimerRef.current = null;
      }, duration);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = language === "en" ? "en-US" : "fr-FR";
      utterance.rate = 1.04;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const voiceLanguage = language === "en" ? "en" : "fr";
      const matchingVoice = voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(voiceLanguage),
      );
      if (matchingVoice) utterance.voice = matchingVoice;

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
    if (!trimmed || isSending || isFinishing || conversationFinished) return;

    if (!isSignedIn && !projectReady && (!guestName.trim() || !guestEmail.trim())) {
      setFormError(ui.guestRequired);
      return;
    }

    setFormError("");
    setIsSending(true);
    setRobotState("thinking");
    setInputValue("");

    const pendingMessageId = `pending-${++pendingMessageSequenceRef.current}`;
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
            description: trimmed,
            language,
            ...(!accountToken ? { guestName: guestName.trim(), guestEmail: guestEmail.trim() } : {}),
          }),
        });
        const projectResult = await readJson(projectResponse, language);
        if (!projectResponse.ok || !isProject(projectResult.project)) {
          throw new Error(ui.createProjectError);
        }
        projectId = projectResult.project.id;
        if (!accountToken && typeof projectResult.guestProjectToken === "string") {
          guestToken = projectResult.guestProjectToken;
          authorizationToken = guestToken;
        }
        if (!authorizationToken) {
          throw new Error(ui.projectAccessError);
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
        const conversationResult = await readJson(conversationResponse, language);
        if (
          !conversationResponse.ok ||
          !isObject(conversationResult.conversation) ||
          typeof conversationResult.conversation.id !== "string"
        ) {
          throw new Error(ui.conversationError);
        }
        conversationId = conversationResult.conversation.id;
        savedChat = { projectId, conversationId, guestToken };
        window.sessionStorage.setItem(savedChatKey, JSON.stringify(savedChat));
        setProjectReady(true);
      }

      if (!authorizationToken || !conversationId) {
        throw new Error(ui.messageError);
      }

      const messageResponse = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authorizationToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: trimmed, language }),
        },
      );
      const messageResult = await readJson(messageResponse, language);

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
            ? ui.messageSavedAiError
            : ui.messageSendError,
        );
      }

      if (!isApiMessage(messageResult.aiMessage)) {
        throw new Error(ui.invalidReply);
      }

      const aiMessage = messageResult.aiMessage;

      // Update messages list
      setMessages((current) =>
        replacePendingWithReply(current, pendingMessageId, returnedUserMessage, {
          ...aiMessage,
          sender: "AI",
        }),
      );

      // Trigger progressive streaming text and mouth speaking animation
      streamAiMessage(aiMessage.id, aiMessage.content);
      triggerSpeech(aiMessage.content);
    } catch (error) {
      if (!userMessageSaved) {
        setMessages((current) => current.filter((message) => message.id !== pendingMessageId));
      }
      setFormError(
        error instanceof Error && !(error instanceof TypeError) ? error.message : ui.genericError,
      );
      setRobotState("listening");
    } finally {
      setIsSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }

  async function finishConversation() {
    if (isSending || isFinishing || conversationFinished) return;
    setFormError("");

    let savedChat: SavedChat | null = null;
    try {
      const savedChatValue = window.sessionStorage.getItem(savedChatKey);
      if (savedChatValue) {
        const parsed: unknown = JSON.parse(savedChatValue);
        if (isSavedChat(parsed)) savedChat = parsed;
      }
    } catch {
      setFormError(ui.finishUnavailable);
      return;
    }

    const token =
      savedChat?.guestToken ?? window.sessionStorage.getItem("aether.accessToken");
    if (!savedChat?.conversationId || !token) {
      setFormError(ui.finishUnavailable);
      return;
    }

    setIsFinishing(true);
    setRobotState("thinking");
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(savedChat.conversationId)}/finish`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = await readJson(response, language);
      if (!response.ok || !isProjectAnalysis(result.analysis)) {
        throw new Error(ui.finishError);
      }

      const finishedChat = { ...savedChat, finished: true };
      window.sessionStorage.setItem(savedChatKey, JSON.stringify(finishedChat));
      setConversationFinished(true);
      setProjectAnalysis(result.analysis);
      setRobotState("listening");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : ui.finishError);
      setRobotState("listening");
    } finally {
      setIsFinishing(false);
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
    setConversationFinished(false);
    setProjectAnalysis(null);
    setFormError("");
    setRobotState("idle");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <section
      aria-label={language === "fr" ? "Interface conversationnelle Aether IT" : "Aether IT chat interface"}
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
            <span className="model-tag">{ui.modelTag}</span>
          </div>

          <div className="chatgpt-top-actions">
            <label className="chatgpt-icon-btn" htmlFor="chat-language">
              <span className="btn-label">{ui.language}</span>
              <select
                aria-label={ui.selectLanguage}
                className="chat-language-select"
                id="chat-language"
                onChange={(event) => {
                  const nextLanguage = event.target.value as ChatLanguage;
                  setLanguage(nextLanguage);
                  window.localStorage.setItem(languageStorageKey, nextLanguage);
                  window.document.documentElement.lang = nextLanguage;
                }}
                value={language}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <button
              aria-label={voiceEnabled ? ui.disableVoice : ui.enableVoice}
              className={`chatgpt-icon-btn${voiceEnabled ? " active" : ""}`}
              onClick={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              title={voiceEnabled ? ui.disableVoice : ui.enableVoice}
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
              <span className="btn-label">{voiceEnabled ? ui.voiceEnabled : ui.voiceDisabled}</span>
            </button>

            {hasMessages && (
              <button
                aria-label={ui.newChat}
                className="chatgpt-icon-btn"
                onClick={handleResetChat}
                title={ui.newChat}
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
                <span className="btn-label">{ui.newChatLabel}</span>
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
                    <span>{ui.robotTitle}</span>
                  </span>
                  <span className={`nameplate-status${robotState === "talking" ? " speaking" : ""}`} />
                </div>
              </div>

              <div className="welcome-titles">
                <span className="welcome-kicker">✦ {ui.welcomeKicker}</span>
                <h1>{ui.welcomeTitle}</h1>
                <p>{ui.welcomeDescription}</p>
              </div>

              {/* Prompt Suggestion Cards */}
              <div className="chatgpt-suggestions-grid">
                {ui.suggestions.map((item, index) => (
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
                        ? ui.speaking
                        : robotState === "thinking"
                          ? ui.thinking
                          : ui.listening}
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
                    <span>{ui.robotSubtitle}</span>
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
                              alt={language === "fr" ? "Logo Aether IT" : "Aether IT logo"}
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
                            {isUser ? (language === "fr" ? "Vous" : "You") : "Aether IT"}
                          </span>
                        </div>
                        <div className="message-text">
                          <p>{text}</p>
                        </div>

                        {!isUser && (
                          <div className="message-actions-bar">
                            <button
                              aria-label={ui.copyLabel}
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
                                  <span>{ui.copied}</span>
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
                                  <span>{ui.copy}</span>
                                </>
                              )}
                            </button>

                            <button
                              aria-label={ui.listen}
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
                              <span>{ui.listen}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}

                {projectAnalysis && (
                  <section aria-live="polite" className="chatgpt-analysis-result">
                    <h2>{ui.analysisTitle}</h2>
                    <h3>{ui.analysisSummary}</h3>
                    <p>{projectAnalysis.summary}</p>
                    <details>
                      <summary>{ui.analysisDetails}</summary>
                      <dl>
                        {analysisFieldOrder.map((field) => (
                          <div key={field}>
                            <dt>{ui.analysisLabels[field]}</dt>
                            <dd>{projectAnalysis[field]}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </section>
                )}

                {/* Shimmer Thinking Indicator */}
                {isSending && (
                  <article className="chatgpt-message-row ai-row thinking-row">
                    <div className="message-avatar-wrap">
                      <span aria-hidden="true" className="message-avatar pulse-avatar">
                        <Image
                          alt={language === "fr" ? "Logo Aether IT" : "Aether IT logo"}
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
                        <span className="thinking-text">{ui.thinkingMessage}</span>
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
                <span className="strip-sparkle">✦</span> {ui.guestDetails}
              </span>
              <div className="guest-strip-inputs">
                <input
                  autoComplete="given-name"
                  maxLength={100}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={ui.firstName}
                  required
                  type="text"
                  value={guestName}
                />
                <input
                  autoComplete="email"
                  maxLength={254}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder={ui.email}
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

          <div className="chatgpt-ready-prompts">
            <label htmlFor="chatgpt-ready-prompt">{ui.readyPromptsLabel}</label>
            <select
              disabled={isSending || isFinishing || isRestoring || conversationFinished}
              id="chatgpt-ready-prompt"
              onChange={(event) => {
                const select = event.currentTarget;
                const prompt = select.value;
                if (!prompt) return;
                setInputValue((current) =>
                  current.trim() ? `${current.trim()}\n\n${prompt}` : prompt,
                );
                select.value = "";
                textareaRef.current?.focus();
              }}
              value=""
            >
              <option disabled value="">
                {ui.readyPromptsLabel}
              </option>
              {ui.readyPrompts.map(({ label, prompt }) => (
                <option key={label} value={prompt}>
                  {label}
                </option>
              ))}
            </select>
            <p>{ui.readyPromptsHint}</p>
          </div>

          <form className="chatgpt-pill-composer" onSubmit={handleSubmit}>
            <textarea
              autoComplete="off"
              disabled={isSending || isFinishing || isRestoring || conversationFinished}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ui.sendPlaceholder}
              ref={textareaRef}
              rows={1}
              value={inputValue}
            />

            <div className="composer-action-group">
              <button
                aria-label={ui.send}
                className={`chatgpt-send-button${inputValue.trim().length > 0 && !isSending && !isFinishing && !conversationFinished ? " can-send" : ""}`}
                disabled={!inputValue.trim() || isSending || isFinishing || isRestoring || conversationFinished}
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

          {projectReady && hasMessages && !conversationFinished && (
            <button
              className="chatgpt-finish-button"
              disabled={isSending || isFinishing || isRestoring}
              onClick={() => void finishConversation()}
              type="button"
            >
              {isFinishing ? ui.finishingConversation : ui.finishConversation}
            </button>
          )}
          {conversationFinished && <p className="chatgpt-finish-status">{ui.finishSuccess}</p>}

          <footer className="chatgpt-disclaimer">
            <span>{ui.disclaimer}</span>
          </footer>
        </div>
      </div>
    </section>
  );
}
