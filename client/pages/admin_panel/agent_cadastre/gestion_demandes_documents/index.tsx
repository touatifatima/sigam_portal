import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FileText,
  Filter, RefreshCcw, RotateCcw, Search, Users, X, Clock3,
} from "lucide-react";
import { toast } from "react-toastify";
import Navbar from "@/pages/navbar/Navbar";
import Sidebar from "@/pages/sidebar/Sidebar";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useViewNavigator } from "@/src/hooks/useViewNavigator";
import { getDefaultDashboardPath, isAdminRole, normalizeRoles } from "@/src/utils/roleNavigation";
import {
  buildApiUrl, type AdminListResponse, type AdminStats, type CadastreDocumentRequest,
  documentLabel, displayName, formatDateTime, handleApiError, organizationName, statusClass, statusLabel,
} from "./shared";
import styles from "./gestion_demandes_documents.module.css";

const PAGE_SIZE = 10;

type MultiFilterOption = { value: string; label: string; color?: string };

function MultiFilterDropdown({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: MultiFilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleValue = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div className={styles.filterDropdown}>
      <button type="button" className={`${styles.dropdownButton} ${values.length ? styles.dropdownButtonActive : ""} ${open ? styles.dropdownButtonOpen : ""}`} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        {label}{values.length > 0 && <span className={styles.filterCount}>{values.length}</span>}<ChevronDown size={14} />
      </button>
      {open && <div className={styles.dropdownPanel}>
        <div className={styles.dropdownOptions}>
          {options.map((option) => (
            <label className={styles.dropdownOption} key={option.value}>
              <input type="checkbox" checked={values.includes(option.value)} onChange={() => toggleValue(option.value)} />
              {option.color && <span className={styles.optionSwatch} style={{ background: option.color }} />}
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <div className={styles.dropdownFooter}>
          <button type="button" className={styles.clearFilterButton} onClick={() => onChange([])}>Effacer</button>
          <button type="button" className={styles.applyFilterButton} onClick={() => setOpen(false)}>Appliquer</button>
        </div>
      </div>}
    </div>
  );
}

function initials(item: CadastreDocumentRequest) {
  const name = displayName(item).split(/\s+/).filter(Boolean);
  return (name[0]?.[0] || "?") + (name[1]?.[0] || "");
}

export default function GestionDemandesDocumentsPage() {
  const navigate = useNavigate();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();
  const [items, setItems] = useState<CadastreDocumentRequest[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [requestId, setRequestId] = useState("");
  const [permitId, setPermitId] = useState("");
  const [emailDemandeur, setEmailDemandeur] = useState("");
  const [nomDemandeur, setNomDemandeur] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [typeDocument, setTypeDocument] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [societe, setSociete] = useState<string[]>([]);
  const [societeOptions, setSocieteOptions] = useState<MultiFilterOption[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const isAdmin = isAdminRole(auth?.role) || normalizeRoles(auth?.role).includes("agent_cadastre");
  const { navigateTo } = useViewNavigator("agent_cadastre_documents");

  useEffect(() => {
    if (!isAuthReady || !auth) return;
    if (!isAdmin) navigate(getDefaultDashboardPath(auth.role), { replace: true });
  }, [auth, isAdmin, isAuthReady, navigate]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await axios.get<AdminStats>(buildApiUrl("/api/cadastre/demandes-documents-cadastraux/admin/stats"), { withCredentials: true });
      setStats(response.data);
      setSocieteOptions((response.data.societes || []).map((value) => ({ value, label: value })));
    } catch (error) {
      toast.error(handleApiError(error, "Impossible de charger les statistiques."));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (requestId.trim()) params.set("referenceDemande", requestId.trim());
      if (permitId.trim()) params.set("codePermis", permitId.trim());
      if (emailDemandeur.trim()) params.set("emailDemandeur", emailDemandeur.trim());
      if (nomDemandeur.trim()) params.set("nomDemandeur", nomDemandeur.trim());
      if (status.length) params.set("statut", status.join(","));
      if (typeDocument.length) params.set("typeDocument", typeDocument.join(","));
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (societe.length) params.set("societe", societe.join(","));
      const response = await axios.get<AdminListResponse>(
        buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/admin/list?${params.toString()}`),
        { withCredentials: true },
      );
      setItems(response.data.items || []);
      setPages(Math.max(1, response.data.pages || 1));
      setTotal(response.data.total || 0);
      setSelected([]);
    } catch (error) {
      setItems([]);
      toast.error(handleApiError(error, "Impossible de charger les demandes cadastrales."));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, emailDemandeur, nomDemandeur, page, permitId, requestId, societe, status, typeDocument]);

  useEffect(() => {
    if (!isAuthReady || !isAdmin) return;
    void Promise.all([loadRequests(), loadStats()]);
  }, [isAdmin, isAuthReady, loadRequests, loadStats]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, emailDemandeur, nomDemandeur, permitId, requestId, societe, status, typeDocument]);

  const statsCards = useMemo(() => [
    { label: "Total demandes", value: stats?.total ?? 0, icon: Users, tone: "blue" },
    { label: "En attente", value: stats?.pending ?? 0, icon: Clock3, tone: "orange" },
    { label: "Acceptées", value: stats?.accepted ?? 0, icon: Check, tone: "green" },
    { label: "Refusées", value: stats?.rejected ?? 0, icon: X, tone: "red" },
    { label: "Délai moyen", value: `${stats?.averageProcessingDays ?? 0} j`, icon: Clock3, tone: "purple" },
    { label: "Documents générés", value: stats?.documentsGenerated ?? 0, icon: FileText, tone: "teal" },
  ], [stats]);

  const updateMany = async (nextStatus: "ACCEPTEE" | "REJETEE") => {
    if (selected.length === 0) return;
    try {
      await Promise.all(selected.map((id) => axios.post(
        buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${id}/admin/status`),
        { statut: nextStatus },
        { withCredentials: true },
      )));
      toast.success(`${selected.length} demande(s) mise(s) à jour.`);
      await Promise.all([loadRequests(), loadStats()]);
    } catch (error) {
      toast.error(handleApiError(error, "Certaines demandes n'ont pas pu être mises à jour."));
    }
  };

  const exportCsv = () => {
    const header = ["Référence", "Demandeur", "Société", "Type", "Statut", "Date"];
    const rows = items.map((item) => [
      item.referenceDemande, displayName(item), organizationName(item), documentLabel(item.typeDocument),
      statusLabel(item.statut), formatDateTime(item.dateDemande),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "demandes-documents-cadastraux.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleAll = () => {
    setSelected((current) => current.length === items.length ? [] : items.map((item) => item.id));
  };

  if (!isAuthReady || !auth || !isAdmin) {
    return <div className={styles.loading}><RefreshCcw className={styles.spin} size={20} /> Chargement de l’espace admin...</div>;
  }

  return (
    <div className={styles.shell}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView="agent_cadastre_documents" navigateTo={navigateTo} />
        <main className={styles.page}>
        <div className={styles.breadcrumb}><span>Dashboard</span><span>/</span><strong>Demandes de documents cadastraux</strong></div>
        <div className={styles.pageHead}>
          <div><h1>Gestion des demandes de documents cadastraux</h1><p>Consultez, filtrez et traitez toutes les demandes cadastrales.</p></div>
          <div className={styles.headActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => void Promise.all([loadRequests(), loadStats()])}><RefreshCcw size={16} /> Actualiser</button>
            <button type="button" className={styles.primaryButton} onClick={exportCsv}><Download size={16} /> Exporter</button>
          </div>
        </div>

        <div className={styles.statsGrid}>
          {statsCards.map(({ label, value, icon: Icon, tone }) => (
            <div className={styles.statCard} key={label}>
              <div className={`${styles.statIcon} ${styles[tone]}`}><Icon size={18} /></div>
              <div><span>{label}</span><strong>{statsLoading ? "—" : value}</strong></div>
            </div>
          ))}
        </div>

        <section className={styles.contentCard}>
          <div className={styles.filterBar}>
            <label className={styles.searchBox}><Search size={16} /><input value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="ID demande..." aria-label="Rechercher par ID demande" /></label>
            <label className={styles.searchBox}><Search size={16} /><input value={permitId} onChange={(event) => setPermitId(event.target.value)} placeholder="Code permis..." aria-label="Rechercher par code permis" /></label>
            <label className={styles.searchBox}><Search size={16} /><input value={emailDemandeur} onChange={(event) => setEmailDemandeur(event.target.value)} placeholder="Email demandeur..." aria-label="Rechercher par email du demandeur" /></label>
            <label className={styles.searchBox}><Search size={16} /><input value={nomDemandeur} onChange={(event) => setNomDemandeur(event.target.value)} placeholder="Nom demandeur..." aria-label="Rechercher par nom du demandeur" /></label>
            <button type="button" className={`${styles.filterButton} ${(status.length || typeDocument.length || societe.length || dateFrom || dateTo) ? styles.filterButtonActive : ""}`} onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters} aria-controls="advanced-document-filters"><Filter size={15} /> {showFilters ? "Masquer" : "Filtres"}</button>
            <button type="button" className={styles.resetButton} onClick={() => { setRequestId(""); setPermitId(""); setEmailDemandeur(""); setNomDemandeur(""); setStatus([]); setTypeDocument([]); setDateFrom(""); setDateTo(""); setSociete([]); }}><RotateCcw size={15} /> Réinitialiser</button>
            {showFilters && <div id="advanced-document-filters" className={styles.advancedFilters}>
            <div className={styles.dateRange}>
              <CalendarDays size={16} />
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Date de début" />
              <span>→</span>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} aria-label="Date de fin" />
            </div>
            <MultiFilterDropdown label="Statut" values={status} onChange={setStatus} options={[{ value: "ENREGISTREE", label: "En attente", color: "#d8892f" }, { value: "EN_COURS_EXAMEN", label: "En cours d'examen", color: "#3c7fb5" }, { value: "ACCEPTEE", label: "Acceptée", color: "#2f9b62" }, { value: "EN_COMPLEMENT", label: "Complément demandé", color: "#7a62c9" }, { value: "REJETEE", label: "Refusée", color: "#c95454" }, { value: "GENEREE", label: "Document généré", color: "#2f9b62" }, { value: "DELIVREE", label: "Délivrée", color: "#2f9b62" }]} />
            <MultiFilterDropdown label="Type de document" values={typeDocument} onChange={setTypeDocument} options={[{ value: "EXTRAIT_CERTIFIE_CONFORME", label: "Extraits cadastraux" }, { value: "PLAN_CADASTRAL_OFFICIEL", label: "Plans cadastraux" }]} />
            <MultiFilterDropdown label="Société" values={societe} onChange={setSociete} options={societeOptions} />
            </div>}
          </div>

          {selected.length > 0 && <div className={styles.bulkBar}><span>{selected.length} demande(s) sélectionnée(s)</span><div><button type="button" className={styles.bulkAccept} onClick={() => void updateMany("ACCEPTEE")}><Check size={15} /> Accepter</button><button type="button" className={styles.bulkReject} onClick={() => void updateMany("REJETEE")}><X size={15} /> Refuser</button><button type="button" className={styles.bulkClear} onClick={() => setSelected([])}>Annuler</button></div></div>}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th><input type="checkbox" checked={items.length > 0 && selected.length === items.length} onChange={toggleAll} aria-label="Sélectionner toutes les demandes" /></th><th>ID demande</th><th>Demandeur</th><th>Société</th><th>Type de document</th><th>Objet / permis</th><th>Statut</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className={styles.empty}><RefreshCcw className={styles.spin} size={20} /> Chargement...</td></tr> : items.length === 0 ? <tr><td colSpan={9} className={styles.empty}>Aucune demande trouvée.</td></tr> : items.map((item) => (
                  <tr key={item.id}>
                    <td><input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} aria-label={`Sélectionner ${item.referenceDemande}`} /></td>
                    <td><button className={styles.reference} type="button" onClick={() => navigate(`/admin_panel/agent_cadastre/gestion_demandes_documents/${item.id}`)}>{item.referenceDemande}</button></td>
                    <td><div className={styles.userCell}><span className={styles.avatar}>{initials(item)}</span><span><strong>{displayName(item)}</strong><small>{item.emailContact || item.utilisateur?.email || "—"}</small></span></div></td>
                    <td>{organizationName(item)}</td>
                    <td>{documentLabel(item.typeDocument)}</td>
                    <td><strong>{item.codePermis || item.permis?.code_permis || "—"}</strong><small>{item.objetDemande || "Demande cadastrale"}</small></td>
                    <td><span className={`${styles.status} ${styles[statusClass(item.statut)]}`}><i />{statusLabel(item.statut)}</span></td>
                    <td className={styles.date}>{formatDateTime(item.dateDemande)}</td>
                    <td><button type="button" className={styles.iconButton} onClick={() => navigate(`/admin_panel/agent_cadastre/gestion_demandes_documents/${item.id}`)} aria-label={`Voir ${item.referenceDemande}`}><Eye size={17} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}><span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} sur ${total} demandes` : "0 demande"}</span><div className={styles.pagination}><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>Page {page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div>
        </section>
        </main>
      </div>
    </div>
  );
}
