 import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FiSend } from "react-icons/fi";
import { Mail, MessageSquareText } from "lucide-react";
import { useRouter } from "next/router";
import { useAuthStore } from "@/src/store/useAuthStore";
import styles from "./EntityMessagesPanel.module.css";

type EntityType = "demande" | "permis";

type ChatUser = {
  id: number;
  nom?: string | null;
  Prenom?: string | null;
  prenom?: string | null;
  username?: string | null;
  email?: string | null;
  role?: { name?: string | null } | null;
};

type ConversationItem = {
  id: number;
  user1Id: number;
  user2Id: number;
  entityType?: string;
  entityCode?: string;
  unreadCount?: number;
  lastMessage?: {
    content?: string | null;
    createdAt?: string | null;
  } | null;
  otherUser: ChatUser;
};

type MessageItem = {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  conversationId?: number | null;
  isRead: boolean;
  createdAt: string;
  sender?: ChatUser | null;
};

type EntityMessagesPanelProps = {
  entityType: EntityType;
  entityCode?: string | null;
  autoFocusComposer?: boolean;
  defaultRecipientId?: number | null;
  lockRecipient?: boolean;
};

const apiURL =
  process.env.NEXT_PUBLIC_API_URL ||
  ((typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_URL) as string) ||
  "";

const normalizeText = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isTruthyQueryFlag = (value?: string | null) => {
  const normalized = normalizeText(value);
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "oui"
  );
};

const formatRelativeDate = (value?: string | null) => {
  if (!value) return "--";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "--";
  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "A l'instant";
  if (diff < hour) return `Il y a ${Math.max(1, Math.floor(diff / minute))} min`;
  if (diff < day) return `Il y a ${Math.max(1, Math.floor(diff / hour))} h`;
  if (diff < 7 * day) return `Il y a ${Math.max(1, Math.floor(diff / day))} j`;
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildDisplayName = (user?: ChatUser | null) => {
  if (!user) return "Administration";
  const full = [user.nom, user.Prenom ?? user.prenom].filter(Boolean).join(" ").trim();
  return full || user.username || user.email || "Administration";
};

const isLikelyAdministration = (user?: ChatUser | null) => {
  const roleName = normalizeText(user?.role?.name);
  if (
    roleName.includes("admin") ||
    roleName.includes("administrateur") ||
    roleName.includes("agent") ||
    roleName.includes("cadastre") ||
    roleName.includes("support")
  ) {
    return true;
  }
  const marker = normalizeText(
    `${user?.username || ""} ${user?.email || ""} ${user?.nom || ""} ${user?.Prenom || user?.prenom || ""}`,
  );
  return (
    marker.includes("admin") ||
    marker.includes("agent") ||
    marker.includes("support") ||
    marker.includes("administration")
  );
};

const EntityMessagesPanel = ({
  entityType,
  entityCode,
  autoFocusComposer = false,
  defaultRecipientId = null,
  lockRecipient = false,
}: EntityMessagesPanelProps) => {
  const router = useRouter();
  const auth = useAuthStore((state) => state.auth);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<ChatUser[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedMessageId, setFocusedMessageId] = useState<number | null>(null);
  const threadCardRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const consumedFocusMessageIdRef = useRef<number | null>(null);

  const threadEntityType = useMemo(
    () => (entityType === "demande" ? "DEMANDE" : entityType === "permis" ? "PERMIS" : "GENERAL"),
    [entityType],
  );
  const threadEntityCode = useMemo(() => {
    const value = String(entityCode || "").trim();
    return value || "GENERAL";
  }, [entityCode]);
  const currentUserId = Number(auth?.id || 0);
  const lockedRecipientId = useMemo(() => {
    const parsed = Number(defaultRecipientId || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
  }, [defaultRecipientId]);
  const isRecipientLocked = !!lockRecipient && !!lockedRecipientId;
  const currentRole = normalizeText(auth?.role);
  const isInvestorOrOperator = useMemo(
    () => currentRole.includes("invest") || currentRole.includes("operat"),
    [currentRole],
  );

  const headers = useMemo(
    () => ({
      "x-user-id": currentUserId ? String(currentUserId) : "",
      "x-user-name": auth?.username || auth?.email || "",
    }),
    [auth?.email, auth?.username, currentUserId],
  );

  const selectedConversation = useMemo(
    () =>
      conversations.find((conv) => Number(conv.id) === Number(selectedConversationId)) ||
      null,
    [conversations, selectedConversationId],
  );
  const focusMessageId = useMemo(() => {
    const rawValue = router.query.focusMessageId;
    const candidate = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const parsed = Number(candidate || 0);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
    if (typeof window !== "undefined") {
      const fallback = Number(
        new URLSearchParams(window.location.search).get("focusMessageId") || 0,
      );
      if (Number.isFinite(fallback) && fallback > 0) {
        return Math.trunc(fallback);
      }
    }
    return null;
  }, [router.asPath, router.query.focusMessageId]);

  const shouldFocusComposer = useMemo(() => {
    if (autoFocusComposer) return true;
    const rawValue = router.query.focusComposer;
    const candidate = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (isTruthyQueryFlag(candidate ? String(candidate) : "")) return true;
    if (typeof window !== "undefined") {
      const searchValue = new URLSearchParams(window.location.search).get(
        "focusComposer",
      );
      if (isTruthyQueryFlag(searchValue)) return true;
    }
    return false;
  }, [autoFocusComposer, router.asPath, router.query.focusComposer]);

  const targetRecipientId = useMemo(() => {
    if (selectedConversation?.otherUser?.id) {
      return Number(selectedConversation.otherUser.id);
    }
    return selectedRecipientId ? Number(selectedRecipientId) : null;
  }, [selectedConversation, selectedRecipientId]);

  const messageList = useMemo(() => messages, [messages]);
  const administrationUsers = useMemo(
    () => availableUsers.filter((user) => isLikelyAdministration(user)),
    [availableUsers],
  );
  const lockedRecipientLabel = useMemo(() => {
    if (!isRecipientLocked || !lockedRecipientId) return null;
    const found = availableUsers.find(
      (user) => Number(user?.id || 0) === Number(lockedRecipientId),
    );
    return found ? buildDisplayName(found) : null;
  }, [availableUsers, isRecipientLocked, lockedRecipientId]);

  const loadConversations = useCallback(async () => {
    if (!apiURL || !currentUserId) return;
    setLoadingConversations(true);
    setError(null);
    try {
      const res = await axios.get(`${apiURL}/api/chat/conversations`, {
        withCredentials: true,
        headers,
        params: {
          entityType: threadEntityType,
          entityCode: threadEntityCode,
        },
      });
      const items = Array.isArray(res.data) ? (res.data as ConversationItem[]) : [];

      setConversations(items);
      setSelectedConversationId((prev) => {
        if (isRecipientLocked && lockedRecipientId) {
          const preferred = items.find(
            (it) => Number(it?.otherUser?.id || 0) === Number(lockedRecipientId),
          );
          return preferred ? Number(preferred.id) : null;
        }
        if (prev && items.some((it) => Number(it.id) === Number(prev))) {
          return prev;
        }
        if (!items.length) return null;
        return Number(items[0].id);
      });
    } catch (err: any) {
      console.error("Erreur chargement conversations:", err);
      setError(
        err?.response?.data?.message ||
          "Impossible de charger les conversations pour le moment.",
      );
      setConversations([]);
      setSelectedConversationId(null);
    } finally {
      setLoadingConversations(false);
    }
  }, [
    currentUserId,
    headers,
    isRecipientLocked,
    lockedRecipientId,
    threadEntityCode,
    threadEntityType,
  ]);

  const loadAvailableUsers = useCallback(async () => {
    if (!apiURL || !currentUserId) return;
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${apiURL}/api/chat/users`, {
        withCredentials: true,
        headers,
      });
      const rows = Array.isArray(res.data) ? (res.data as ChatUser[]) : [];
      setAvailableUsers(rows);
      setSelectedRecipientId((prev) => {
        if (isRecipientLocked && lockedRecipientId) {
          return lockedRecipientId;
        }
        const adminUser = rows.find((u) => isLikelyAdministration(u));
        if (isInvestorOrOperator) {
          return Number(adminUser?.id || 0) || null;
        }
        if (prev && rows.some((u) => Number(u.id) === Number(prev))) return prev;
        return Number(adminUser?.id || rows[0]?.id || 0) || null;
      });
    } catch (err) {
      console.error("Erreur chargement utilisateurs chat:", err);
      setAvailableUsers([]);
      setSelectedRecipientId(null);
    } finally {
      setLoadingUsers(false);
    }
  }, [currentUserId, headers, isInvestorOrOperator, isRecipientLocked, lockedRecipientId]);

  const loadMessages = useCallback(
    async (conversationId: number) => {
      if (!apiURL || !currentUserId || !conversationId) return;
      setLoadingMessages(true);
      setError(null);
      try {
        const res = await axios.get(
          `${apiURL}/api/chat/conversation/${conversationId}/messages`,
          {
            withCredentials: true,
            headers,
          },
        );
        const rows = Array.isArray(res.data) ? (res.data as MessageItem[]) : [];
        setMessages(rows);
      } catch (err: any) {
        console.error("Erreur chargement messages:", err);
        setError(
          err?.response?.data?.message ||
            "Impossible de charger les messages pour le moment.",
        );
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [currentUserId, headers],
  );

  useEffect(() => {
    if (!currentUserId) return;
    loadConversations();
    loadAvailableUsers();
  }, [currentUserId, loadAvailableUsers, loadConversations]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!isInvestorOrOperator || selectedConversation) return;
    if (isRecipientLocked && lockedRecipientId) return;
    const adminUser = administrationUsers[0];
    setSelectedRecipientId(Number(adminUser?.id || 0) || null);
  }, [
    administrationUsers,
    isInvestorOrOperator,
    isRecipientLocked,
    lockedRecipientId,
    selectedConversation,
  ]);

  useEffect(() => {
    if (!isRecipientLocked || !lockedRecipientId) return;
    setSelectedRecipientId(lockedRecipientId);
  }, [isRecipientLocked, lockedRecipientId]);

  useEffect(() => {
    if (!messageList.length) return;
    const container = threadCardRef.current;
    if (!container) return;

    let timeoutId: number | null = null;
    const hasFocusTarget =
      !!focusMessageId &&
      focusMessageId !== consumedFocusMessageIdRef.current &&
      messageList.some((message) => Number(message.id) === Number(focusMessageId));

    if (hasFocusTarget && focusMessageId) {
      const targetNode = container.querySelector<HTMLElement>(
        `[data-message-id='${focusMessageId}']`,
      );
      if (targetNode) {
        targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
        setFocusedMessageId(focusMessageId);
        consumedFocusMessageIdRef.current = focusMessageId;
        timeoutId = window.setTimeout(() => {
          setFocusedMessageId((prev) => (prev === focusMessageId ? null : prev));
        }, 4200);
      }
    } else {
      const unreadIncoming = [...messageList]
        .reverse()
        .find(
          (message) =>
            Number(message.senderId) !== Number(currentUserId) && !message.isRead,
        );
      const fallbackId = Number(unreadIncoming?.id || messageList[messageList.length - 1]?.id || 0);
      if (fallbackId > 0) {
        const targetNode = container.querySelector<HTMLElement>(
          `[data-message-id='${fallbackId}']`,
        );
        if (targetNode) {
          targetNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [currentUserId, focusMessageId, messageList]);

  useEffect(() => {
    if (!shouldFocusComposer) return;
    const timeoutId = window.setTimeout(() => {
      if (!composerInputRef.current) return;
      composerInputRef.current.focus();
      composerInputRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [messageList.length, shouldFocusComposer, selectedConversationId]);

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !targetRecipientId || !apiURL || !currentUserId) return;
    try {
      setSending(true);
      setError(null);
      const res = await axios.post<MessageItem>(
        `${apiURL}/api/chat/message`,
        {
          content,
          receiverId: Number(targetRecipientId),
          entityType: threadEntityType,
          entityCode: threadEntityCode,
        },
        {
          withCredentials: true,
          headers,
        },
      );
      setNewMessage("");
      const createdConversationId = Number(res?.data?.conversationId || 0) || null;
      if (createdConversationId) {
        setSelectedConversationId(createdConversationId);
        await loadMessages(createdConversationId);
      } else if (selectedConversationId) {
        await loadMessages(selectedConversationId);
      }
      await loadConversations();
    } catch (err: any) {
      console.error("Erreur envoi message:", err);
      setError(
        err?.response?.data?.message || "Envoi impossible. Veuillez reessayer.",
      );
    } finally {
      setSending(false);
    }
  };

  const canSend = !!targetRecipientId && !!newMessage.trim() && !sending;

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleWrap}>
          <MessageSquareText size={18} />
          <div>
            <h3 className={styles.headerTitle}>Commentaires / Messages</h3>
            <p className={styles.headerSub}>
              Echanges avec l&apos;administration pour ce {entityType}.
            </p>
          </div>
        </div>
        {conversations.length > 1 && !isRecipientLocked && (
          <select
            className={styles.conversationSelect}
            value={selectedConversationId ?? ""}
            onChange={(e) => setSelectedConversationId(Number(e.target.value))}
          >
            {conversations.map((conv) => (
              <option key={conv.id} value={conv.id}>
                {buildDisplayName(conv.otherUser)}
              </option>
            ))}
          </select>
        )}
        {!selectedConversation &&
          !isInvestorOrOperator &&
          availableUsers.length > 0 &&
          !isRecipientLocked && (
          <select
            className={styles.conversationSelect}
            value={selectedRecipientId ?? ""}
            onChange={(e) => setSelectedRecipientId(Number(e.target.value))}
            disabled={loadingUsers}
          >
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {buildDisplayName(user)}
              </option>
            ))}
          </select>
        )}
        {!selectedConversation && isRecipientLocked && (
          <span className={styles.composerHint}>
            Destinataire:{" "}
            {lockedRecipientLabel || `Utilisateur #${String(lockedRecipientId || "")}`}
          </span>
        )}
        {!selectedConversation && !isRecipientLocked && isInvestorOrOperator && (
          <span className={styles.composerHint}>Destinataire: Administration</span>
        )}
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.threadCard} ref={threadCardRef}>
        {(loadingConversations || loadingMessages) && (
          <div className={styles.loadingState}>Chargement des messages...</div>
        )}

        {!loadingConversations && !conversations.length && (
          <div className={styles.emptyState}>
            <Mail size={24} />
            <p>
              Aucun message pour le moment.
              {availableUsers.length
                ? " Vous pouvez envoyer un nouveau message ci-dessous."
                : " Contactez l'administration si necessaire."}
            </p>
          </div>
        )}

        {!loadingConversations && !!conversations.length && !messageList.length && (
          <div className={styles.emptyState}>
            <Mail size={24} />
            <p>Aucun message pour le moment. Envoyez votre premier commentaire.</p>
          </div>
        )}

        {!!messageList.length && (
          <div className={styles.messagesList}>
            {messageList.map((message) => {
              const isMine = Number(message.senderId) === currentUserId;
              return (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  className={`${styles.messageRow} ${isMine ? styles.mine : styles.admin}`}
                >
                  <div
                    className={`${styles.bubble} ${
                      isMine ? styles.bubbleMine : styles.bubbleAdmin
                    } ${
                      focusedMessageId === Number(message.id) ? styles.focusedMessage : ""
                    }`}
                  >
                    <div className={styles.senderLabel}>
                      {isMine ? "Moi" : "Administration"}
                    </div>
                    <p className={styles.messageText}>{message.content}</p>
                    <div className={styles.messageMeta}>
                      <span>{formatRelativeDate(message.createdAt)}</span>
                      {!isMine && !message.isRead && (
                        <span className={styles.newBadge}>Non lu</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.composer}>
        <textarea
          ref={composerInputRef}
          rows={2}
          className={styles.input}
          placeholder="Ecrire un message a l'administration..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={sending}
        />
        {!targetRecipientId && (
          <p className={styles.composerHint}>
            {isInvestorOrOperator
              ? "Aucun compte administration disponible pour le moment. Veuillez contacter le support."
              : "Aucun destinataire disponible pour le moment. Verifiez votre session puis rechargez la page."}
          </p>
        )}
        <button
          type="button"
          className={styles.sendBtn}
          onClick={handleSendMessage}
          disabled={!canSend}
        >
          <FiSend />
          Envoyer un nouveau message
        </button>
      </div>
    </div>
  );
};

export default EntityMessagesPanel;
