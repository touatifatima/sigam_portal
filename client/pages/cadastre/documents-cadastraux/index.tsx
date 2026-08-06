import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  FileText,
  Filter,
  LayoutDashboard,
  Map as MapIcon,
  RefreshCcw,
  Search,
  FileCheck2,
  Headset,
  Settings,
  X,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { useAuthStore } from "@/src/store/useAuthStore";
import { getDefaultDashboardPath, isCadastreRole } from "@/src/utils/roleNavigation";
import styles from "./DocumentsCadastraux.module.css";

const apiURL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const buildApiUrl = (path: string) => `${apiURL}${path}`;

type CadastreDocumentItem = {
  id: number;
  referenceDemande: string;
  typeDocument?: string | null;
  statut?: string | null;
  createdAt?: string | null;
  dateSoumission?: string | null;
  accuseReceptionPdfUrl?: string | null;
  accuseReceptionPdfFilename?: string | null;
  titulaire?: string | null;
  numeroRc?: string | null;
  codePermis?: string | null;
  qrCodeTitre?: string | null;
  nin?: string | null;
  nom?: string | null;
  prenom?: string | null;
  emailContact?: string | null;
  telephoneContact?: string | null;
  qualiteDemandeur?: string | null;
  objetDemande?: string | null;
  baseCommunication?: string | null;
  typePermis?: string | null;
};

type DocumentFilter = "ALL" | "EXTRAIT" | "PLAN";
type StatusFilter = "ALL" | "ENREGISTREE" | "VERIFIEE" | "GENEREE" | "DELIVREE";
type SortMode = "recent" | "oldest";

const statAccentClasses = [styles.statGreen, styles.statBlue, styles.statPurple, styles.statOrange];

const navItems = [
  { label: "Dashboard", href: "/cadastre/dashboard", icon: LayoutDashboard, active: false },
  { label: "Documents cadastraux", href: "/cadastre/documents-cadastraux", icon: FileText, active: true },
  { label: "Demandes", href: "/cadastre/documents-cadastraux", icon: FileCheck2, active: false },
  { label: "Carte cadastrale", href: "/cadastre/carte-cadastrale", icon: MapIcon, active: false },
  { label: "Profil & paramètres", href: "/cadastre/dashboard", icon: Settings, active: false },
  { label: "Centre d'aide", href: "/cadastre/dashboard", icon: CircleHelp, active: false },
];

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR");
}

function normalize(text?: string | null) {
  return String(text || "").trim().toLowerCase();
}

function getTypeKey(item: CadastreDocumentItem): "EXTRAIT" | "PLAN" {
  return String(item.typeDocument || "").includes("PLAN")
    ? "PLAN"
    : "EXTRAIT";
}

function getTypeLabel(item: CadastreDocumentItem) {
  return getTypeKey(item) === "PLAN" ? "Plan cadastral" : "Extrait cadastral";
}

function getTypePillClass(item: CadastreDocumentItem) {
  return getTypeKey(item) === "PLAN" ? styles.pillBlue : styles.pillPurple;
}

function getStatutLabel(item: CadastreDocumentItem) {
  const value = String(item.statut || "").toUpperCase();
  if (value === "DELIVREE") return "Disponible";
  if (value === "GENEREE") return "Généré";
  if (value === "VERIFIEE") return "Vérifiée";
  return "Enregistrée";
}

function getStatutTone(item: CadastreDocumentItem) {
  const value = String(item.statut || "").toUpperCase();
  if (value === "DELIVREE" || value === "GENEREE") return styles.statusOk;
  if (value === "VERIFIEE") return styles.statusWarn;
  return styles.statusPending;
}

export default function DocumentsCadastrauxPage() {
  const navigate = useNavigate();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CadastreDocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;

    if (!auth?.id && !auth?.email && !auth?.username) {
      navigate("/", { replace: true });
      return;
    }

    if (!isCadastreRole(auth?.role)) {
      navigate(getDefaultDashboardPath(auth?.role), { replace: true });
    }
  }, [auth?.email, auth?.id, auth?.role, auth?.username, isAuthReady, navigate]);

  useEffect(() => {
    if (!isAuthReady || !isCadastreRole(auth?.role)) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await axios.get<{ items?: CadastreDocumentItem[] }>(
          buildApiUrl("/api/cadastre/demandes-documents-cadastraux"),
          { withCredentials: true },
        );
        if (!active) return;
        setItems(response.data.items || []);
      } catch (error) {
        console.error("[DocumentsCadastraux] failed to load requests", error);
        if (!active) return;
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [auth?.role, isAuthReady]);

  const filteredItems = useMemo(() => {
    const q = normalize(search);
    const now = Date.now();
    const periodDays =
      "ALL" === "ALL"
        ? null
        : null;

    const filtered = items.filter((item) => {
      const typeKey = getTypeKey(item);
      const statusKey = String(item.statut || "").toUpperCase();
      const createdAt = item.dateSoumission || item.createdAt;
      const createdTs = createdAt ? new Date(createdAt).getTime() : NaN;

      const matchesSearch =
        !q ||
        normalize(item.referenceDemande).includes(q) ||
        normalize(item.titulaire).includes(q) ||
        normalize(item.codePermis).includes(q) ||
        normalize(item.numeroRc).includes(q) ||
        normalize(item.objetDemande).includes(q);

      const matchesType = typeFilter === "ALL" || typeKey === typeFilter;
      const matchesStatus = statusFilter === "ALL" || statusKey === statusFilter;
      const matchesPeriod =
        !periodDays ||
        (Number.isFinite(createdTs) && now - createdTs <= periodDays * 24 * 60 * 60 * 1000);

      return matchesSearch && matchesType && matchesStatus && matchesPeriod;
    });

    filtered.sort((a, b) => {
      const ad = new Date(a.dateSoumission || a.createdAt || 0).getTime();
      const bd = new Date(b.dateSoumission || b.createdAt || 0).getTime();
      return sortMode === "recent" ? bd - ad : ad - bd;
    });

    return filtered;
  }, [items, search, sortMode, statusFilter, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortMode, statusFilter, typeFilter, pageSize]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    const stillVisible = filteredItems.some((item) => item.id === selectedId);
    if (!stillVisible) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [currentPage, filteredItems, pageSize]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const selectedItem = useMemo(
    () => paginatedItems.find((item) => item.id === selectedId) || paginatedItems[0] || null,
    [paginatedItems, selectedId],
  );

  const stats = useMemo(() => {
    const total = items.length;
    const plans = items.filter((item) => getTypeKey(item) === "PLAN").length;
    const extraits = items.filter((item) => getTypeKey(item) === "EXTRAIT").length;
    const disponibles = items.filter((item) =>
      ["DELIVREE", "GENEREE"].includes(String(item.statut || "").toUpperCase()),
    ).length;
    return { total, plans, extraits, disponibles };
  }, [items]);

  const activeFiltersCount = [typeFilter !== "ALL", statusFilter !== "ALL", search.trim().length > 0].filter(Boolean)
    .length;

  const receiptUrl = selectedItem
    ? buildApiUrl(
        selectedItem.accuseReceptionPdfUrl ||
          `/api/cadastre/demandes-documents-cadastraux/${selectedItem.id}/accuse-reception`,
      )
    : "";

  const handleOpen = (item: CadastreDocumentItem, mode: "preview" | "download") => {
    const url = buildApiUrl(
      item.accuseReceptionPdfUrl ||
        `/api/cadastre/demandes-documents-cadastraux/${item.id}/accuse-reception`,
    );
    if (mode === "download") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setSortMode("recent");
  };

  if (!isAuthReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <InvestorLayout>
      <main className={styles.app}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <FileText size={18} />
            </div>
            <div className={styles.brandText}>
              <div className={styles.brandLineOne}>CADASTRE NATIONAL</div>
              <div className={styles.brandLineTwo}>DES ACTIVITÉS MINIÈRES</div>
            </div>
          </div>

          <div className={styles.navSectionLabel}>TABLEAU DE BORD</div>
          {navItems.slice(0, 1).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={styles.navItem}
                onClick={() => navigate(item.href)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className={styles.navSectionLabel}>SERVICES CADASTRAUX</div>
          {navItems.slice(1, 6).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`${styles.navItem} ${item.active ? styles.navItemActive : ""}`}
                onClick={() => navigate(item.href)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className={styles.navSectionLabel}>COMPTE &amp; ABONNEMENT</div>
          <button type="button" className={styles.navItem} onClick={() => navigate("/cadastre/dashboard")}>
            <Settings size={16} />
            <span>Profil &amp; paramètres</span>
          </button>

          <div className={styles.navSectionLabel}>SUPPORT</div>
          <button type="button" className={styles.navItem}>
            <CircleHelp size={16} />
            <span>Centre d&apos;aide</span>
          </button>
          <button type="button" className={styles.navItem}>
            <Headset size={16} />
            <span>Nous contacter</span>
          </button>

          <div className={styles.helpCard}>
            <div className={styles.helpIcon}>
              <Headset size={18} />
            </div>
            <h4>Besoin d&apos;aide ?</h4>
            <p>Notre équipe est disponible 24h/7j pour vous accompagner.</p>
            <button type="button" onClick={() => navigate("/cadastre/dashboard")}>
              Contacter le support
            </button>
          </div>
        </aside>

        <section className={styles.main}>
          <div className={styles.content}>
            <div className={styles.contentLeft}>
              <div className={styles.pageHead}>
                <h1>Documents cadastraux</h1>
                <p>Consultez, téléchargez et gérez vos demandes récentes et accusés de réception.</p>
              </div>

              <div className={styles.pageHeadActions}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => navigate(getDefaultDashboardPath(auth?.role), { replace: true })}
                >
                  <LayoutDashboard size={16} />
                  Retour au dashboard
                </button>
              </div>
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${statAccentClasses[0]}`}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className={styles.statLabel}>Total des demandes</div>
                    <div className={styles.statValue}>{stats.total}</div>
                    <div className={styles.statUnit}>demandes</div>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${statAccentClasses[1]}`}>
                    <FileCheck2 size={18} />
                  </div>
                  <div>
                    <div className={styles.statLabel}>Accusés disponibles</div>
                    <div className={styles.statValue}>{stats.disponibles}</div>
                    <div className={styles.statUnit}>fichiers prêts</div>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${statAccentClasses[2]}`}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className={styles.statLabel}>Extraits cadastraux</div>
                    <div className={styles.statValue}>{stats.extraits}</div>
                    <div className={styles.statUnit}>demandes</div>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${statAccentClasses[3]}`}>
                    <MapIcon size={18} />
                  </div>
                  <div>
                    <div className={styles.statLabel}>Plans cadastraux</div>
                    <div className={styles.statValue}>{stats.plans}</div>
                    <div className={styles.statUnit}>demandes</div>
                  </div>
                </div>
              </div>

              <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Rechercher une demande, une référence..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <button type="button" className={styles.toolBtn}>
                  <Filter size={15} />
                  Filtres avancés
                  <span className={styles.countPill}>{activeFiltersCount}</span>
                </button>
                <button type="button" className={styles.toolBtn} onClick={resetFilters}>
                  <RefreshCcw size={15} />
                  Réinitialiser
                </button>
              </div>

              <div className={styles.filterRow}>
                <div className={styles.filterField}>
                  <label>Type de document</label>
                  <div className={styles.filterSelectWrapper}>
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DocumentFilter)}>
                      <option value="ALL">Tous les types</option>
                      <option value="EXTRAIT">Extrait cadastral</option>
                      <option value="PLAN">Plan cadastral</option>
                    </select>
                    <ChevronDown size={12} />
                  </div>
                </div>
                <div className={styles.filterField}>
                  <label>Catégorie</label>
                  <div className={styles.filterSelectWrapper}>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    >
                      <option value="ALL">Toutes les catégories</option>
                      <option value="ENREGISTREE">Demandes enregistrées</option>
                      <option value="VERIFIEE">Demandes vérifiées</option>
                      <option value="GENEREE">Demandes générées</option>
                      <option value="DELIVREE">Demandes délivrées</option>
                    </select>
                    <ChevronDown size={12} />
                  </div>
                </div>
                <div className={styles.filterField}>
                  <label>Titre / Référence</label>
                  <div className={styles.filterSelectWrapper}>
                    <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                      <option value="recent">Tous les titres</option>
                      <option value="oldest">Titres plus anciens</option>
                    </select>
                    <ChevronDown size={12} />
                  </div>
                </div>
                <div className={styles.filterField}>
                  <label>Statut</label>
                  <div className={styles.filterSelectWrapper}>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                      <option value="ALL">Tous les statuts</option>
                      <option value="ENREGISTREE">Enregistrée</option>
                      <option value="VERIFIEE">Vérifiée</option>
                      <option value="GENEREE">Générée</option>
                      <option value="DELIVREE">Disponible</option>
                    </select>
                    <ChevronDown size={12} />
                  </div>
                </div>
                <div className={styles.filterField}>
                  <label>Période</label>
                  <div className={styles.filterSelectWrapper}>
                    <select defaultValue="all">
                      <option value="all">Du - Au</option>
                      <option value="7">7 derniers jours</option>
                      <option value="30">30 derniers jours</option>
                      <option value="90">90 derniers jours</option>
                    </select>
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>

              <div className={styles.tableCard}>
                <div className={styles.tableHeadRow}>
                  <div className={styles.resultsCount}>{filteredItems.length} demandes trouvées</div>
                  <div className={styles.sortControls}>
                    <span>Trier par :</span>
                    <div className={styles.sortSelect}>
                      <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                        <option value="recent">Date (plus récent)</option>
                        <option value="oldest">Date (plus ancienne)</option>
                      </select>
                      <ChevronDown size={10} />
                    </div>
                  </div>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>
                          <input type="checkbox" />
                        </th>
                        <th>Nom de la demande</th>
                        <th>Type</th>
                        <th>Référence</th>
                        <th>Date</th>
                        <th>Taille</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={8} className={styles.emptyTableCell}>
                            Chargement des demandes récentes...
                          </td>
                        </tr>
                      ) : filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={styles.emptyTableCell}>
                            Aucune demande cadastrale trouvée.
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((item) => {
                          const selected = selectedItem?.id === item.id;
                          return (
                            <tr
                              key={item.id}
                              className={selected ? styles.tableRowSelected : ""}
                              onClick={() => setSelectedId(item.id)}
                            >
                              <td>
                                <input type="checkbox" checked={selected} readOnly />
                              </td>
                              <td>
                                <div className={styles.docCell}>
                                  <div className={styles.docIcon}>
                                    <FileText size={14} />
                                  </div>
                                  <div>
                                    <div className={styles.docName}>{item.referenceDemande}</div>
                                    <div className={styles.docRef}>Accusé de réception horodaté</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`${styles.pill} ${getTypePillClass(item)}`}>{getTypeLabel(item)}</span>
                              </td>
                              <td className={styles.cellMuted}>{item.referenceDemande}</td>
                              <td className={styles.cellMuted}>{formatDateTime(item.dateSoumission || item.createdAt)}</td>
                              <td className={styles.cellMuted}>PDF</td>
                              <td>
                                <span className={`${styles.statusPill} ${getStatutTone(item)}`}>
                                  {getStatutLabel(item)}
                                </span>
                              </td>
                              <td>
                                <div className={styles.rowActions}>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleOpen(item, "download"); }}>
                                    <Download size={14} />
                                  </button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleOpen(item, "preview"); }}>
                                    <Eye size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.tableFooter}>
                  <div className={styles.perPage}>
                    <span>Afficher</span>
                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span>par page</span>
                  </div>
                  <div className={styles.pagination}>
                    <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>
                      <ChevronLeft size={14} />
                    </button>
                    <span className={styles.paginationInfo}>
                      Page {currentPage} / {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                      disabled={currentPage >= pageCount}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.footnote}>
                <span className={styles.footnoteIcon}>i</span>
                <span>
                  Les accusés de réception sont des copies générées automatiquement à partir du registre cadastral
                  numérique et restent disponibles dans votre espace.
                </span>
                <a href="/cadastre/dashboard">En savoir plus sur vos documents</a>
              </div>
            </div>

            <aside className={styles.detailPanel}>
              <div className={styles.detailHead}>
                <h3>Détails du document</h3>
                <button type="button" className={styles.closeBtn} onClick={() => setSelectedId(null)}>
                  <X size={14} />
                </button>
              </div>

              {selectedItem ? (
                <>
                  <div className={styles.detailDoc}>
                    <div className={styles.docIconLarge}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className={styles.detailDocName}>{getTypeLabel(selectedItem)}</div>
                      <div className={styles.detailDocRef}>{selectedItem.referenceDemande}</div>
                      <div className={`${styles.statusPill} ${getStatutTone(selectedItem)}`}>
                        {getStatutLabel(selectedItem)}
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailRows}>
                    <div className={styles.detailRow}>
                      <span>Type</span>
                      <span>{getTypeLabel(selectedItem)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Catégorie</span>
                      <span>Accusé de réception</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Titre / Référence</span>
                      <span>{selectedItem.referenceDemande}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Date de création</span>
                      <span>{formatDateTime(selectedItem.dateSoumission || selectedItem.createdAt)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Titulaire</span>
                      <span>{selectedItem.titulaire || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Type de permis</span>
                      <span>{selectedItem.typePermis || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Canal</span>
                      <span>{selectedItem.emailContact ? "Email" : "Téléphone"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Contact</span>
                      <span>{selectedItem.emailContact || selectedItem.telephoneContact || "—"}</span>
                    </div>
                  </div>

                  <div className={styles.detailDivider} />

                  <div className={styles.actionsLabel}>Actions disponibles</div>
                  <button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => handleOpen(selectedItem, "download")}>
                    <Download size={16} />
                    Télécharger
                  </button>
                  <button type="button" className={`${styles.actionBtn} ${styles.actionBtnOutline}`} onClick={() => handleOpen(selectedItem, "preview")}>
                    <Eye size={16} />
                    Aperçu en ligne
                  </button>
                  <button type="button" className={`${styles.actionBtn} ${styles.actionBtnOutline}`} onClick={() => navigate("/cadastre/demandedocumentcadastrale/")}>
                    <FileText size={16} />
                    Nouvelle demande
                  </button>
                </>
              ) : (
                <div className={styles.detailEmpty}>
                  Sélectionnez une demande pour afficher ses détails et l’accusé de réception associé.
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </InvestorLayout>
  );
}
