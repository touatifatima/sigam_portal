export type NotificationNavigationItem = {
  id: number;
  type?: string | null;
  category?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  demandeId?: number | null;
  permisId?: number | null;
  messageId?: number | null;
  userId?: number | null;
};

type RoleKind = "admin" | "operateur" | "investisseur" | "other";

export type NotificationNavigationResolveOptions = {
  apiURL?: string | null;
  userId?: number | null;
  headers?: Record<string, string>;
  conversationProbeLimit?: number;
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

const toPositiveInt = (value: unknown): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const intVal = Math.trunc(num);
  return intVal > 0 ? intVal : null;
};

const detectRoleKind = (roleRaw?: string | null): RoleKind => {
  const role = normalize(roleRaw);
  if (role.includes("admin")) return "admin";
  if (role.includes("operat")) return "operateur";
  if (role.includes("invest")) return "investisseur";
  return "other";
};

const buildPathWithQuery = (
  path: string,
  query?: Record<string, string | number | null | undefined>,
): string => {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  });
  const suffix = params.toString();
  if (!suffix) return path;
  return `${path}?${suffix}`;
};

const buildDemandePath = (
  role: RoleKind,
  demandeId: number,
  focusMessageId?: number | null,
  focusComposer?: boolean,
): string => {
  const base =
    role === "admin"
      ? `/admin_panel/gestion-demandes/${demandeId}`
      : role === "operateur"
      ? `/demand_dashboard/${demandeId}`
      : `/investisseur/demandes/${demandeId}`;

  return buildPathWithQuery(base, {
    tab: focusMessageId || focusComposer ? "messages" : undefined,
    focusMessageId: focusMessageId ?? undefined,
    focusComposer: focusComposer ? 1 : undefined,
  });
};

const buildPermisPath = (
  role: RoleKind,
  permisId: number,
  focusMessageId?: number | null,
  focusComposer?: boolean,
): string => {
  const base =
    role === "operateur"
      ? `/operateur/permisdashboard/${permisId}`
      : role === "admin"
      ? `/gestion_permis?id=${permisId}`
      : `/permis_dashboard/view/permisdetails?id=${permisId}`;

  // Keep existing query when using admin/investisseur query-based route
  if (base.includes("?")) {
    const [path, qs] = base.split("?");
    const params = new URLSearchParams(qs);
    if (focusMessageId || focusComposer) {
      params.set("tab", "messages");
      if (focusMessageId) {
        params.set("focusMessageId", String(focusMessageId));
      }
    }
    if (focusComposer) {
      params.set("focusComposer", "1");
    }
    return `${path}?${params.toString()}`;
  }

  return buildPathWithQuery(base, {
    tab: focusMessageId || focusComposer ? "messages" : undefined,
    focusMessageId: focusMessageId ?? undefined,
    focusComposer: focusComposer ? 1 : undefined,
  });
};

const isMessageNotification = (item: NotificationNavigationItem) => {
  const category = normalize(item.category);
  const relatedType = normalize(item.relatedEntityType);
  const type = normalize(item.type);
  return (
    category === "message_admin" ||
    relatedType === "message_portail" ||
    type === "reponse"
  );
};

const isIdentificationNotification = (item: NotificationNavigationItem) => {
  const relatedType = normalize(item.relatedEntityType);
  return relatedType.startsWith("entreprise_identification");
};

const normalizeCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const parseArrayPayload = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  return [];
};

const fetchJson = async (
  url: string,
  headers?: Record<string, string>,
): Promise<any | null> => {
  try {
    const response = await fetch(url, {
      credentials: "include",
      headers,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const pickDemandeIdFromList = (
  items: any[],
  codeRaw: string,
): number | null => {
  if (!items.length) return null;
  const targetCode = normalizeCode(codeRaw);
  const targetAsId = toPositiveInt(codeRaw);

  const exact = items.find((item) => {
    const itemId = toPositiveInt(item?.id_demande ?? item?.idDemande ?? item?.id);
    const itemCode = normalizeCode(item?.code_demande ?? item?.codeDemande ?? item?.code);
    if (targetAsId && itemId === targetAsId) return true;
    return Boolean(targetCode && itemCode && itemCode === targetCode);
  });

  if (exact) {
    return toPositiveInt(exact?.id_demande ?? exact?.idDemande ?? exact?.id);
  }

  if (items.length === 1) {
    return toPositiveInt(items[0]?.id_demande ?? items[0]?.idDemande ?? items[0]?.id);
  }

  return null;
};

const pickPermisIdFromList = (
  items: any[],
  codeRaw: string,
): number | null => {
  if (!items.length) return null;
  const targetCode = normalizeCode(codeRaw);
  const targetAsId = toPositiveInt(codeRaw);

  const exact = items.find((item) => {
    const itemId = toPositiveInt(item?.id ?? item?.id_permis ?? item?.idPermis);
    const itemCode = normalizeCode(item?.code_permis ?? item?.codePermis ?? item?.code);
    if (targetAsId && itemId === targetAsId) return true;
    return Boolean(targetCode && itemCode && itemCode === targetCode);
  });

  if (exact) {
    return toPositiveInt(exact?.id ?? exact?.id_permis ?? exact?.idPermis);
  }

  if (items.length === 1) {
    return toPositiveInt(items[0]?.id ?? items[0]?.id_permis ?? items[0]?.idPermis);
  }

  return null;
};

const resolveDemandeIdByCode = async (
  role: RoleKind,
  entityCode: string,
  options: NotificationNavigationResolveOptions,
  apiURL: string,
): Promise<number | null> => {
  const parsedCodeId = toPositiveInt(entityCode);
  if (parsedCodeId) return parsedCodeId;

  if (!entityCode.trim()) return null;
  const encodedCode = encodeURIComponent(entityCode.trim());

  if (role === "investisseur") {
    const payload = await fetchJson(`${apiURL}/demandes/mes-demandes`, options.headers);
    return pickDemandeIdFromList(parseArrayPayload(payload), entityCode);
  }

  if (role === "operateur") {
    const currentUserId = toPositiveInt(options.userId);
    if (currentUserId) {
      const minePayload = await fetchJson(
        `${apiURL}/demandes_dashboard/mine?utilisateurId=${currentUserId}`,
        options.headers,
      );
      const mineMatch = pickDemandeIdFromList(parseArrayPayload(minePayload), entityCode);
      if (mineMatch) return mineMatch;
    }
  }

  const dashboardPayload = await fetchJson(
    `${apiURL}/demandes_dashboard?page=1&pageSize=50&search=${encodedCode}`,
    options.headers,
  );
  return pickDemandeIdFromList(parseArrayPayload(dashboardPayload), entityCode);
};

const resolvePermisIdByCode = async (
  entityCode: string,
  options: NotificationNavigationResolveOptions,
  apiURL: string,
): Promise<number | null> => {
  const parsedCodeId = toPositiveInt(entityCode);
  if (parsedCodeId) return parsedCodeId;

  if (!entityCode.trim()) return null;
  const payload = await fetchJson(`${apiURL}/operateur/permis`, options.headers);
  return pickPermisIdFromList(parseArrayPayload(payload), entityCode);
};

const buildPathFromConversationEntity = async (
  role: RoleKind,
  entityTypeRaw: unknown,
  entityCodeRaw: unknown,
  focusMessageId: number | null,
  options: NotificationNavigationResolveOptions,
  apiURL: string,
): Promise<string | null> => {
  const entityType = normalize(entityTypeRaw);
  const entityCode = String(entityCodeRaw ?? "").trim();
  if (!entityType || !entityCode) return null;

  if (entityType.includes("demande")) {
    const demandeId = await resolveDemandeIdByCode(role, entityCode, options, apiURL);
    if (demandeId) {
      return buildDemandePath(role, demandeId, focusMessageId, true);
    }
    return null;
  }

  if (entityType.includes("permis")) {
    const permisId = await resolvePermisIdByCode(entityCode, options, apiURL);
    if (permisId) {
      return buildPermisPath(role, permisId, focusMessageId, true);
    }
    return null;
  }

  return null;
};

const resolveFromMessageContext = async (
  item: NotificationNavigationItem,
  role: RoleKind,
  messageId: number | null,
  options: NotificationNavigationResolveOptions,
): Promise<string | null> => {
  if (!messageId) return null;

  const apiURL = String(options.apiURL || "").trim().replace(/\/+$/, "");
  if (!apiURL) return null;

  if (role === "admin") {
    const adminDetail = await fetchJson(
      `${apiURL}/notifications/admin/${item.id}`,
      options.headers,
    );
    const adminDemandeId = toPositiveInt(adminDetail?.demande?.id_demande);
    if (adminDemandeId) {
      return buildDemandePath(role, adminDemandeId, messageId, true);
    }
    const adminPermisId = toPositiveInt(adminDetail?.permis?.id);
    if (adminPermisId) {
      return buildPermisPath(role, adminPermisId, messageId, true);
    }
    const fromAdminConversation = await buildPathFromConversationEntity(
      role,
      adminDetail?.messageRelated?.conversation?.entityType,
      adminDetail?.messageRelated?.conversation?.entityCode,
      messageId,
      options,
      apiURL,
    );
    if (fromAdminConversation) return fromAdminConversation;
  }

  const conversationsPayload = await fetchJson(
    `${apiURL}/api/chat/conversations`,
    options.headers,
  );
  const conversations = parseArrayPayload(conversationsPayload);
  if (!conversations.length) return null;

  let matchedConversation =
    conversations.find(
      (conversation) =>
        toPositiveInt(conversation?.lastMessage?.id) === messageId,
    ) || null;

  if (!matchedConversation) {
    const probeLimit = Math.max(1, Number(options.conversationProbeLimit || 25));
    for (const conversation of conversations.slice(0, probeLimit)) {
      const conversationId = toPositiveInt(conversation?.id);
      if (!conversationId) continue;
      const messagesPayload = await fetchJson(
        `${apiURL}/api/chat/conversation/${conversationId}/messages`,
        options.headers,
      );
      const messages = parseArrayPayload(messagesPayload);
      const hasMessage = messages.some(
        (message) => toPositiveInt(message?.id) === messageId,
      );
      if (hasMessage) {
        matchedConversation = conversation;
        break;
      }
    }
  }

  if (!matchedConversation) return null;
  return buildPathFromConversationEntity(
    role,
    matchedConversation?.entityType,
    matchedConversation?.entityCode,
    messageId,
    options,
    apiURL,
  );
};

export function resolveNotificationTargetPath(
  item: NotificationNavigationItem,
  roleRaw?: string | null,
): string | null {
  const role = detectRoleKind(roleRaw);
  const relatedType = normalize(item.relatedEntityType);

  const relatedEntityId = toPositiveInt(item.relatedEntityId);
  const demandeId =
    toPositiveInt(item.demandeId) ??
    (relatedType.includes("demande") ? relatedEntityId : null);
  const permisId =
    toPositiveInt(item.permisId) ??
    (relatedType.includes("permis") ? relatedEntityId : null);
  const messageId =
    toPositiveInt(item.messageId) ??
    (relatedType === "message_portail" ? relatedEntityId : null);

  if (isIdentificationNotification(item)) {
    const userId = relatedEntityId ?? toPositiveInt(item.userId);
    return buildPathWithQuery("/admin/identifications-entreprises", {
      userId: userId ?? undefined,
      highlightUserId: userId ?? undefined,
      sourceNotif: item.id,
    });
  }

  if (isMessageNotification(item)) {
    if (demandeId) {
      return buildDemandePath(role, demandeId, messageId, true);
    }
    if (permisId) return buildPermisPath(role, permisId, messageId, true);

    if (role === "admin") {
      return buildPathWithQuery("/admin_panel/gestion_notifications", {
        focusNotificationId: item.id,
        focusMessageId: messageId ?? undefined,
      });
    }

    return null;
  }

  if (demandeId || normalize(item.category) === "demande") {
    if (!demandeId) return null;
    return buildDemandePath(role, demandeId, null);
  }

  if (permisId || normalize(item.category) === "permis") {
    if (!permisId) return null;
    return buildPermisPath(role, permisId, null);
  }

  return null;
}

export async function resolveNotificationTargetPathAsync(
  item: NotificationNavigationItem,
  roleRaw?: string | null,
  options: NotificationNavigationResolveOptions = {},
): Promise<string | null> {
  const role = detectRoleKind(roleRaw);
  const relatedType = normalize(item.relatedEntityType);
  const directTarget = resolveNotificationTargetPath(item, roleRaw);
  const messageId =
    toPositiveInt(item.messageId) ??
    (relatedType === "message_portail" ? toPositiveInt(item.relatedEntityId) : null);
  const hasExplicitEntityLink =
    toPositiveInt(item.demandeId) ||
    toPositiveInt(item.permisId) ||
    (relatedType.includes("demande") ? toPositiveInt(item.relatedEntityId) : null) ||
    (relatedType.includes("permis") ? toPositiveInt(item.relatedEntityId) : null);

  if (hasExplicitEntityLink && directTarget) {
    return directTarget;
  }

  if (isMessageNotification(item) && messageId) {
    const exactTarget = await resolveFromMessageContext(
      item,
      role,
      messageId,
      options,
    );
    if (exactTarget) return exactTarget;
  }

  return directTarget;
}
