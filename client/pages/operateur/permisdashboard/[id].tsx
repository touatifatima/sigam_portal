import { useEffect, useRef, useState, type ElementType } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArcGISMap, {
  type ArcGISMapRef,
  type Coordinate,
} from "@/components/arcgismap/ArcgisMap";
import {
  ArrowLeft,
  Download,
  Award,
  Building2,
  MapPin,
  FileText,
  Map,
  Gem,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Repeat,
  Edit3,
  GitMerge,
  Scissors,
  ArrowRightLeft,
  HandCoins,
  LogOut,
  Trash2,
  FileCheck,
  Lock,
  DollarSign,
  Eye,
  Gavel,
  FileWarning,
  Scale,
} from "lucide-react";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import {
  computePermisSuperficie,
  getPermisTitulaireName,
  getPermisWilayaName,
  getPermisDairaName,
  getPermisCommuneName,
  getPermisSubstances,
} from "@/utils/permisHelpers";
import styles from "@/components/wizard/PermisDetails.module.css";
import tabsStyles from "@/components/wizard/DemandeDetails.module.css";

interface ProcedureItem {
  id?: number | string | null;
  code: string;
  type: string;
  statut: string;
  dateDepot?: string | null;
  dateTraitement?: string | null;
}

interface DocumentItem {
  id?: number | string;
  nom: string;
  type: string;
  taille?: number | null;
  url?: string | null;
  date_upload?: string | null;
  status?: string | null;
  procedureCode?: string | null;
}

interface ObligationItem {
  id?: number | string;
  libelle: string;
  montant: number;
  echeance?: string | null;
  statut: "PAYE" | "EN_ATTENTE" | "EN_RETARD";
}

interface HistoriqueItem {
  id?: number | string;
  code?: string | null;
  type?: string | null;
  date_octroi?: string | null;
  date_expiration?: string | null;
  statut?: string | null;
  detenteur?: string | null;
}

interface ActionRapide {
  id: string;
  label: string;
  icon: ElementType;
  description: string;
  available: boolean;
}

const apiURL =
  process.env.NEXT_PUBLIC_API_URL ||
  ((typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_URL) as string) ||
  "";

const normalizeTypeLabel = (permis: any) =>
  permis?.typePermis?.lib_type ??
  permis?.typePermis?.code_type ??
  permis?.type ??
  "--";

const hasRenouvellementProcedure = (permis: any) => {
  const procedures = Array.isArray(permis?.procedures)
    ? permis.procedures
    : [];
  const rels = Array.isArray(permis?.permisProcedure)
    ? permis.permisProcedure.map((rel: any) => rel?.procedure).filter(Boolean)
    : [];
  const all = [...procedures, ...rels];
  return all.some((proc: any) => {
    const label =
      proc?.typeProcedure?.libelle ??
      proc?.typeProcedure?.label ??
      "";
    const status = String(proc?.statut_proc ?? "").toUpperCase();
    return (
      status === "EN_COURS" &&
      String(label).toLowerCase().includes("renouvel")
    );
  });
};

const deriveStatut = (permis: any) => {
  const exp = permis?.date_expiration ? new Date(permis.date_expiration) : null;
  if (exp && !isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
    return "EXPIRE";
  }
  const lib = String(permis?.statut?.lib_statut ?? "").toLowerCase();
  if (lib.includes("suspend")) return "SUSPENDU";
  if (hasRenouvellementProcedure(permis)) return "EN_RENOUVELLEMENT";
  return "ACTIF";
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatShortDate = (value?: string | Date | null) => {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR");
};

const getStatutConfig = (statut: string) => {
  const configs = {
    ACTIF: {
      label: "Actif",
      icon: CheckCircle2,
      className: styles.badgeActive,
    },
    EXPIRE: {
      label: "Expiré",
      icon: XCircle,
      className: styles.badgeExpired,
    },
    SUSPENDU: {
      label: "Suspendu",
      icon: AlertTriangle,
      className: styles.badgeSuspended,
    },
    EN_RENOUVELLEMENT: {
      label: "En renouvellement",
      icon: RefreshCw,
      className: styles.badgeRenewal,
    },
  };
  return configs[statut as keyof typeof configs] || configs.ACTIF;
};

const getProcedureStatutConfig = (statut: string) => {
  const configs = {
    TERMINEE: { label: "Terminée", className: styles.procedureSuccess },
    EN_COURS: { label: "En cours", className: styles.procedureWarning },
    REJETEE: { label: "Rejetée", className: styles.procedureDanger },
  };
  return configs[statut as keyof typeof configs] || configs.EN_COURS;
};

const getObligationStatutConfig = (statut: string) => {
  const configs = {
    PAYE: { label: "Payé", icon: CheckCircle2, className: styles.obligationPaid },
    EN_ATTENTE: {
      label: "En attente",
      icon: Clock,
      className: styles.obligationPending,
    },
    EN_RETARD: {
      label: "En retard",
      icon: AlertTriangle,
      className: styles.obligationOverdue,
    },
  };
  return configs[statut as keyof typeof configs] || configs.EN_ATTENTE;
};

const getTypeEmoji = (type: string) => {
  const emojis: Record<string, string> = {
    Exploitation: "⛏️",
    Exploration: "🔍",
    Prospection: "🗺️",
  };
  return emojis[type] || "📄";
};

const resolveObligationStatut = (obligation: any): ObligationItem["statut"] => {
  const raw = String(
    obligation?.statut_paiement ?? obligation?.statut ?? "",
  ).toUpperCase();
  const paidViaPayments = Array.isArray(obligation?.paiements)
    ? obligation.paiements.some((p: any) =>
        String(p?.statut ?? "").toUpperCase().includes("PAY"),
      )
    : false;
  if (raw.includes("PAY") || paidViaPayments) return "PAYE";

  const due = obligation?.date_echeance
    ? new Date(obligation.date_echeance)
    : null;
  if (due && !isNaN(due.getTime()) && due.getTime() < Date.now()) {
    return "EN_RETARD";
  }
  return "EN_ATTENTE";
};

const buildProcedures = (permis: any): ProcedureItem[] => {
  const items: ProcedureItem[] = [];
  const pushProcedure = (proc: any, rel?: any) => {
    if (!proc) return;
    const id = proc?.id_proc ?? proc?.id ?? rel?.id_proc ?? null;
    const code =
      proc?.num_proc ??
      proc?.code_proc ??
      proc?.code ??
      proc?.id_proc ??
      proc?.id ??
      "PROC";
    const type =
      proc?.typeProcedure?.libelle ??
      proc?.typeProcedure?.label ??
      proc?.typeProcedure?.lib_type ??
      "Procédure";
    const statut = proc?.statut_proc ?? proc?.statut ?? "EN_COURS";
    const dateDepot =
      proc?.date_debut_proc ??
      proc?.date_demande ??
      proc?.created_at ??
      rel?.date_signature ??
      null;
    const dateTraitement = proc?.date_fin_proc ?? null;
    items.push({
      id,
      code: String(code),
      type,
      statut,
      dateDepot,
      dateTraitement,
    });
  };

  if (Array.isArray(permis?.procedures)) {
    permis.procedures.forEach((proc: any) => pushProcedure(proc));
  }
  if (Array.isArray(permis?.permisProcedure)) {
    permis.permisProcedure.forEach((rel: any) =>
      pushProcedure(rel?.procedure, rel),
    );
  }

  const seen = new Set<string>();
  return items.filter((proc) => {
    const key = `${proc.id ?? ""}-${proc.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const flattenDocuments = (payload: any): DocumentItem[] => {
  const procedures = Array.isArray(payload?.procedures) ? payload.procedures : [];
  const docs = procedures.flatMap((proc: any) => {
    const procCode = proc?.num_proc ?? proc?.id_proc ?? null;
    const list = Array.isArray(proc?.documents) ? proc.documents : [];
    return list.map((doc: any) => ({
      id: doc?.id,
      nom: doc?.nom ?? doc?.description ?? "Document",
      type: doc?.type ?? "PDF",
      taille: typeof doc?.taille === "number" ? doc.taille : null,
      url: doc?.url ?? null,
      date_upload: doc?.date_upload ?? null,
      status: doc?.status ?? null,
      procedureCode: procCode ? String(procCode) : null,
    }));
  });
  return docs;
};

const resolveCoordinatesFromPermis = (permis: any): Coordinate[] => {
  const rels = Array.isArray(permis?.permisProcedure)
    ? permis.permisProcedure
    : [];
  const coords: Coordinate[] = [];

  rels.forEach((rel: any) => {
    const proc = rel?.procedure;
    const list = Array.isArray(proc?.coordonnees) ? proc.coordonnees : [];
    list.forEach((item: any, idx: number) => {
      const coord = item?.coordonnee ?? item;
      const x = Number(coord?.x);
      const y = Number(coord?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const zoneRaw = coord?.zone;
      const zone = zoneRaw != null ? Number(zoneRaw) : undefined;
      const hemisphere = coord?.hemisphere === "S" ? "S" : "N";
      coords.push({
        id: coord?.id_coordonnees ?? coord?.id ?? idx + 1,
        idTitre: coord?.idTitre ?? 1007,
        h: coord?.h ?? 0,
        x,
        y,
        system: (coord?.system as Coordinate["system"]) || "UTM",
        zone,
        hemisphere: hemisphere as "N",
      });
    });
  });

  return coords;
};

const actionsRapides: ActionRapide[] = [
  {
    id: "option",
    label: "Option-2025",
    icon: ChevronRight,
    description: "Demander une option sur le périmètre",
    available: true,
  },
  {
    id: "renouvellement",
    label: "Renouvellement",
    icon: Repeat,
    description: "Renouveler le permis avant expiration",
    available: true,
  },
  {
    id: "modification",
    label: "Modification",
    icon: Edit3,
    description: "Modifier les caractéristiques du permis",
    available: true,
  },
  {
    id: "fusion",
    label: "Fusion",
    icon: GitMerge,
    description: "Fusionner avec un autre permis",
    available: true,
  },
  {
    id: "division",
    label: "Division",
    icon: Scissors,
    description: "Diviser le périmètre en plusieurs permis",
    available: true,
  },
  {
    id: "transfert",
    label: "Transfert",
    icon: ArrowRightLeft,
    description: "Transférer le permis à un tiers",
    available: false,
  },
  {
    id: "cession",
    label: "Cession",
    icon: HandCoins,
    description: "Céder les droits du permis",
    available: false,
  },
  {
    id: "renonciation",
    label: "Renonciation",
    icon: LogOut,
    description: "Renoncer au permis",
    available: true,
  },
  {
    id: "retrait",
    label: "Retrait",
    icon: Trash2,
    description: "Demander le retrait du permis",
    available: false,
  },
  {
    id: "regularisation",
    label: "Régularisation",
    icon: FileCheck,
    description: "Régulariser une situation",
    available: true,
  },
];

const PermisDetailsOperateur = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAuthReady = useAuthReady();
  const mapRef = useRef<ArcGISMapRef | null>(null);

  const [permis, setPermis] = useState<any | null>(null);
  const [procedures, setProcedures] = useState<ProcedureItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [obligations, setObligations] = useState<ObligationItem[]>([]);
  const [historique, setHistorique] = useState<HistoriqueItem[]>([]);
  const [substances, setSubstances] = useState<string[]>([]);
  const [perimetrePoints, setPerimetrePoints] = useState<Coordinate[]>([]);
  const [perimetreZone, setPerimetreZone] = useState<number | undefined>(undefined);
  const [perimetreHemisphere, setPerimetreHemisphere] = useState<"N" | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleActionClick = async (actionId: string) => {
    if (actionId !== "renouvellement") {
      navigate(`/operateur/procedure/${actionId}/${permis?.id ?? id}`);
      return;
    }

    const permisId = Number(permis?.id ?? id);
    if (!Number.isFinite(permisId)) {
      toast.error("Permis invalide pour le renouvellement.");
      return;
    }
    if (!apiURL) {
      toast.error("API URL manquante.");
      return;
    }

    try {
      const res = await axios.post(
        `${apiURL}/api/procedures/renouvellement/start`,
        {
          permisId,
          date_demande: new Date().toISOString(),
        },
        { withCredentials: true },
      );
      const newProcId = res?.data?.new_proc_id;
      if (!newProcId) {
        toast.error("Impossible de démarrer le renouvellement.");
        return;
      }
      navigate(
        `/operateur/renouvellement/step1/page1?id=${newProcId}&permisId=${permisId}`,
      );
    } catch (err: any) {
      console.error("Erreur renouvellement", err);
      const msg =
        err?.response?.data?.message ||
        "Erreur lors du démarrage du renouvellement.";
      toast.error(msg);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!apiURL) {
        setError("API URL manquante");
        setLoading(false);
        return;
      }
      if (!id) {
        setError("Permis invalide");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const [permisRes, docsRes, obligationsRes, historiqueRes] = await Promise.all([
          axios.get(`${apiURL}/operateur/permis/${id}`, { withCredentials: true }),
          axios
            .get(`${apiURL}/operateur/permis/${id}/documents`, { withCredentials: true })
            .catch(() => ({ data: null })),
          axios
            .get(`${apiURL}/operateur/permis/${id}/obligations`, { withCredentials: true })
            .catch(() => ({ data: [] })),
          axios
            .get(`${apiURL}/operateur/permis/${id}/historique`, { withCredentials: true })
            .catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        const permisData = permisRes?.data ?? null;
        setPermis(permisData);

        setProcedures(buildProcedures(permisData));
        setSubstances(getPermisSubstances(permisData));

        const coords = resolveCoordinatesFromPermis(permisData);
        setPerimetrePoints(coords);
        const zone = coords.find((p) => Number.isFinite(p.zone as any))?.zone;
        const hem = coords.find((p) => p.hemisphere)?.hemisphere;
        setPerimetreZone(zone);
        setPerimetreHemisphere(hem === "N" ? "N" : undefined);

        const docs = flattenDocuments(docsRes?.data ?? docsRes);
        setDocuments(docs);

        const obligationsRaw = Array.isArray(obligationsRes?.data)
          ? obligationsRes.data
          : [];
        const mappedObligations = obligationsRaw.map((item: any) => {
          const montant = Number(item?.montant ?? item?.montant_du ?? item?.montant_a_payer ?? 0);
          return {
            id: item?.id_obligation ?? item?.id,
            libelle:
              item?.libelle ??
              item?.typePaiement?.libelle ??
              item?.typePaiement?.code_paiement ??
              "Obligation fiscale",
            montant: Number.isFinite(montant) ? montant : 0,
            echeance: item?.date_echeance ?? item?.dateEcheance ?? null,
            statut: resolveObligationStatut(item),
          } as ObligationItem;
        });
        setObligations(mappedObligations);

        const historiqueRaw = Array.isArray(historiqueRes?.data)
          ? historiqueRes.data
          : [];
        setHistorique(historiqueRaw);
      } catch (err) {
        console.error("Erreur chargement permis", err);
        if (!active) return;
        setError("Impossible de charger le permis.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    if (isAuthReady) {
      load();
    }

    return () => {
      active = false;
    };
  }, [id, isAuthReady]);

  useEffect(() => {
    if (perimetrePoints.length < 3) return;
    const timer = window.setTimeout(() => {
      mapRef.current?.zoomToCurrentPolygon?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [perimetrePoints]);

  const statutValue = permis ? deriveStatut(permis) : "ACTIF";
  const statutConfig = getStatutConfig(statutValue);
  const StatusIcon = statutConfig.icon;

  const typeLabel = permis ? normalizeTypeLabel(permis) : "--";
  const titulaireLabel =
    (permis && (getPermisTitulaireName(permis) || permis?.detenteur?.nom_societeFR)) ||
    "--";
  const wilayaLabel = (permis && getPermisWilayaName(permis)) || "--";
  const dairaLabel = (permis && getPermisDairaName(permis)) || "--";
  const communeLabel = (permis && getPermisCommuneName(permis)) || "--";
  const superficieValue = permis ? computePermisSuperficie(permis) : null;
  const superficieLabel =
    typeof superficieValue === "number" ? `${superficieValue} ha` : "--";

  const dateOctroi =
    permis?.date_octroi_effective ??
    permis?.date_octroi ??
    permis?.date_octroi_proc ??
    permis?.date_signature ??
    null;
  const dateExpiration = permis?.date_expiration ?? null;

  const totalObligations = obligations.reduce((sum, o) => sum + o.montant, 0);
  const totalPaye = obligations
    .filter((o) => o.statut === "PAYE")
    .reduce((sum, o) => sum + o.montant, 0);
  const totalEnAttente = obligations
    .filter((o) => o.statut === "EN_ATTENTE")
    .reduce((sum, o) => sum + o.montant, 0);
  const totalEnRetard = obligations
    .filter((o) => o.statut === "EN_RETARD")
    .reduce((sum, o) => sum + o.montant, 0);

  if (loading) {
    return (
      <InvestorLayout>
        <div className={styles.container}>
          <div className={tabsStyles.loadingState}>
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p>Chargement du permis...</p>
          </div>
        </div>
      </InvestorLayout>
    );
  }

  if (error || !permis) {
    return (
      <InvestorLayout>
        <div className={styles.container}>
          <div className={tabsStyles.errorState}>
            <FileWarning className="w-10 h-10" />
            <h2>Permis introuvable</h2>
            <p>{error || "Aucune information disponible."}</p>
            <Button onClick={() => navigate("/operateur/permisdashboard/mes-permis")}>
              Retour à la liste
            </Button>
          </div>
        </div>
      </InvestorLayout>
    );
  }

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.heroHeader}>
          <div className={styles.heroContent}>
            <div className={styles.heroNav}>
              <Button
                variant="ghost"
                className={styles.backBtn}
                onClick={() => navigate("/operateur/permisdashboard/mes-permis")}
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la liste
              </Button>
              <Button className={styles.downloadBtn}>
                <Download className="w-4 h-4" />
                Télécharger le permis (PDF)
              </Button>
            </div>

            <div className={styles.heroInfo}>
              <div className={styles.heroIcon}>{getTypeEmoji(typeLabel)}</div>
              <div className={styles.heroText}>
                <h1 className={styles.heroCode}>{permis?.code_permis ?? permis?.code ?? "--"}</h1>
                <div className={styles.heroMeta}>
                  <span className={styles.heroType}>
                    <Award className="w-4 h-4" />
                    Permis de {typeLabel}
                  </span>
                  <span className={`${styles.heroBadge} ${statutConfig.className}`}>
                    <StatusIcon className="w-4 h-4" />
                    {statutConfig.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.mainContent}>
          <Tabs defaultValue="general" className={tabsStyles.tabs}>
            <TabsList className={tabsStyles.tabsList}>
              <TabsTrigger value="general" className={tabsStyles.tabTrigger}>
                <Eye className="w-4 h-4" />
                <span>Aperçu</span>
              </TabsTrigger>
              <TabsTrigger value="substances" className={tabsStyles.tabTrigger}>
                <Gem className="w-4 h-4" />
                <span>Substances</span>
              </TabsTrigger>
              <TabsTrigger value="procedures" className={tabsStyles.tabTrigger}>
                <Gavel className="w-4 h-4" />
                <span>Procédures liées</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className={tabsStyles.tabTrigger}>
                <FileText className="w-4 h-4" />
                <span>Documents associés</span>
              </TabsTrigger>
              <TabsTrigger value="obligations" className={tabsStyles.tabTrigger}>
                <DollarSign className="w-4 h-4" />
                <span>Obligations fiscales</span>
              </TabsTrigger>
              <TabsTrigger value="historique" className={tabsStyles.tabTrigger}>
                <Clock className="w-4 h-4" />
                <span>Historique & Renouvellements</span>
              </TabsTrigger>
              <TabsTrigger value="actions" className={tabsStyles.tabTrigger}>
                <Scale className="w-4 h-4" />
                <span>Actions rapides</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={styles.infoCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Informations générales</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Code permis</span>
                        <span className={styles.infoValue}>{permis?.code_permis ?? permis?.code ?? "--"}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Type</span>
                        <span className={styles.infoValue}>{typeLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Titulaire</span>
                        <span className={styles.infoValue}>{titulaireLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Statut</span>
                        <span className={styles.infoValue}>{statutConfig.label}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Date d'octroi</span>
                        <span className={styles.infoValue}>{formatShortDate(dateOctroi)}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Date d'expiration</span>
                        <span className={styles.infoValue}>{formatShortDate(dateExpiration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.infoCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Localisation</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Wilaya</span>
                        <span className={styles.infoValue}>{wilayaLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Daïra</span>
                        <span className={styles.infoValue}>{dairaLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Commune</span>
                        <span className={styles.infoValue}>{communeLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Lieu-dit</span>
                        <span className={styles.infoValue}>{permis?.lieu_ditFR ?? "--"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Map className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Superficie & Périmètre</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div style={{ marginBottom: "1rem" }}>
                      <span className={styles.infoLabel}>Superficie totale</span>
                      <span className={styles.infoValueLarge}>{superficieLabel}</span>
                    </div>
                    <div className={tabsStyles.mapFrame}>
                      {perimetrePoints.length >= 3 ? (
                        <div className={tabsStyles.mapCanvas}>
                          <ArcGISMap
                            ref={mapRef}
                            points={perimetrePoints}
                            superficie={0}
                            isDrawing={false}
                            coordinateSystem="UTM"
                            utmZone={perimetreZone}
                            utmHemisphere={perimetreHemisphere ?? "N"}
                            editable={false}
                            disableEnterpriseLayers
                          />
                          <div className={tabsStyles.simpleLegend}>
                            <span className={tabsStyles.legendSwatch} />
                            <span>Votre périmètre</span>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.mapPlaceholder}>
                          <MapPin className="w-8 h-8" />
                          <p>Aucun périmètre disponible</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="substances" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Gem className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Substances minières</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.substancesList}>
                      {substances.length > 0 ? (
                        substances.map((sub, index) => (
                          <span key={index} className={styles.substanceBadge}>
                            {sub}
                          </span>
                        ))
                      ) : (
                        <span className={styles.emptyText}>Aucune substance renseignée.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="procedures" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Gavel className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Procédures liées</h2>
                  </div>
                  <div className={styles.cardContent}>
                    {procedures.length > 0 ? (
                      <div className={styles.proceduresList}>
                        {procedures.map((proc, index) => {
                          const procStatut = getProcedureStatutConfig(proc.statut);
                          return (
                            <div key={index} className={styles.procedureItem}>
                              <div className={styles.procedureInfo}>
                                <div className={styles.procedureCode}>{proc.code}</div>
                                <div className={styles.procedureType}>{proc.type}</div>
                                <div className={styles.procedureDates}>
                                  <span>Dépôt: {formatShortDate(proc.dateDepot)}</span>
                                  {proc.dateTraitement && (
                                    <span> • Traité: {formatShortDate(proc.dateTraitement)}</span>
                                  )}
                                </div>
                              </div>
                              <span className={`${styles.procedureBadge} ${procStatut.className}`}>
                                {procStatut.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>Aucune procédure liée à ce permis.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Documents associés</h2>
                  </div>
                  <div className={styles.cardContent}>
                    {documents.length > 0 ? (
                      <div className={styles.documentsList}>
                        {documents.map((doc, index) => {
                          const status = String(doc.status ?? "").toLowerCase();
                          const validated = status.includes("valide") || status.includes("present");
                          const badgeClass = validated ? styles.docValidated : styles.docPending;
                          const fileUrl = doc.url
                            ? doc.url.startsWith("http")
                              ? doc.url
                              : `${apiURL}${doc.url}`
                            : null;

                          return (
                            <div key={index} className={styles.documentItem}>
                              <div className={styles.documentIcon}>
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className={styles.documentInfo}>
                                <p className={styles.documentName}>{doc.nom}</p>
                                <span className={styles.documentMeta}>
                                  {doc.type} • {doc.taille ? `${doc.taille} KB` : "--"} • {formatShortDate(doc.date_upload)}
                                </span>
                                {doc.procedureCode && (
                                  <span className={styles.documentMeta}>Procédure {doc.procedureCode}</span>
                                )}
                              </div>
                              <span className={`${styles.docStatusBadge} ${badgeClass}`}>
                                {validated ? "Validé" : doc.status || "En attente"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={styles.documentDownload}
                                onClick={() => fileUrl && window.open(fileUrl, "_blank")}
                                disabled={!fileUrl}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>Aucun document associé.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="obligations" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Obligations fiscales</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.fiscalStats}>
                      <div className={styles.fiscalStatCard}>
                        <span className={styles.fiscalStatLabel}>Total</span>
                        <span className={styles.fiscalStatValue}>
                          {totalObligations.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                      <div className={`${styles.fiscalStatCard} ${styles.fiscalPaid}`}>
                        <span className={styles.fiscalStatLabel}>Payé</span>
                        <span className={styles.fiscalStatValue}>
                          {totalPaye.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                      <div className={`${styles.fiscalStatCard} ${styles.fiscalPending}`}>
                        <span className={styles.fiscalStatLabel}>En attente</span>
                        <span className={styles.fiscalStatValue}>
                          {totalEnAttente.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                      <div className={`${styles.fiscalStatCard} ${styles.fiscalOverdue}`}>
                        <span className={styles.fiscalStatLabel}>En retard</span>
                        <span className={styles.fiscalStatValue}>
                          {totalEnRetard.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                    </div>

                    <div className={styles.fiscalProgress}>
                      <div className={styles.fiscalProgressHeader}>
                        <span>Progression des paiements</span>
                        <span>
                          {totalObligations > 0
                            ? Math.round((totalPaye / totalObligations) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <Progress
                        value={
                          totalObligations > 0
                            ? (totalPaye / totalObligations) * 100
                            : 0
                        }
                        className={styles.progressBar}
                      />
                    </div>

                    <div className={styles.obligationsTable}>
                      <div className={styles.tableHeader}>
                        <span>Libellé</span>
                        <span>Montant</span>
                        <span>Échéance</span>
                        <span>Statut</span>
                        <span>Action</span>
                      </div>
                      {obligations.length > 0 ? (
                        obligations.map((obligation, index) => {
                          const obligStatut = getObligationStatutConfig(obligation.statut);
                          const ObligIcon = obligStatut.icon;
                          return (
                            <div key={index} className={styles.tableRow}>
                              <span className={styles.tableCellLibelle}>{obligation.libelle}</span>
                              <span className={styles.tableCellMontant}>
                                {obligation.montant.toLocaleString("fr-FR")} DA
                              </span>
                              <span className={styles.tableCellEcheance}>
                                {formatShortDate(obligation.echeance)}
                              </span>
                              <span className={`${styles.tableCellStatut} ${obligStatut.className}`}>
                                <ObligIcon className="w-3.5 h-3.5" />
                                {obligStatut.label}
                              </span>
                              <span className={styles.tableCellAction}>
                                {obligation.statut !== "PAYE" && (
                                  <Button size="sm" className={styles.payBtn}>
                                    Payer
                                  </Button>
                                )}
                                {obligation.statut === "PAYE" && (
                                  <Button variant="ghost" size="sm" className={styles.receiptBtn}>
                                    <Eye className="w-4 h-4" />
                                    Reçu
                                  </Button>
                                )}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className={styles.tableRow}>
                          <span className={styles.emptyText}>Aucune obligation enregistrée.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historique" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Historique & Renouvellements</h2>
                  </div>
                  <div className={styles.cardContent}>
                    {historique.length > 0 ? (
                      <div className={styles.timeline}>
                        {historique.map((event, index) => (
                          <div key={index} className={styles.timelineItem}>
                            <div className={styles.timelineDot} />
                            <div className={styles.timelineContent}>
                              <h4 className={styles.timelineTitle}>
                                {event.type || "Permis"}
                              </h4>
                              <p className={styles.timelineDate}>
                                {formatDate(event.date_octroi || event.date_expiration)}
                              </p>
                              <p className={styles.timelineDescription}>
                                {event.statut || "Statut non renseigné"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>Aucun historique disponible.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="actions" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Scale className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Actions rapides</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.actionsGrid}>
                      {actionsRapides.map((action) => {
                        const ActionIcon = action.icon;
                        return (
                          <button
                            key={action.id}
                            className={`${styles.actionBtn} ${!action.available ? styles.actionDisabled : ""}`}
                            disabled={!action.available}
                            onClick={() => action.available && handleActionClick(action.id)}
                            title={action.description}
                          >
                            <div className={styles.actionIconWrapper}>
                              <ActionIcon className="w-5 h-5" />
                            </div>
                            <span className={styles.actionLabel}>{action.label}</span>
                            {!action.available && (
                              <span className={styles.actionRestricted}>
                                <Lock className="w-3 h-3" />
                                Accès restreint
                              </span>
                            )}
                            {action.available && <ChevronRight className={styles.actionArrow} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </InvestorLayout>
  );
};

export default PermisDetailsOperateur;
