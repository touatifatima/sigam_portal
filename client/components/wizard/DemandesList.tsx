import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  FileText, 
  Download, 
  Eye, 
  Plus, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Filter,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  LayoutGrid,
  List,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./DemandesList.module.css";

type DemandeListItem = {
  id_demande: number;
  short_code?: string | null;
  code_demande?: string | null;
  date_demande?: string | null;
  statut_demande?: string | null;
  typePermis?: { lib_type?: string | null; code_type?: string | null };
  typeProcedure?: { libelle?: string | null };
  wilaya?: { nom_wilayaFR?: string | null };
  daira?: { nom_dairaFR?: string | null };
  commune?: { nom_communeFR?: string | null };
  procedure?: { date_debut_proc?: string | null };
};

type DemandeDetail = {
  id_demande: number;
  id_proc?: number | null;
  code_demande?: string | null;
  short_code?: string | null;
  date_demande?: string | null;
  statut_demande?: string | null;
  superficie?: number | string | null;
  superficie_ha?: number | string | null;
  superficieHa?: number | string | null;
  surface?: number | string | null;
  lieu_ditFR?: string | null;
  typePermis?: { lib_type?: string | null; code_type?: string | null } | null;
  typeProcedure?: { libelle?: string | null } | null;
  detenteur?: { nom_societeFR?: string | null; nom_societeAR?: string | null } | null;
  wilaya?: { nom_wilayaFR?: string | null } | null;
  daira?: { nom_dairaFR?: string | null } | null;
  commune?: { nom_communeFR?: string | null } | null;
  communes?: Array<{
    principale?: boolean | null;
    commune?: {
      nom_communeFR?: string | null;
      daira?: {
        nom_dairaFR?: string | null;
        wilaya?: { nom_wilayaFR?: string | null } | null;
      } | null;
    } | null;
  }>;
  procedure?: { date_debut_proc?: string | null } | null;
};

const safeText = (value: unknown, fallback = "--"): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickFirstNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toFileSafe = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const extractSurfaceValues = (payload: unknown): number[] => {
  const values: number[] = [];
  if (!payload || typeof payload !== "object") return values;

  const stack: unknown[] = [payload];
  const seen = new Set<unknown>();
  let visited = 0;

  while (stack.length > 0 && visited < 5000) {
    const current = stack.pop();
    visited += 1;
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item);
      }
      continue;
    }

    for (const [key, raw] of Object.entries(current as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("superficie") || lowerKey.includes("surface")) {
        const parsed = toNumber(raw);
        if (parsed !== null) {
          values.push(parsed);
        }
      }
      if (raw && typeof raw === "object") {
        stack.push(raw);
      }
    }
  }

  return values;
};

const loadImageAsDataUrl = async (src: string): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

const apiURL =
  process.env.NEXT_PUBLIC_API_URL ||
  ((typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_URL) as string) ||
  "";

const DemandesList = () => {
  const navigate = useNavigate();
  const [demandes, setDemandes] = useState<DemandeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);
  const pageSize = 10;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("sigam_demandes_view");
    if (saved === "grid" || saved === "list") {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sigam_demandes_view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    let active = true;

    if (!apiURL) {
      setError("API URL manquant.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    axios
      .get(`${apiURL}/demandes/mes-demandes`, { withCredentials: true })
      .then((res) => {
        if (!active) return;
        const payload = Array.isArray(res.data) ? res.data : [];
        setDemandes(payload);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Erreur chargement des demandes", err);
        setError("Erreur lors du chargement des demandes.");
        toast.error("Erreur lors du chargement des demandes.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, dateFrom, dateTo]);

  const getStatutConfig = (statut: string) => {
    const configs = {
      EN_COURS: { 
        label: "En cours", 
        icon: Clock, 
        className: styles.badgeWarning
      },
      EN_ATTENTE: {
        label: "En attente",
        icon: Clock,
        className: styles.badgeWarning
      },
      ACCEPTEE: { 
        label: "Acceptée", 
        icon: CheckCircle2, 
        className: styles.badgeSuccess
      },
      REJETEE: { 
        label: "Rejetée", 
        icon: XCircle, 
        className: styles.badgeDanger
      },
    };
    return configs[statut as keyof typeof configs] || configs.EN_COURS;
  };

  const getTypeIcon = (type: string) => {
    const normalized = (type || "").toLowerCase();
    if (normalized.includes("prospect")) return "🗺️";
    if (normalized.includes("explor")) return "🔍";
    if (normalized.includes("exploit")) return "⛏️";
    if (normalized.includes("carri")) return "🏗️";
    return "📄";
  };

  const resolveDate = (demande: DemandeListItem) =>
    demande.date_demande || demande.procedure?.date_debut_proc || null;

  const filteredDemandes = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    return demandes.filter((d) => {
      const code = d.code_demande || `DEM-${d.id_demande}`;
      const typePermis = d.typePermis?.lib_type || d.typePermis?.code_type || "";
      const wilaya = d.wilaya?.nom_wilayaFR || "";
      const commune = d.commune?.nom_communeFR || "";

      const matchesSearch =
        !search ||
        code.toLowerCase().includes(search) ||
        typePermis.toLowerCase().includes(search) ||
        wilaya.toLowerCase().includes(search) ||
        commune.toLowerCase().includes(search);

      const statut = d.statut_demande || "EN_COURS";
      const matchesStatus = statusFilter === "tous" || statut === statusFilter;
      const matchesType =
        typeFilter === "tous" || typePermis === typeFilter;

      const dateStr = resolveDate(d);
      const dateObj = dateStr ? new Date(dateStr) : null;
      const matchesDate =
        (!fromDate || (dateObj && dateObj >= fromDate)) &&
        (!toDate || (dateObj && dateObj <= toDate));

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [demandes, searchTerm, statusFilter, typeFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = demandes.length;
    const enCours = demandes.filter((d) => d.statut_demande === "EN_COURS").length;
    const acceptees = demandes.filter((d) => d.statut_demande === "ACCEPTEE").length;
    const rejetees = demandes.filter((d) => d.statut_demande === "REJETEE").length;
    return { total, enCours, acceptees, rejetees };
  }, [demandes]);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    demandes.forEach((d) => {
      const label = d.typePermis?.lib_type || d.typePermis?.code_type;
      if (label) values.add(label);
    });
    return Array.from(values);
  }, [demandes]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDemandes.length / pageSize),
  );

  const paginatedDemandes = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredDemandes.slice(startIndex, startIndex + pageSize);
  }, [filteredDemandes, currentPage, pageSize]);

  const handleDownloadPdf = async (demandeId: number) => {
    if (!apiURL) return;
    if (pdfLoadingId === demandeId) return;

    setPdfLoadingId(demandeId);

    try {
      const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const demandeRes = await axios.get(`${apiURL}/demandes/${demandeId}`, {
        withCredentials: true,
      });
      const demandeData = (demandeRes.data || {}) as DemandeDetail;
      const resolvedDemandeId = Number(demandeData?.id_demande ?? demandeId);
      const idProc = Number(demandeData?.id_proc || 0);

      const [
        substancesRes,
        documentsRes,
        etapesRes,
        verificationRes,
        coordsRes,
        factureRes,
        demandeProcRes,
        inscriptionRes,
        logoDataUrl,
      ] = await Promise.all([
        axios
          .get(`${apiURL}/api/substances/demande/${resolvedDemandeId}/substances`, {
            withCredentials: true,
          })
          .catch(() => null),
        axios
          .get(`${apiURL}/api/procedure/${resolvedDemandeId}/documents`, {
            withCredentials: true,
          })
          .catch(() => null),
        idProc > 0
          ? axios
              .get(`${apiURL}/api/procedure-etape/procedure/${idProc}`, {
                withCredentials: true,
              })
              .catch(() => null)
          : Promise.resolve(null),
        axios
          .get(`${apiURL}/verification-geo/demande/${resolvedDemandeId}`, {
            withCredentials: true,
          })
          .catch(() => null),
        idProc > 0
          ? axios
              .get(`${apiURL}/coordinates/procedure/${idProc}`, {
                withCredentials: true,
              })
              .catch(() => null)
          : Promise.resolve(null),
        axios
          .get(`${apiURL}/api/facture/demande/${resolvedDemandeId}`, {
            withCredentials: true,
          })
          .catch(() => null),
        idProc > 0
          ? axios
              .get(`${apiURL}/api/procedures/${idProc}/demande`, {
                withCredentials: true,
              })
              .catch(() => null)
          : Promise.resolve(null),
        idProc > 0
          ? axios
              .get(`${apiURL}/inscription-provisoire/procedure/${idProc}`, {
                withCredentials: true,
              })
              .catch(() => null)
          : Promise.resolve(null),
        loadImageAsDataUrl("/anamlogo.png"),
      ]);

      const primaryCommune =
        demandeData.commune?.nom_communeFR ||
        demandeData.communes?.find((item) => item.principale)?.commune
          ?.nom_communeFR ||
        demandeData.communes?.[0]?.commune?.nom_communeFR ||
        "--";

      const primaryDaira =
        demandeData.daira?.nom_dairaFR ||
        demandeData.communes?.find((item) => item.principale)?.commune?.daira
          ?.nom_dairaFR ||
        demandeData.communes?.[0]?.commune?.daira?.nom_dairaFR ||
        "--";

      const primaryWilaya =
        demandeData.wilaya?.nom_wilayaFR ||
        demandeData.communes?.find((item) => item.principale)?.commune?.daira
          ?.wilaya?.nom_wilayaFR ||
        demandeData.communes?.[0]?.commune?.daira?.wilaya?.nom_wilayaFR ||
        "--";

      const verifSurfaceValues = extractSurfaceValues(verificationRes?.data);
      const demandeProcSurfaceValues = extractSurfaceValues(demandeProcRes?.data);
      const inscriptionSurfaceValues = extractSurfaceValues(inscriptionRes?.data);
      const demandeSurfaceValues = extractSurfaceValues(demandeData);

      const superficie = pickFirstNumber(
        verificationRes?.data?.superficie_cadastrale,
        verificationRes?.data?.superficie_cadastrale_ha,
        verificationRes?.data?.superficie,
        verificationRes?.data?.surface,
        ...verifSurfaceValues,
        demandeData.superficie,
        demandeData.superficie_ha,
        demandeData.superficieHa,
        demandeData.surface,
        ...demandeSurfaceValues,
        ...demandeProcSurfaceValues,
        ...inscriptionSurfaceValues,
      );

      const superficieSource =
        typeof superficie !== "number"
          ? "--"
          : verifSurfaceValues.includes(superficie) ||
            toNumber(verificationRes?.data?.superficie_cadastrale) === superficie ||
            toNumber(verificationRes?.data?.superficie) === superficie
          ? "Verification geospatiale"
          : demandeProcSurfaceValues.includes(superficie)
          ? "Procedure liee"
          : inscriptionSurfaceValues.includes(superficie)
          ? "Inscription provisoire"
          : "Demande";

      const typePermisLabel =
        demandeData.typePermis?.lib_type || demandeData.typePermis?.code_type || "--";
      const typeProcedureLabel = demandeData.typeProcedure?.libelle || "--";
      const codeDemande =
        demandeData.code_demande || `DEM-${resolvedDemandeId}`;
      const statutDemande = safeText(demandeData.statut_demande, "EN_COURS");
      const titulaire =
        demandeData.detenteur?.nom_societeFR ||
        demandeData.detenteur?.nom_societeAR ||
        "--";
      const dateDepot = formatDate(
        demandeData.date_demande || demandeData.procedure?.date_debut_proc || null,
      );

      const substancesPayload = Array.isArray(substancesRes?.data)
        ? substancesRes?.data
        : [];
      const substanceRows = substancesPayload.map((item: any, idx: number) => [
        String(idx + 1),
        safeText(item?.nom_subFR || item?.nom_subAR || item?.code_sub),
        safeText(item?.code_sub),
      ]);

      const documentsPayload = Array.isArray(documentsRes?.data?.documents)
        ? documentsRes?.data?.documents
        : [];
      const dossierDate = documentsRes?.data?.dossierFournis?.date_depot ?? null;
      const documentRows = documentsPayload.map((doc: any, idx: number) => [
        String(idx + 1),
        safeText(doc?.nom_doc),
        safeText(doc?.statut),
        safeText(doc?.taille_doc),
        formatDate(dossierDate),
      ]);

      const etapesPayload = Array.isArray(etapesRes?.data?.ProcedureEtape)
        ? etapesRes?.data?.ProcedureEtape
        : [];
      const etapesRows = etapesPayload.map((etape: any, idx: number) => [
        String(idx + 1),
        safeText(etape?.etape?.lib_etape || `Etape ${idx + 1}`),
        safeText(etape?.statut),
        formatDate(etape?.date_debut),
        formatDate(etape?.date_fin),
      ]);

      const coordPayload = Array.isArray(coordsRes?.data) ? coordsRes?.data : [];
      const parsedCoords = coordPayload
        .map((item: any, idx: number) => {
          const coord = item?.coordonnee ?? item;
          const x = toNumber(coord?.x);
          const y = toNumber(coord?.y);
          if (x === null || y === null) return null;
          return {
            idx: idx + 1,
            x,
            y,
            zone: safeText(coord?.zone, "--"),
            system: safeText(coord?.system, "UTM"),
          };
        })
        .filter(Boolean) as Array<{
        idx: number;
        x: number;
        y: number;
        zone: string;
        system: string;
      }>;

      const coordRows = parsedCoords.map((point) => [
        String(point.idx),
        point.x.toFixed(3),
        point.y.toFixed(3),
        point.zone,
        point.system,
      ]);

      const facture = factureRes?.data?.facture ?? null;
      const factureRows = facture
        ? [
            ["Numero facture", safeText(facture.id_facture)],
            [
              "Montant total",
              facture.montant_total != null
                ? `${Number(facture.montant_total).toLocaleString("fr-FR")} DZD`
                : "--",
            ],
            ["Statut paiement", safeText(facture.statut)],
            ["Date emission", formatDate(facture.date_emission)],
          ]
        : [["Facture", "Aucune facture disponible"]];

      const doc = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(125, 38, 74);
      doc.rect(0, 0, pageWidth, 32, "F");
      doc.setFillColor(42, 157, 143);
      doc.rect(0, 32, pageWidth, 2, "F");

      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", 14, 5, 22, 22);
        } catch {
          // Ignore logo rendering failure and continue.
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.text("PORTAIL ANAM", 40, 12);
      doc.setFontSize(12);
      doc.text("Recapitulatif professionnel de la demande", 40, 19);

      doc.setFontSize(9.5);
      doc.text(`Code: ${codeDemande}`, pageWidth - 14, 11, { align: "right" });
      doc.text(`Date: ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 17, {
        align: "right",
      });
      doc.text(`Reference interne: #${resolvedDemandeId}`, pageWidth - 14, 23, {
        align: "right",
      });

      let currentY = 40;
      const marginX = 14;
      const bodyWidth = pageWidth - marginX * 2;

      const addSectionTitle = (title: string) => {
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 18;
        }
        doc.setFillColor(234, 247, 245);
        doc.roundedRect(marginX, currentY - 4, bodyWidth, 8, 2, 2, "F");
        doc.setTextColor(93, 31, 58);
        doc.setFontSize(11);
        doc.text(title, marginX + 2, currentY + 1);
        currentY += 8;
      };

      const runTable = (head: string[][], body: string[][]) => {
        autoTable(doc, {
          startY: currentY,
          margin: { left: marginX, right: marginX },
          head,
          body,
          theme: "grid",
          headStyles: {
            fillColor: [42, 157, 143],
            textColor: [255, 255, 255],
            fontSize: 9,
          },
          styles: {
            fontSize: 8.5,
            cellPadding: 2.2,
            textColor: [39, 39, 42],
          },
          alternateRowStyles: { fillColor: [248, 251, 250] },
        });
        currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 6;
      };

      addSectionTitle("Informations generales");
      runTable(
        [["Champ", "Valeur"]],
        [
          ["Code demande", codeDemande],
          ["Statut", statutDemande],
          ["Type permis", safeText(typePermisLabel)],
          ["Type procedure", safeText(typeProcedureLabel)],
          ["Date depot", dateDepot],
          ["Titulaire", safeText(titulaire)],
          ["Wilaya", safeText(primaryWilaya)],
          ["Daira", safeText(primaryDaira)],
          ["Commune", safeText(primaryCommune)],
          ["Lieu-dit", safeText(demandeData.lieu_ditFR)],
          [
            "Superficie",
            typeof superficie === "number" ? `${superficie.toFixed(2)} ha` : "--",
          ],
          ["Source superficie", superficieSource],
        ],
      );

      addSectionTitle("Substances");
      runTable(
        [["#", "Substance", "Code"]],
        substanceRows.length > 0 ? substanceRows : [["1", "Aucune substance", "--"]],
      );

      addSectionTitle("Perimetre et coordonnees");
      runTable(
        [["Point", "X", "Y", "Zone", "Systeme"]],
        coordRows.length > 0
          ? coordRows
          : [["--", "--", "--", "--", "Aucune coordonnee disponible"]],
      );

      addSectionTitle("Documents fournis");
      runTable(
        [["#", "Document", "Statut", "Taille", "Date depot"]],
        documentRows.length > 0
          ? documentRows
          : [["1", "Aucun document", "--", "--", "--"]],
      );

      addSectionTitle("Historique de traitement");
      runTable(
        [["#", "Etape", "Statut", "Date debut", "Date fin"]],
        etapesRows.length > 0
          ? etapesRows
          : [["1", "Aucune etape", "--", "--", "--"]],
      );

      addSectionTitle("Paiement");
      runTable([["Champ", "Valeur"]], factureRows);

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text(
          "Document genere automatiquement par le Portail ANAM.",
          marginX,
          pageHeight - 8,
        );
        doc.text(
          `Page ${page}/${pageCount}`,
          pageWidth - marginX,
          pageHeight - 8,
          { align: "right" },
        );
      }

      const fileName = `demande_${toFileSafe(codeDemande)}.pdf`;
      doc.save(fileName);
      toast.success("PDF de la demande genere avec succes.");
    } catch (err) {
      console.error("Erreur generation PDF demande", err);
      toast.error("Impossible de generer le PDF de la demande.");
    } finally {
      setPdfLoadingId(null);
    }
  };

  return (
    <InvestorLayout>
      <div className={styles.container}>
        {/* Hero Header */}
        <div className={styles.heroHeader}>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <div className={styles.heroLabel}>
                <Sparkles className="w-4 h-4" />
                <span>Portail Investisseur</span>
              </div>
              <h1 className={styles.heroTitle}>Mes Demandes</h1>
              <p className={styles.heroSubtitle}>
                Suivez l'état de vos demandes de permis miniers en temps réel
              </p>
            </div>
            <div className={styles.heroActions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/investisseur/InvestorDashboard")}
                className={styles.dashboardButton}
                size="lg"
              >
                <ArrowLeft className="w-5 h-5" />
                Retour au dashboard
              </Button>
              <Button 
                onClick={() => navigate('/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis')} 
                className={styles.newButton}
                size="lg"
              >
                <Plus className="w-5 h-5" />
                Nouvelle demande
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FileText className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.total}</span>
                <span className={styles.statLabel}>Total</span>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statWarning}`}>
              <div className={styles.statIcon}>
                <Clock className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.enCours}</span>
                <span className={styles.statLabel}>En cours</span>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statSuccess}`}>
              <div className={styles.statIcon}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.acceptees}</span>
                <span className={styles.statLabel}>Acceptées</span>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statDanger}`}>
              <div className={styles.statIcon}>
                <XCircle className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.rejetees}</span>
                <span className={styles.statLabel}>Rejetées</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <Card className={styles.filtersCard}>
          <CardContent className={styles.filtersContent}>
            <div className={styles.filtersHeader}>
              <div className={styles.filtersTitle}>
                <Filter className="w-4 h-4" />
                <span>Filtres</span>
              </div>
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${viewMode === "grid" ? styles.active : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Vue grille"
                  aria-label="Vue grille"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${viewMode === "list" ? styles.active : ""}`}
                  onClick={() => setViewMode("list")}
                  title="Vue liste"
                  aria-label="Vue liste"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className={styles.filtersGrid}>
              <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} />
                <Input
                  placeholder="Rechercher par code, type ou wilaya..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
                <button
                  type="button"
                  className={styles.searchBtn}
                  aria-label="Rechercher"
                >
                  <Search className="w-4 h-4" />
                  <span>Rechercher</span>
                </button>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Statut" className={styles.selectValue} />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem className={styles.selectItem} value="tous">
                    Tous les statuts
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="EN_COURS">
                    En cours
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="EN_ATTENTE">
                    En attente
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="ACCEPTEE">
                    Acceptée
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="REJETEE">
                    Rejetée
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Type de permis" className={styles.selectValue} />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem className={styles.selectItem} value="tous">
                    Tous les types
                  </SelectItem>
                  {typeOptions.map((type) => (
                    <SelectItem className={styles.selectItem} key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className={styles.dateField}>
                <span className={styles.dateLabel}>Du</span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={styles.dateInput}
                />
              </div>
              <div className={styles.dateField}>
                <span className={styles.dateLabel}>Au</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={styles.dateInput}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className={styles.resultsInfo}>
          {!isLoading && !error && (
            <span className={styles.resultsCount}>
              {filteredDemandes.length} demande{filteredDemandes.length !== 1 ? 's' : ''} trouvée{filteredDemandes.length !== 1 ? 's' : ''}
            </span>
          )}
          {error && <span className={styles.errorText}>{error}</span>}
        </div>

        {viewMode === "grid" ? (
          <div className={styles.demandesGrid}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <Card
                  key={`skeleton-${index}`}
                  className={`${styles.demandeCard} ${styles.skeletonCard}`}
                >
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                </Card>
              ))
            ) : (
              paginatedDemandes.map((demande, index) => {
                const statutValue = demande.statut_demande || "EN_COURS";
                const statutConfig = getStatutConfig(statutValue);
                const StatusIcon = statutConfig.icon;
                const typeLabel =
                  demande.typePermis?.lib_type ||
                  demande.typePermis?.code_type ||
                  "Permis";
                const codeLabel = demande.code_demande || `DEM-${demande.id_demande}`;
                const locationLabel =
                  demande.wilaya?.nom_wilayaFR ||
                  demande.commune?.nom_communeFR ||
                  "???";
                const dateStr = resolveDate(demande);
                const dateLabel = dateStr
                  ? new Date(dateStr).toLocaleDateString("fr-FR")
                  : "--";
                const progression =
                  typeof (demande as any).progression === "number"
                    ? (demande as any).progression
                    : null;

                return (
                  <Card
                    key={demande.id_demande}
                    className={styles.demandeCard}
                    style={{ animationDelay: `${index * 0.08}s` }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardType}>
                        <span className={styles.typeEmoji}>
                          {getTypeIcon(typeLabel)}
                        </span>
                        <span className={styles.typeName}>{typeLabel}</span>
                      </div>
                      <div className={`${styles.statusBadge} ${statutConfig.className}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statutConfig.label}</span>
                      </div>
                    </div>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardCode}>{codeLabel}</h3>

                      <div className={styles.cardMeta}>
                        <div className={styles.metaItem}>
                          <MapPin className="w-4 h-4" />
                          <span>{locationLabel}</span>
                        </div>
                        <div className={styles.metaItem}>
                          <Calendar className="w-4 h-4" />
                          <span>{dateLabel}</span>
                        </div>
                      </div>

                      {statutValue === "EN_COURS" && typeof progression === "number" && (
                        <div className={styles.progressSection}>
                          <div className={styles.progressHeader}>
                            <span>Progression</span>
                            <span className={styles.progressValue}>{progression}%</span>
                          </div>
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${progression}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={styles.downloadBtn}
                        disabled={pdfLoadingId === demande.id_demande}
                        onClick={() => handleDownloadPdf(demande.id_demande)}
                      >
                        {pdfLoadingId === demande.id_demande ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        {pdfLoadingId === demande.id_demande ? "Generation..." : "PDF"}
                      </Button>
                      <Button
                        onClick={() =>
                          navigate(`/investisseur/demandes/${demande.short_code || demande.id_demande}`)
                        }
                        className={styles.viewBtn}
                        size="sm"
                      >
                        <Eye className="w-4 h-4" />
                        Voir détails
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          <div className={styles.demandesList}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <Card
                  key={`skeleton-list-${index}`}
                  className={`${styles.demandeCard} ${styles.demandeCardList} ${styles.skeletonCard}`}
                >
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                </Card>
              ))
            ) : (
              paginatedDemandes.map((demande, index) => {
                const statutValue = demande.statut_demande || "EN_COURS";
                const statutConfig = getStatutConfig(statutValue);
                const StatusIcon = statutConfig.icon;
                const typeLabel =
                  demande.typePermis?.lib_type ||
                  demande.typePermis?.code_type ||
                  "Permis";
                const codeLabel =
                  demande.code_demande || `DEM-${demande.id_demande}`;
                const locationLabel =
                  demande.wilaya?.nom_wilayaFR ||
                  demande.commune?.nom_communeFR ||
                  "--";
                const dateStr = resolveDate(demande);
                const dateLabel = dateStr
                  ? new Date(dateStr).toLocaleDateString("fr-FR")
                  : "--";

                return (
                  <Card
                    key={demande.id_demande}
                    className={`${styles.demandeCard} ${styles.demandeCardList}`}
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    <span className={`${styles.statusBadge} ${statutConfig.className}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statutConfig.label}
                    </span>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardCode}>{codeLabel}</h3>

                      <div className={styles.cardMeta}>
                        <div className={styles.metaItem}>
                          <span className={styles.typeEmoji}>{getTypeIcon(typeLabel)}</span>
                          <span>{typeLabel}</span>
                        </div>
                        <div className={styles.metaItem}>
                          <MapPin className="w-4 h-4" />
                          <span>{locationLabel}</span>
                        </div>
                        <div className={styles.metaItem}>
                          <Calendar className="w-4 h-4" />
                          <span>{dateLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={styles.downloadBtn}
                        disabled={pdfLoadingId === demande.id_demande}
                        onClick={() => handleDownloadPdf(demande.id_demande)}
                      >
                        {pdfLoadingId === demande.id_demande ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        {pdfLoadingId === demande.id_demande ? "Generation..." : "PDF"}
                      </Button>
                      <Button
                        onClick={() =>
                          navigate(`/investisseur/demandes/${demande.short_code || demande.id_demande}`)
                        }
                        className={styles.viewBtn}
                        size="sm"
                      >
                        <Eye className="w-4 h-4" />
                        Détails
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {!isLoading && !error && filteredDemandes.length > pageSize && (
          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageButton}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Précédent
            </button>
            <span className={styles.pageInfo}>
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
            >
              Suivant
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredDemandes.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FileText className="w-12 h-12" />
            </div>
            <h3>Aucune demande trouvée</h3>
            <p>Modifiez vos filtres ou créez une nouvelle demande</p>
            <Button 
              onClick={() => navigate('/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis')}
              className={styles.newButton}
            >
              <Plus className="w-4 h-4" />
              Nouvelle demande
            </Button>
          </div>
        )}
      </div>
    </InvestorLayout>
  );
};

export default DemandesList;

