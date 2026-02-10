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
  Sparkles,
  LayoutGrid,
  List
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./DemandesList.module.css";

type DemandeListItem = {
  id_demande: number;
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
    try {
      const res = await axios.get(`${apiURL}/api/facture/demande/${demandeId}`, {
        withCredentials: true,
      });
      const factureId = res.data?.facture?.id_facture;
      if (!factureId) {
        toast.info("Aucune facture disponible pour cette demande.");
        return;
      }
      window.open(`${apiURL}/api/facture/${factureId}/pdf`, "_blank");
    } catch (err) {
      console.error("Erreur telechargement facture", err);
      toast.error("Impossible de telecharger la facture.");
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
            <Button 
              onClick={() => navigate('/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis')} 
              className={styles.newButton}
              size="lg"
            >
              <Plus className="w-5 h-5" />
              Nouvelle demande
            </Button>
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
                        onClick={() => handleDownloadPdf(demande.id_demande)}
                      >
                        <Download className="w-4 h-4" />
                        PDF
                      </Button>
                      <Button
                        onClick={() =>
                          navigate(`/investisseur/demandes/${demande.id_demande}`)
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
                        onClick={() => handleDownloadPdf(demande.id_demande)}
                      >
                        <Download className="w-4 h-4" />
                        PDF
                      </Button>
                      <Button
                        onClick={() =>
                          navigate(`/investisseur/demandes/${demande.id_demande}`)
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

