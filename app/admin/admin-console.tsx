"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type JsonObject = Record<string, unknown>;
type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "CUSTOMER";
};
type Project = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  customerId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  isGuest: boolean;
};
type ProjectStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "ANALYSIS_READY"
  | "COMPLETED"
  | "ARCHIVED";
type ProjectDetail = Project & {
  guestPhone: string | null;
  createdAt: string;
  updatedAt: string;
  conversations: Conversation[];
  documents: DocumentRecord[];
  aiAnalysis: Analysis | null;
};
type Conversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
};
type Message = { id: string; sender: string; content: string; createdAt: string };
type Analysis = {
  id: string;
  projectId: string;
  summary: string | null;
  problem: string | null;
  solution: string | null;
  targetAudience: string | null;
  targetMarket: string | null;
  businessModel: string | null;
  valueProposition: string | null;
  features: string | null;
  competitors: string | null;
  technology: string | null;
  marketingStrategy: string | null;
  roadmap: string | null;
  risks: string | null;
  createdAt: string;
  updatedAt: string;
};
type DocumentRecord = {
  id: string;
  type: string;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
};
type ManagedRecord = JsonObject & { id: string };
type ResourceField = {
  key: string;
  label: string;
  type?: "text" | "url" | "textarea";
  required?: boolean;
  maxLength?: number;
};
type ResourceConfig = {
  label: string;
  singular: string;
  endpoint: string;
  listKey: string;
  titleKey: string;
  subtitleKey?: string;
  descriptionKey?: string;
  iconKey?: string;
  description: string;
  imageKey?: string;
  uploadKey?: string;
  uploadLabel?: string;
  fields: ResourceField[];
};

const projectStatuses: { value: ProjectStatus; label: string }[] = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "ANALYSIS_READY", label: "Analyse prête" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "ARCHIVED", label: "Archivé" },
];

const resources: Record<"employees" | "services" | "content", ResourceConfig> = {
  employees: {
    label: "Équipe",
    singular: "membre",
    endpoint: "/api/employees",
    listKey: "employees",
    titleKey: "name",
    subtitleKey: "role",
    descriptionKey: "description",
    description: "Présentez votre équipe. Ajoutez, modifiez ou retirez un profil et sa photo.",
    imageKey: "photo",
    uploadKey: "photo",
    uploadLabel: "Téléverser une photo",
    fields: [
      { key: "name", label: "Nom", required: true, maxLength: 120 },
      { key: "role", label: "Fonction", required: true, maxLength: 120 },
      { key: "description", label: "Description", type: "textarea", maxLength: 10000 },
      { key: "photo", label: "URL ou chemin de la photo", maxLength: 2048 },
      { key: "linkedinUrl", label: "Profil LinkedIn", type: "url", maxLength: 2048 },
    ],
  },
  services: {
    label: "Services",
    singular: "service",
    endpoint: "/api/services",
    listKey: "services",
    titleKey: "name",
    descriptionKey: "description",
    iconKey: "icon",
    description: "Mettez à jour les offres visibles sur votre site : nom, description et icône.",
    fields: [
      { key: "name", label: "Nom", required: true, maxLength: 120 },
      { key: "description", label: "Description", type: "textarea", maxLength: 10000 },
      { key: "icon", label: "Icône (URL ou nom)", maxLength: 2048 },
    ],
  },
  content: {
    label: "Contenu du site",
    singular: "section",
    endpoint: "/api/website-content",
    listKey: "content",
    titleKey: "section",
    subtitleKey: "title",
    descriptionKey: "content",
    description: "Modifiez les textes et images des sections publiques de votre site.",
    imageKey: "imageUrl",
    uploadKey: "image",
    uploadLabel: "Téléverser une image",
    fields: [
      { key: "section", label: "Identifiant de section", required: true, maxLength: 120 },
      { key: "title", label: "Titre", maxLength: 300 },
      { key: "content", label: "Contenu", type: "textarea", maxLength: 50000 },
      { key: "imageUrl", label: "URL ou chemin de l’image", maxLength: 2048 },
    ],
  },
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function isUser(value: unknown): value is User {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    (value.phone === null || typeof value.phone === "string") &&
    (value.role === "ADMIN" || value.role === "CUSTOMER")
  );
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return projectStatuses.some((status) => status.value === value);
}

function isProject(value: unknown): value is Project {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    isProjectStatus(value.status) &&
    (typeof value.customerId === "string" || value.customerId === null) &&
    (typeof value.guestName === "string" || value.guestName === null) &&
    (typeof value.guestEmail === "string" || value.guestEmail === null) &&
    typeof value.isGuest === "boolean"
  );
}

function isProjectDetail(value: unknown): value is ProjectDetail {
  if (!isObject(value)) return false;
  const conversations = value.conversations;
  const documents = value.documents;
  const guestPhoneValid = typeof value.guestPhone === "string" || value.guestPhone === null;
  const timestampsValid =
    typeof value.createdAt === "string" && typeof value.updatedAt === "string";
  const analysisValid = value.aiAnalysis === null || isAnalysis(value.aiAnalysis);
  return (
    isProject(value) &&
    guestPhoneValid &&
    timestampsValid &&
    Array.isArray(conversations) &&
    conversations.every(isConversation) &&
    Array.isArray(documents) &&
    documents.every(isDocument) &&
    analysisValid
  );
}

function isManagedRecord(value: unknown): value is ManagedRecord {
  return isObject(value) && typeof value.id === "string";
}

function isConversation(value: unknown): value is Conversation {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value._count === undefined ||
      (isObject(value._count) && typeof value._count.messages === "number"))
  );
}

function isAnalysis(value: unknown): value is Analysis {
  if (!isObject(value)) return false;
  const textFields = [
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
  return (
    typeof value.id === "string" &&
    typeof value.projectId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    textFields.every((field) => typeof value[field] === "string" || value[field] === null)
  );
}

function isDocument(value: unknown): value is DocumentRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.fileName === "string" &&
    (typeof value.fileSize === "number" || value.fileSize === null) &&
    typeof value.createdAt === "string"
  );
}

function isMessage(value: unknown): value is Message {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.sender === "string" &&
    typeof value.content === "string" &&
    typeof value.createdAt === "string"
  );
}

async function readResponse(response: Response): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("Le serveur a renvoyé une réponse illisible.");
  }
  if (!isObject(value)) throw new Error("Le serveur a renvoyé une réponse inattendue.");
  if (!response.ok) {
    throw new Error(
      typeof value.error === "string" ? value.error : "La requête n’a pas abouti.",
    );
  }
  return value;
}

async function apiRequest(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<JsonObject | null> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  if (response.status === 204) {
    if (!response.ok) throw new Error("La requête n’a pas abouti.");
    return null;
  }
  return readResponse(response);
}

function getArray<T>(
  value: JsonObject,
  key: string,
  isItem: (item: unknown) => item is T,
): T[] {
  const collection = value[key];
  if (!Array.isArray(collection) || !collection.every(isItem)) {
    throw new Error("Le serveur a renvoyé une liste invalide.");
  }
  return collection;
}

function ProjectBrowser({
  token,
  customerId,
}: {
  token: string;
  customerId?: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<ProjectDetail | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [documentKind, setDocumentKind] = useState<"ANALYSIS" | "CAHIER_DES_CHARGES">("ANALYSIS");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadProjects() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/projects", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await readResponse(response);
        setProjects(getArray(data, "projects", isProject));
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(
            loadError instanceof Error ? loadError.message : "Impossible de charger les projets.",
          );
        }
      } finally {
        setLoading(false);
      }
    }
    void loadProjects();
    return () => controller.abort();
  }, [token]);

  const visibleProjects = customerId
    ? projects.filter((project) => project.customerId === customerId)
    : projects;
  const filteredProjects = visibleProjects.filter((project) =>
    `${project.title} ${project.description ?? ""} ${project.guestName ?? ""} ${project.guestEmail ?? ""}`
      .toLocaleLowerCase("fr")
      .includes(projectSearch.toLocaleLowerCase("fr")),
  );

  async function loadProjectData(projectId: string): Promise<{
    detail: ProjectDetail;
    messages: Record<string, Message[]>;
    customer: User | null;
  }> {
    const projectPath = `/api/projects/${encodeURIComponent(projectId)}`;
    const projectCustomerId = projects.find((project) => project.id === projectId)?.customerId;
    const [projectResult, conversationResult, documentResult, analysisResponse, customerResult] =
      await Promise.all([
        apiRequest(token, projectPath),
        apiRequest(token, `${projectPath}/conversations`),
        apiRequest(token, `${projectPath}/documents`),
        fetch(`${projectPath}/analysis`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        projectCustomerId
          ? apiRequest(token, `/api/users/${encodeURIComponent(projectCustomerId)}`)
          : Promise.resolve(null),
      ]);

    if (!projectResult || !isProjectDetail(projectResult.project)) {
      throw new Error("Les informations de ce projet sont invalides.");
    }
    if (!conversationResult || !documentResult) {
      throw new Error("Les conversations ou documents du projet sont invalides.");
    }

    const conversations = getArray(conversationResult, "conversations", isConversation);
    const documents = getArray(documentResult, "documents", isDocument);
    let analysis: Analysis | null = null;
    if (analysisResponse.status !== 404) {
      const analysisResult = await readResponse(analysisResponse);
      if (!isAnalysis(analysisResult.analysis)) {
        throw new Error("L’analyse du projet reçue est invalide.");
      }
      analysis = analysisResult.analysis;
    }

    let customer: User | null = null;
    if (customerResult) {
      if (!isUser(customerResult.user)) {
        throw new Error("Les informations du client associées au projet sont invalides.");
      }
      customer = customerResult.user;
    }

    const messageEntries = await Promise.all(
      conversations.map(async (conversation) => {
        const result = await apiRequest(
          token,
          `/api/conversations/${encodeURIComponent(conversation.id)}/messages`,
        );
        if (!result) throw new Error("Les messages n’ont pas pu être chargés.");
        return [conversation.id, getArray(result, "messages", isMessage)] as const;
      }),
    );
    return {
      detail: { ...projectResult.project, conversations, documents, aiAnalysis: analysis },
      messages: Object.fromEntries(messageEntries),
      customer,
    };
  }

  function showProjectData(data: {
    detail: ProjectDetail;
    messages: Record<string, Message[]>;
    customer: User | null;
  }) {
    setSelected(data.detail);
    setProjects((current) =>
      current.map((project) =>
        project.id === data.detail.id ? { ...project, ...data.detail } : project,
      ),
    );
    setMessages(data.messages);
    setSelectedCustomer(data.customer);
  }

  async function selectProject(project: Project) {
    setSelected(null);
    setSelectedCustomer(null);
    setMessages({});
    setError("");
    setNotice("");
    setBusy(true);
    try {
      showProjectData(await loadProjectData(project.id));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les détails du projet.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshSelectedProject() {
    if (!selected) return;
    setError("");
    setBusy(true);
    try {
      showProjectData(await loadProjectData(selected.id));
      setNotice("Toutes les données du projet ont été actualisées.");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible d’actualiser les données du projet.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runProjectAction(
    path: string,
    body: JsonObject | undefined,
    successMessage: string,
    isExpectedResponse: (value: JsonObject) => boolean,
  ) {
    if (!selected) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest(token, path, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!result || !isExpectedResponse(result)) {
        throw new Error("Le serveur n’a pas confirmé cette opération.");
      }
      setNotice(successMessage);
      try {
        showProjectData(await loadProjectData(selected.id));
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `${successMessage} Actualisation impossible : ${refreshError.message}`
            : `${successMessage} Les données actualisées n’ont pas pu être chargées.`,
        );
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Impossible d’effectuer cette opération.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest(
        token,
        `/api/projects/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: String(form.get("title") ?? "").trim(),
            description: String(form.get("description") ?? "").trim() || null,
            status: String(form.get("status") ?? ""),
          }),
        },
      );
      if (!result || !isProject(result.project)) {
        throw new Error("Le serveur n’a pas confirmé la mise à jour du projet.");
      }
      const updated = result.project;
      setProjects((current) =>
        current.map((project) => (project.id === updated.id ? updated : project)),
      );
      setSelected((current) => (current ? { ...current, ...updated } : current));
      setNotice("Projet mis à jour.");
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Impossible de modifier le projet.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    if (!selected) return;
    if (
      !window.confirm(
        `Supprimer définitivement le projet « ${selected.title} » et toutes ses conversations, analyses et documents ? Le compte client ne sera pas supprimé.`,
      )
    ) {
      return;
    }

    const projectId = selected.id;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest(
        token,
        `/api/projects/${encodeURIComponent(projectId)}`,
        { method: "DELETE" },
      );
      if (!result || result.deleted !== true) {
        throw new Error("Le serveur n’a pas confirmé la suppression du projet.");
      }
      setProjects((current) => current.filter((project) => project.id !== projectId));
      setSelected(null);
      setSelectedCustomer(null);
      setMessages({});
      setNotice(
        typeof result.warning === "string"
          ? result.warning
          : "Le projet et ses données associées ont été supprimés. Le compte client est conservé.",
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Impossible de supprimer le projet.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendAdminMessage(
    event: FormEvent<HTMLFormElement>,
    conversationId: string,
  ) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get("content") ?? "").trim();
    if (!content) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest(
        token,
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content, sender: "ADMIN" }),
        },
      );
      if (!result || !isMessage(result.message) || !isMessage(result.aiMessage)) {
        throw new Error("Le serveur n’a pas confirmé l’envoi du message.");
      }
      setNotice("Message envoyé et réponse IA reçue.");
      formElement.reset();
      try {
        showProjectData(await loadProjectData(selected.id));
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Message envoyé. Actualisation impossible : ${refreshError.message}`
            : "Message envoyé, mais les données actualisées n’ont pas pu être chargées.",
        );
      }
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Impossible d’envoyer le message.";
      try {
        showProjectData(await loadProjectData(selected.id));
        setError(message);
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `${message} Actualisation impossible : ${refreshError.message}`
            : message,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function downloadDocument(document: DocumentRecord) {
    setError("");
    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(document.id)}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        await readResponse(response);
        return;
      }
      const fileUrl = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = fileUrl;
      anchor.download = document.fileName;
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Impossible de télécharger ce document.",
      );
    }
  }

  return (
    <div className="admin-browser-layout">
      <section aria-label="Liste des projets" className="admin-list-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>{customerId ? "Projets du client" : "Tous les projets"}</h2>
            <p>{visibleProjects.length} projet(s){projects.length === 100 ? " · 100 maximum chargés" : ""}</p>
          </div>
        </div>
        <label className="admin-search-field admin-project-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Rechercher un projet"
            onChange={(event) => setProjectSearch(event.target.value)}
            placeholder="Nom, client ou description…"
            value={projectSearch}
          />
        </label>
        {loading ? (
          <p className="admin-muted">Chargement des projets…</p>
        ) : filteredProjects.length === 0 ? (
          <p className="admin-muted">Aucun projet pour le moment.</p>
        ) : (
          <div className="admin-record-list">
            {filteredProjects.map((project) => (
              <button
                aria-pressed={selected?.id === project.id}
                className={`admin-record-button${selected?.id === project.id ? " is-selected" : ""}`}
                disabled={busy}
                key={project.id}
                onClick={() => void selectProject(project)}
                type="button"
              >
                <strong>{project.title}</strong>
                <span>{projectStatuses.find((status) => status.value === project.status)?.label}</span>
                <small>
                  {project.isGuest
                    ? `Invité · ${project.guestName ?? project.guestEmail ?? "sans nom"}`
                    : "Client inscrit"}
                </small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Détails du projet" className="admin-detail-panel">
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {busy && !selected ? (
          <p className="admin-muted">Chargement des détails du projet…</p>
        ) : !selected ? (
          <p className="admin-muted">Sélectionnez un projet pour consulter ses détails.</p>
        ) : (
          <>
            <form className="admin-project-form" key={selected.id} onSubmit={updateProject}>
              <div className="admin-panel-heading">
                <h2>Projet et statut</h2>
                <span>{selected.isGuest ? "Invité" : "Client"}</span>
              </div>
              <dl className="admin-project-metadata">
                <div><dt>Identifiant</dt><dd>{selected.id}</dd></div>
                <div><dt>Créé le</dt><dd>{new Date(selected.createdAt).toLocaleString("fr-FR")}</dd></div>
                <div><dt>Modifié le</dt><dd>{new Date(selected.updatedAt).toLocaleString("fr-FR")}</dd></div>
                {selected.isGuest ? (
                  <>
                    <div><dt>Contact</dt><dd>{selected.guestName || "Non renseigné"}</dd></div>
                    <div><dt>E-mail</dt><dd>{selected.guestEmail || "Non renseigné"}</dd></div>
                    <div><dt>Téléphone</dt><dd>{selected.guestPhone || "Non renseigné"}</dd></div>
                  </>
                ) : (
                  <>
                    <div><dt>Client</dt><dd>{selectedCustomer?.name ?? "Compte client"}</dd></div>
                    <div><dt>E-mail</dt><dd>{selectedCustomer?.email ?? selected.customerId}</dd></div>
                    <div><dt>Téléphone</dt><dd>{selectedCustomer?.phone || "Non renseigné"}</dd></div>
                  </>
                )}
              </dl>
              <label className="admin-form-field">
                <span>Nom du projet</span>
                <input defaultValue={selected.title} maxLength={200} name="title" required />
              </label>
              <label className="admin-form-field">
                <span>Description</span>
                <textarea
                  defaultValue={selected.description ?? ""}
                  maxLength={20000}
                  name="description"
                  rows={3}
                />
              </label>
              <label className="admin-form-field">
                <span>Statut</span>
                <select defaultValue={selected.status} name="status">
                  {projectStatuses.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
              <button className="admin-primary-button" disabled={busy} type="submit">
                Enregistrer le projet
              </button>
            </form>

            <section aria-label="Suppression du projet" className="admin-detail-section">
              <div>
                <h3>Supprimer le projet</h3>
                <p className="admin-muted">
                  Les conversations, analyses et documents seront supprimés. Le compte client restera actif.
                </p>
              </div>
              <button
                className="admin-danger-button"
                disabled={busy}
                onClick={() => void deleteProject()}
                type="button"
              >
                Supprimer définitivement le projet
              </button>
            </section>

            <div className="admin-detail-section">
              <div className="admin-panel-heading">
                <h3>Conversations et messages</h3>
                <button
                  className="admin-secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void runProjectAction(
                      `/api/projects/${encodeURIComponent(selected.id)}/conversations`,
                      undefined,
                      "Nouvelle conversation créée.",
                      (result) => isConversation(result.conversation),
                    )
                  }
                  type="button"
                >
                  Démarrer une conversation
                </button>
              </div>
              {selected.conversations.length === 0 ? (
                <p className="admin-muted">Aucune conversation pour ce projet.</p>
              ) : (
                selected.conversations.map((conversation, index) => (
                  <details className="admin-conversation" key={conversation.id} open>
                    <summary>
                      Conversation {index + 1} · {messages[conversation.id]?.length ?? conversation._count?.messages ?? 0} messages · {new Date(conversation.createdAt).toLocaleString("fr-FR")}
                    </summary>
                    <div className="admin-message-list">
                      {(messages[conversation.id] ?? []).map((message) => (
                        <article className="admin-message" key={message.id}>
                          <div>
                            <strong>
                              {message.sender === "USER"
                                ? "Client"
                                : message.sender === "ADMIN"
                                  ? "Administrateur"
                                  : message.sender}
                            </strong>
                            <time dateTime={message.createdAt}>
                              {new Date(message.createdAt).toLocaleString("fr-FR")}
                            </time>
                          </div>
                          <p>{message.content}</p>
                        </article>
                      ))}
                    </div>
                    <form
                      className="admin-message-compose"
                      onSubmit={(event) => void sendAdminMessage(event, conversation.id)}
                    >
                      <label className="admin-form-field">
                        <span>Message de l’administrateur</span>
                        <textarea
                          maxLength={12000}
                          name="content"
                          placeholder="Répondre dans cette conversation…"
                          required
                          rows={2}
                        />
                      </label>
                      <button className="admin-secondary-button" disabled={busy} type="submit">
                        Envoyer et recevoir la réponse IA
                      </button>
                    </form>
                    <button
                      className="admin-secondary-button"
                      disabled={busy || messages[conversation.id]?.length === 0}
                      onClick={() =>
                        void runProjectAction(
                          `/api/conversations/${encodeURIComponent(conversation.id)}/finish`,
                          undefined,
                          "Conversation terminée et analyse générée.",
                          (result) => isAnalysis(result.analysis),
                        )
                      }
                      type="button"
                    >
                      Terminer et générer l’analyse
                    </button>
                  </details>
                ))
              )}
            </div>

            <div className="admin-detail-section">
              <div className="admin-panel-heading">
                <h3>Analyse IA</h3>
                <button
                  className="admin-secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void runProjectAction(
                      `/api/projects/${encodeURIComponent(selected.id)}/analysis`,
                      undefined,
                      "Analyse IA générée et enregistrée.",
                      (result) => isAnalysis(result.analysis),
                    )
                  }
                  type="button"
                >
                  Générer / actualiser l’analyse
                </button>
              </div>
              {selected.aiAnalysis ? (
                <>
                  <p className="admin-muted">
                    Dernière mise à jour : {new Date(selected.aiAnalysis.updatedAt).toLocaleString("fr-FR")}
                  </p>
                  <dl className="admin-analysis-grid">
                    {([
                      ["summary", "Résumé"],
                      ["problem", "Problème"],
                      ["solution", "Solution"],
                      ["targetAudience", "Public cible"],
                      ["targetMarket", "Marché cible"],
                      ["businessModel", "Modèle économique"],
                      ["valueProposition", "Proposition de valeur"],
                      ["features", "Fonctionnalités"],
                      ["competitors", "Concurrents"],
                      ["technology", "Technologie"],
                      ["marketingStrategy", "Stratégie marketing"],
                      ["roadmap", "Feuille de route"],
                      ["risks", "Risques"],
                    ] as const).map(([field, label]) => (
                      <div key={field}>
                        <dt>{label}</dt>
                        <dd>{selected.aiAnalysis?.[field] || "Non renseigné"}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="admin-muted">Aucune analyse enregistrée pour ce projet. Générez-la pour créer des exports.</p>
              )}
            </div>

            <div className="admin-detail-section">
              <div className="admin-panel-heading">
                <h3>Documents et PDF</h3>
                <div className="admin-export-actions">
                  <label className="admin-export-kind">
                    <span>Type d’export</span>
                    <select
                      onChange={(event) =>
                        setDocumentKind(
                          event.target.value === "CAHIER_DES_CHARGES"
                            ? "CAHIER_DES_CHARGES"
                            : "ANALYSIS",
                        )
                      }
                      value={documentKind}
                    >
                      <option value="ANALYSIS">Analyse du projet</option>
                      <option value="CAHIER_DES_CHARGES">Cahier des charges</option>
                    </select>
                  </label>
                  <button
                    className="admin-secondary-button"
                    disabled={busy || !selected.aiAnalysis}
                    onClick={() =>
                      void runProjectAction(
                        `/api/projects/${encodeURIComponent(selected.id)}/documents`,
                        { type: "PDF", documentKind },
                        "Export PDF créé.",
                        (result) => isDocument(result.document),
                      )
                    }
                    type="button"
                  >
                    Générer PDF
                  </button>
                  <button
                    className="admin-secondary-button"
                    disabled={busy || !selected.aiAnalysis}
                    onClick={() =>
                      void runProjectAction(
                        `/api/projects/${encodeURIComponent(selected.id)}/documents`,
                        { type: "DOCX", documentKind },
                        "Export DOCX créé.",
                        (result) => isDocument(result.document),
                      )
                    }
                    type="button"
                  >
                    Générer DOCX
                  </button>
                  <button
                    className="admin-secondary-button"
                    disabled={busy}
                    onClick={() => void refreshSelectedProject()}
                    type="button"
                  >
                    Actualiser les données
                  </button>
                </div>
              </div>
              {selected.documents.length === 0 ? (
                <p className="admin-muted">Aucun document exporté pour ce projet.</p>
              ) : (
                <ul className="admin-document-list">
                  {selected.documents.map((document) => (
                    <li key={document.id}>
                      <span>
                        <strong>{document.fileName}</strong>
                        <small>
                          {document.type} · {document.fileSize === null ? "Taille inconnue" : `${(document.fileSize / 1024).toFixed(1)} Ko`} · {new Date(document.createdAt).toLocaleString("fr-FR")}
                        </small>
                      </span>
                      <button
                        className="admin-secondary-button"
                        onClick={() => void downloadDocument(document)}
                        type="button"
                      >
                        Télécharger
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

async function fetchUsersPage(
  token: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ users: User[]; total: number }> {
  const data = await apiRequest(token, `/api/users?page=${page}`, { signal });
  if (!data || typeof data.total !== "number") {
    throw new Error("La liste des utilisateurs reçue est invalide.");
  }
  return { users: getArray(data, "users", isUser), total: data.total };
}

function CustomerManager({ token }: { token: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsersPage(token, page);
      setError("");
      setUsers(data.users);
      setTotal(data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }, [page, token]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchUsersPage(token, page, controller.signal)
      .then((data) => {
        if (!active) return;
        setError("");
        setUsers(data.users);
        setTotal(data.total);
      })
      .catch((loadError: unknown) => {
        if (active && !(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger les clients.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, token]);

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();
    const payload: JsonObject = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
    };
    if (formMode === "create") {
      payload.password = String(form.get("password") ?? "");
      if (phone) payload.phone = phone;
    } else {
      payload.phone = phone || null;
      payload.role = String(form.get("role") ?? "CUSTOMER");
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (formMode === "create") {
        await apiRequest(token, "/api/users", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Le compte client a été créé.");
      } else if (selected) {
        await apiRequest(token, `/api/users/${encodeURIComponent(selected.id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Le compte a été mis à jour.");
      }
      setFormMode(null);
      setSelected(null);
      await loadUsers();
    } catch (saveError) {
      setLoading(false);
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer ce compte.");
    }
  }

  async function deleteUser(user: User) {
    if (!window.confirm(`Supprimer le compte de ${user.name} ?`)) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await apiRequest(token, `/api/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      setNotice("Le compte a été supprimé.");
      if (selected?.id === user.id) setSelected(null);
      await loadUsers();
    } catch (deleteError) {
      setLoading(false);
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer ce compte.");
    }
  }

  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="admin-management">
      <section className="admin-list-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Comptes clients et administrateurs</h2>
            <p>{total} compte(s) · affichage de 50 par page</p>
          </div>
          <button className="admin-primary-button" onClick={() => {
            setSelected(null);
            setFormMode("create");
          }} type="button">
            Ajouter un client
          </button>
        </div>
        <label className="admin-form-field">
          <span>Rechercher un compte</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou e-mail" value={search} />
        </label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {loading ? (
          <p className="admin-muted">Chargement des comptes…</p>
        ) : filteredUsers.length === 0 ? (
          <p className="admin-muted">Aucun compte trouvé sur cette page.</p>
        ) : (
          <div className="admin-user-table-wrap">
            <table className="admin-user-table">
              <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role === "ADMIN" ? "Administrateur" : "Client"}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-secondary-button" onClick={() => {
                          setSelected(user);
                          setFormMode("edit");
                        }} type="button">Modifier</button>
                        {user.role === "CUSTOMER" && (
                          <button className="admin-secondary-button" onClick={() => setSelected(user)} type="button">
                            Projets
                          </button>
                        )}
                        <button className="admin-danger-button" onClick={() => void deleteUser(user)} type="button">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-pagination">
          <button className="admin-secondary-button" disabled={page <= 1} onClick={() => {
            setLoading(true);
            setPage((value) => value - 1);
          }} type="button">
            Précédent
          </button>
          <span>Page {page} / {Math.max(1, Math.ceil(total / 50))}</span>
          <button className="admin-secondary-button" disabled={page >= Math.ceil(total / 50)} onClick={() => {
            setLoading(true);
            setPage((value) => value + 1);
          }} type="button">
            Suivant
          </button>
        </div>

        {formMode && (
          <form className="admin-edit-form" key={selected?.id ?? "new"} onSubmit={saveUser}>
            <h3>{formMode === "create" ? "Créer un compte client" : "Modifier le compte"}</h3>
            <div className="admin-form-grid">
              <label className="admin-form-field"><span>Nom</span><input defaultValue={selected?.name ?? ""} maxLength={120} name="name" required /></label>
              <label className="admin-form-field"><span>E-mail</span><input defaultValue={selected?.email ?? ""} maxLength={254} name="email" required type="email" /></label>
              <label className="admin-form-field"><span>Téléphone</span><input defaultValue={selected?.phone ?? ""} maxLength={40} name="phone" /></label>
              {formMode === "create" ? (
                <label className="admin-form-field"><span>Mot de passe provisoire</span><input minLength={6} name="password" required type="password" /></label>
              ) : (
                <label className="admin-form-field"><span>Rôle</span><select defaultValue={selected?.role ?? "CUSTOMER"} name="role"><option value="CUSTOMER">Client</option><option value="ADMIN">Administrateur</option></select></label>
              )}
            </div>
            <div className="admin-row-actions">
              <button className="admin-primary-button" type="submit">Enregistrer</button>
              <button className="admin-secondary-button" onClick={() => setFormMode(null)} type="button">Annuler</button>
            </div>
          </form>
        )}
      </section>
      {selected?.role === "CUSTOMER" && formMode !== "edit" && (
        <section className="admin-list-panel">
          <div className="admin-panel-heading">
            <div><h2>Projets de {selected.name}</h2><p>{selected.email}</p></div>
            <button className="admin-secondary-button" onClick={() => setSelected(null)} type="button">Fermer</button>
          </div>
          <ProjectBrowser customerId={selected.id} token={token} />
        </section>
      )}
    </div>
  );
}

function ResourceManager({
  token,
  resourceKey,
}: {
  token: string;
  resourceKey: "employees" | "services" | "content";
}) {
  const config = resources[resourceKey];
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [editing, setEditing] = useState<ManagedRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(token, config.endpoint);
      if (!data) throw new Error("La liste est indisponible.");
      setRecords(getArray(data, config.listKey, isManagedRecord));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les éléments.");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.listKey, token]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: JsonObject = {};
    for (const field of config.fields) {
      const value = String(form.get(field.key) ?? "").trim();
      if (value) payload[field.key] = value;
      else if (!field.required) payload[field.key] = null;
    }
    setError("");
    setNotice("");
    setLoading(true);
    try {
      let body: BodyInit = JSON.stringify(payload);
      if (config.uploadKey && imageFile) {
        const multipart = new FormData();
        for (const [key, value] of Object.entries(payload)) {
          multipart.set(key, typeof value === "string" ? value : "");
        }
        multipart.set(config.uploadKey, imageFile);
        body = multipart;
      }
      await apiRequest(
        token,
        editing
          ? `${config.endpoint}/${encodeURIComponent(editing.id)}`
          : config.endpoint,
        {
          method: editing ? "PATCH" : "POST",
          body,
        },
      );
      setNotice(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${editing ? "mis à jour" : "créé"}.`);
      setEditing(null);
      setCreating(false);
      setImageFile(null);
      await loadRecords();
    } catch (saveError) {
      setLoading(false);
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer cet élément.");
    }
  }

  async function deleteRecord(record: ManagedRecord) {
    const title = record[config.titleKey];
    if (!window.confirm(`Supprimer « ${typeof title === "string" ? title : config.singular} » ?`)) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await apiRequest(token, `${config.endpoint}/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
      });
      setNotice(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} supprimé.`);
      if (editing?.id === record.id) setEditing(null);
      await loadRecords();
    } catch (deleteError) {
      setLoading(false);
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer cet élément.");
    }
  }

  const form = (record: ManagedRecord | null) => (
    <form className="admin-edit-form" key={record?.id ?? "new"} onSubmit={saveRecord}>
      <div className="admin-form-intro">
        <div>
          <p className="admin-eyebrow">{record ? "MODIFICATION" : "NOUVEAU CONTENU"}</p>
          <h3>{record ? `Modifier ${config.singular}` : `Ajouter ${config.singular}`}</h3>
        </div>
        <button className="admin-icon-button" aria-label="Fermer le formulaire" onClick={() => {
          setEditing(null);
          setCreating(false);
          setImageFile(null);
        }} type="button">×</button>
      </div>
      <div className="admin-form-grid">
        {config.fields.map((field) => {
          const value = record?.[field.key];
          const props = {
            defaultValue: typeof value === "string" ? value : "",
            maxLength: field.maxLength,
            name: field.key,
            required: field.required,
          };
          return (
            <label className={`admin-form-field${field.type === "textarea" ? " is-wide" : ""}`} key={field.key}>
              <span>{field.label}</span>
              {field.type === "textarea" ? (
                <textarea {...props} rows={4} />
              ) : (
                <input {...props} type={field.type === "url" ? "url" : "text"} />
              )}
            </label>
          );
        })}
        {config.uploadKey && (
          <div className="admin-image-upload is-wide">
            <div className="admin-image-preview">
              {imagePreview ? (
                <Image alt="Aperçu de l’image sélectionnée" className="admin-preview-image" fill sizes="96px" src={imagePreview} unoptimized />
              ) : record && typeof record[config.imageKey ?? ""] === "string" ? (
                <Image
                  alt="Image actuellement enregistrée"
                  className="admin-preview-image"
                  fill
                  sizes="96px"
                  src={String(record[config.imageKey ?? ""])}
                  unoptimized
                />
              ) : (
                <span aria-hidden="true">✦</span>
              )}
            </div>
            <label className="admin-form-field admin-upload-control">
              <span>{config.uploadLabel}</span>
              <input
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                name={`${config.uploadKey}File`}
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <small>PNG, JPG, WebP, GIF ou AVIF · 5 Mo maximum</small>
            </label>
          </div>
        )}
      </div>
      <div className="admin-row-actions">
        <button className="admin-primary-button" disabled={loading} type="submit">
          {loading ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="admin-secondary-button" onClick={() => {
          setEditing(null);
          setCreating(false);
          setImageFile(null);
        }} type="button">Annuler</button>
      </div>
    </form>
  );

  const visibleRecords = records.filter((record) =>
    config.fields
      .map((field) => record[field.key])
      .some((value) => typeof value === "string" && value.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))),
  );

  return (
    <section className="admin-resource-page">
      <div className="admin-resource-toolbar">
        <div className="admin-resource-copy">
          <p className="admin-eyebrow">GESTION DE CONTENU</p>
          <h2>{config.label}</h2>
          <p>{config.description}</p>
        </div>
        <div className="admin-resource-count">
          <strong>{records.length}</strong>
          <span>enregistrement{records.length > 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="admin-resource-actions">
        <label className="admin-search-field">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label={`Rechercher ${config.label.toLowerCase()}`}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Rechercher ${config.label.toLowerCase()}…`}
            value={search}
          />
        </label>
        {!creating && !editing && (
          <button className="admin-primary-button" onClick={() => {
            setImageFile(null);
            setCreating(true);
          }} type="button">
            <span aria-hidden="true">＋</span> Ajouter {config.singular}
          </button>
        )}
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {creating && form(null)}
      {editing && form(editing)}
      {loading ? (
        <div aria-live="polite" className="admin-resource-empty"><span className="admin-loader" />Chargement des données…</div>
      ) : records.length === 0 ? (
        <div className="admin-resource-empty">
          <span aria-hidden="true">✦</span>
          <strong>Aucun élément pour le moment</strong>
          <p>Créez votre premier {config.singular} pour enrichir votre site.</p>
          {!creating && <button className="admin-secondary-button" onClick={() => setCreating(true)} type="button">Créer maintenant</button>}
        </div>
      ) : visibleRecords.length === 0 ? (
        <div className="admin-resource-empty"><strong>Aucun résultat</strong><p>Essayez un autre nom ou mot-clé.</p></div>
      ) : (
        <div className="admin-resource-grid">
          {visibleRecords.map((record) => {
            const title = record[config.titleKey];
            const subtitle = config.subtitleKey ? record[config.subtitleKey] : null;
            const description = config.descriptionKey ? record[config.descriptionKey] : null;
            const image = config.imageKey ? record[config.imageKey] : null;
            const icon = config.iconKey ? record[config.iconKey] : null;
            return (
              <article className={`admin-resource-card${image ? " has-image" : ""}`} key={record.id}>
                <div className="admin-resource-card-top">
                  {typeof image === "string" && image ? (
                    <div className="admin-resource-image">
                      <Image alt="" className="admin-preview-image" fill sizes="64px" src={image} unoptimized />
                    </div>
                  ) : (
                    <div aria-hidden="true" className="admin-resource-avatar">
                      {typeof icon === "string" && icon.trim()
                        ? /^(https?:\/\/|\/)/i.test(icon.trim()) ? "✦" : icon.trim().slice(0, 3)
                        : (typeof title === "string" ? title.trim().slice(0, 1) : config.singular.slice(0, 1)).toLocaleUpperCase("fr")}
                    </div>
                  )}
                  <div className="admin-resource-card-title">
                    <strong>{typeof title === "string" ? title : config.singular}</strong>
                    {typeof subtitle === "string" && subtitle && <span>{subtitle}</span>}
                  </div>
                  <span className="admin-live-badge"><i /> En ligne</span>
                </div>
                {typeof description === "string" && description && (
                  <p className="admin-resource-description">{description}</p>
                )}
                <div className="admin-resource-card-meta">
                  <span>Mis à jour</span>
                  <time dateTime={typeof record.updatedAt === "string" ? record.updatedAt : undefined}>
                    {typeof record.updatedAt === "string"
                      ? new Date(record.updatedAt).toLocaleDateString("fr-FR")
                      : "—"}
                  </time>
                </div>
                <div className="admin-resource-card-actions">
                  <button className="admin-secondary-button" onClick={() => {
                    setCreating(false);
                    setImageFile(null);
                    setEditing(record);
                  }} type="button"><span aria-hidden="true">✎</span> Modifier</button>
                  <button className="admin-danger-button" onClick={() => void deleteRecord(record)} type="button"><span aria-hidden="true">⌫</span> Supprimer</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="admin-data-permission">
        <span aria-hidden="true">▣</span>
        Les modifications sont enregistrées et publiées immédiatement sur le site.
      </p>
    </section>
  );
}

type AdminSection = "overview" | "customers" | "projects" | "employees" | "services" | "content";
const sectionLabels: { id: AdminSection; label: string }[] = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "customers", label: "Clients" },
  { id: "projects", label: "Projets" },
  { id: "employees", label: "Équipe" },
  { id: "services", label: "Services" },
  { id: "content", label: "Site web" },
];

const sectionDescriptions: Record<AdminSection, string> = {
  overview: "Suivez les données principales et accédez rapidement aux outils d’administration.",
  customers: "Créez et gérez les comptes, attribuez les rôles et consultez les projets de chaque client.",
  projects: "Modifiez les projets, gérez leur statut et consultez les échanges et fichiers associés.",
  employees: "Ajoutez, modifiez ou retirez les profils de votre équipe et leurs photos.",
  services: "Mettez à jour les offres présentées à vos visiteurs : nom, description et icône.",
  content: "Éditez les textes, titres et visuels des sections publiques de votre site.",
};

export default function AdminConsole({
  token,
  adminName,
  onLogout,
}: {
  token: string;
  adminName: string;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [stats, setStats] = useState<{ users: number; projects: number; employees: number; services: number; content: number } | null>(null);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadStats() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const responses = await Promise.all([
          fetch("/api/users?page=1", { headers, signal: controller.signal }),
          fetch("/api/projects", { headers, signal: controller.signal }),
          fetch("/api/employees", { headers, signal: controller.signal }),
          fetch("/api/services", { headers, signal: controller.signal }),
          fetch("/api/website-content", { headers, signal: controller.signal }),
        ]);
        const data = await Promise.all(responses.map(readResponse));
        if (typeof data[0].total !== "number") throw new Error("Le nombre de clients est indisponible.");
        setStats({
          users: data[0].total,
          projects: getArray(data[1], "projects", isProject).length,
          employees: getArray(data[2], "employees", isManagedRecord).length,
          services: getArray(data[3], "services", isManagedRecord).length,
          content: getArray(data[4], "content", isManagedRecord).length,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStatsError(error instanceof Error ? error.message : "Impossible de charger les indicateurs.");
        }
      }
    }
    void loadStats();
    return () => controller.abort();
  }, [token]);

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link aria-label="Aether IT — accueil" className="admin-brand" href="/">
          <Image alt="" height={38} src="/images/aetherit-logo.png" width={38} />
          <span>AETHER<span>IT</span></span>
        </Link>
        <div className="admin-topbar-user">
          <span>Bonjour, {adminName}</span>
          <button className="admin-logout" onClick={onLogout} type="button">Déconnexion</button>
        </div>
      </header>
      <div className="admin-console-layout">
        <aside aria-label="Navigation du tableau de bord" className="admin-sidebar">
          <p className="admin-eyebrow">ADMINISTRATION</p>
          <nav>
            {sectionLabels.map((item) => (
              <button
                aria-current={section === item.id ? "page" : undefined}
                className={section === item.id ? "is-active" : ""}
                key={item.id}
                onClick={() => setSection(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <Link href="/api-docs">Documentation API →</Link>
        </aside>
        <section aria-labelledby="admin-title" className="admin-console-main">
          <div className="admin-heading">
            <div>
              <p className="admin-eyebrow">ESPACE ADMINISTRATEUR</p>
              <h1 id="admin-title">{sectionLabels.find((item) => item.id === section)?.label}</h1>
              <p>{sectionDescriptions[section]}</p>
            </div>
          </div>

          {section === "overview" && (
            <>
              {statsError && <p className="admin-error" role="alert">{statsError}</p>}
              <div aria-label="Indicateurs de la plateforme" className="admin-stats admin-stats-five">
                {[
                  { label: "Clients", value: stats?.users, section: "customers" as const, action: "Comptes et projets" },
                  { label: "Projets", value: stats?.projects, section: "projects" as const, action: "Suivi et documents" },
                  { label: "Équipe", value: stats?.employees, section: "employees" as const, action: "Profils et photos" },
                  { label: "Services", value: stats?.services, section: "services" as const, action: "Offres du site" },
                  { label: "Sections du site", value: stats?.content, section: "content" as const, action: "Textes et visuels" },
                ].map((card) => (
                  <button
                    aria-label={`Gérer ${card.label}`}
                    className="admin-stat-card admin-stat-link"
                    key={card.label}
                    onClick={() => setSection(card.section)}
                    type="button"
                  >
                    <p>{card.label}</p><strong>{card.value ?? "—"}</strong>
                    <span>{card.action} <b aria-hidden="true">→</b></span>
                  </button>
                ))}
              </div>
              <div className="admin-access-note"><span aria-hidden="true">✓</span> Vos actions sont sécurisées : seuls les administrateurs peuvent créer, modifier ou supprimer ces données. Les modifications de contenu et de services sont visibles publiquement.</div>
            </>
          )}
          {section === "customers" && <CustomerManager token={token} />}
          {section === "projects" && <ProjectBrowser token={token} />}
          {section === "employees" && <ResourceManager resourceKey="employees" token={token} />}
          {section === "services" && <ResourceManager resourceKey="services" token={token} />}
          {section === "content" && <ResourceManager resourceKey="content" token={token} />}
        </section>
      </div>
    </main>
  );
}
