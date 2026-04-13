import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Award,
  Search,
  Filter,
  ArrowLeft,
  MapPin,
  Calendar,
  SquareIcon,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  ChevronRight,
  LayoutGrid,
  List,
  FileCheck,
} from "lucide-react";
import styles from "./MesPermis.module.css";

interface Permis {
  id: string;
  code: string;
  type: string;
  titulaire: string;
  wilaya: string;
  statut: "ACTIF" | "EXPIRE" | "SUSPENDU" | "EN_RENOUVELLEMENT";
  dateOctroi: string;
  dateExpiration: string;
  superficie: number;
}

const MesPermis = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Mock data - à remplacer par les vraies données
  const [permis] = useState<Permis[]>([
    {
      id: "1",
      code: "PRM-2024-0015",
      type: "Exploitation",
      titulaire: "SARL Mines du Sud",
      wilaya: "Tamanrasset",
      statut: "ACTIF",
      dateOctroi: "2024-03-15",
      dateExpiration: "2034-03-14",
      superficie: 250,
    },
    {
      id: "2",
      code: "PRM-2023-0089",
      type: "Exploration",
      titulaire: "SARL Mines du Sud",
      wilaya: "Ouargla",
      statut: "ACTIF",
      dateOctroi: "2023-06-20",
      dateExpiration: "2028-06-19",
      superficie: 500,
    },
    {
      id: "3",
      code: "PRM-2022-0042",
      type: "Prospection",
      titulaire: "SARL Mines du Sud",
      wilaya: "Béchar",
      statut: "EN_RENOUVELLEMENT",
      dateOctroi: "2022-01-10",
      dateExpiration: "2025-01-09",
      superficie: 150,
    },
    {
      id: "4",
      code: "PRM-2021-0156",
      type: "Exploitation",
      titulaire: "SARL Mines du Sud",
      wilaya: "Illizi",
      statut: "EXPIRE",
      dateOctroi: "2021-09-05",
      dateExpiration: "2024-09-04",
      superficie: 320,
    },
    {
      id: "5",
      code: "PRM-2024-0078",
      type: "Exploration",
      titulaire: "SARL Mines du Sud",
      wilaya: "Adrar",
      statut: "SUSPENDU",
      dateOctroi: "2024-02-28",
      dateExpiration: "2029-02-27",
      superficie: 180,
    },
  ]);

  const stats = {
    total: permis.length,
    actifs: permis.filter((p) => p.statut === "ACTIF").length,
    expires: permis.filter((p) => p.statut === "EXPIRE").length,
    renouvellement: permis.filter((p) => p.statut === "EN_RENOUVELLEMENT").length,
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
        label: "Renouvellement",
        icon: RefreshCw,
        className: styles.badgeRenewal,
      },
    };
    return configs[statut as keyof typeof configs] || configs.ACTIF;
  };

  const getTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      Exploitation: "⛏️",
      Exploration: "🔍",
      Prospection: "🧭",
    };
    return emojis[type] || "📋";
  };

  const formatFilterDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR");

  const filteredPermis = permis.filter((p) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchSearch =
      normalizedSearch.length === 0 ||
      p.code.toLowerCase().includes(normalizedSearch) ||
      p.type.toLowerCase().includes(normalizedSearch) ||
      p.titulaire.toLowerCase().includes(normalizedSearch) ||
      p.wilaya.toLowerCase().includes(normalizedSearch);
    const matchStatut = filterStatut === "all" || p.statut === filterStatut;
    const matchType = filterType === "all" || p.type === filterType;
    const matchDateFrom = !dateFrom || p.dateOctroi >= dateFrom;
    const matchDateTo = !dateTo || p.dateOctroi <= dateTo;
    return matchSearch && matchStatut && matchType && matchDateFrom && matchDateTo;
  });

  const activeFilterTags = [
    searchTerm.trim().length > 0 ? `"${searchTerm.trim()}"` : null,
    filterStatut !== "all" ? getStatutConfig(filterStatut).label : null,
    filterType !== "all" ? filterType : null,
    dateFrom ? `Du ${formatFilterDate(dateFrom)}` : null,
    dateTo ? `Au ${formatFilterDate(dateTo)}` : null,
  ].filter(Boolean) as string[];

  return (
    <InvestorLayout>
      <div className={styles.container}>
        {/* Hero Header */}
        <div className={styles.heroHeader}>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <div className={styles.heroLabel}>
                <Award className="w-4 h-4" />
                Espace Permis
              </div>
              <h1 className={styles.heroTitle}>Mes Permis Miniers</h1>
              <p className={styles.heroSubtitle}>
                Consultez et gérez tous vos permis d'exploitation, d'exploration et de prospection
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

              {/* View Toggle */}
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.toggleBtn} ${viewMode === "grid" ? styles.active : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Vue grille"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  className={`${styles.toggleBtn} ${viewMode === "list" ? styles.active : ""}`}
                  onClick={() => setViewMode("list")}
                  title="Vue liste"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FileCheck className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.total}</span>
                <span className={styles.statLabel}>Total</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.actifs}</span>
                <span className={styles.statLabel}>Actifs</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <XCircle className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.expires}</span>
                <span className={styles.statLabel}>Expirés</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.renouvellement}</span>
                <span className={styles.statLabel}>Renouvellement</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className={styles.filtersCard}>
          <CardContent className={styles.filtersContent}>
            <div className={styles.filtersHeader}>
              <div className={styles.filtersTitle}>
                <Filter className="w-4 h-4" />
                <span>Filtres</span>
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

              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Statut" className={styles.selectValue} />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem className={styles.selectItem} value="all">
                    Tous les statuts
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="ACTIF">
                    Actif
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="EXPIRE">
                    Expiré
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="SUSPENDU">
                    Suspendu
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="EN_RENOUVELLEMENT">
                    En renouvellement
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Type de permis" className={styles.selectValue} />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem className={styles.selectItem} value="all">
                    Tous les types
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="Exploitation">
                    Exploitation
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="Exploration">
                    Exploration
                  </SelectItem>
                  <SelectItem className={styles.selectItem} value="Prospection">
                    Prospection
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className={styles.dateField}>
                <span className={styles.dateLabel}>Du</span>
                <Input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={styles.dateInput}
                />
              </div>

              <div className={styles.dateField}>
                <span className={styles.dateLabel}>Au</span>
                <Input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={styles.dateInput}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Info */}
        <div className={styles.resultsInfo}>
          <div className={styles.resultsSummary}>
            <span className={styles.resultsCount}>
              {filteredPermis.length} permis trouvé{filteredPermis.length > 1 ? "s" : ""}
            </span>

            <div className={styles.resultsMeta}>
              {activeFilterTags.length > 0 ? (
                activeFilterTags.map((tag) => (
                  <span key={tag} className={styles.resultTag}>
                    {tag}
                  </span>
                ))
              ) : (
                <span className={styles.resultTagMuted}>Aucun filtre appliqué</span>
              )}
            </div>
          </div>
        </div>
        {/* Permits Display */}
        {filteredPermis.length > 0 ? (
          viewMode === "grid" ? (
            <div className={styles.permitsGrid}>
              {filteredPermis.map((permis, index) => {
                const statutConfig = getStatutConfig(permis.statut);
                const StatusIcon = statutConfig.icon;

                return (
                  <div
                    key={permis.id}
                    className={styles.permitCard}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardType}>
                        <span className={styles.typeEmoji}>{getTypeEmoji(permis.type)}</span>
                        <span className={styles.typeName}>{permis.type}</span>
                      </div>
                      <span className={`${styles.statusBadge} ${statutConfig.className}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statutConfig.label}
                      </span>
                    </div>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardCode}>{permis.code}</h3>
                      <div className={styles.cardTitulaire}>
                        <Building2 className="w-4 h-4" />
                        {permis.titulaire}
                      </div>
                      <div className={styles.cardMeta}>
                        <div className={styles.metaItem}>
                          <MapPin className="w-4 h-4" />
                          {permis.wilaya}
                        </div>
                        <div className={styles.metaItem}>
                          <Calendar className="w-4 h-4" />
                          {new Date(permis.dateOctroi).toLocaleDateString("fr-FR")}
                        </div>
                        <div className={styles.metaItem}>
                          <SquareIcon className="w-4 h-4" />
                          {permis.superficie} ha
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <Button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/investor/permis/${permis.id}`)}
                      >
                        Voir le permis
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.permitsList}>
              {filteredPermis.map((permis, index) => {
                const statutConfig = getStatutConfig(permis.statut);
                const StatusIcon = statutConfig.icon;

                return (
                  <div
                    key={permis.id}
                    className={`${styles.permitCard} ${styles.permitCardList}`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <span className={`${styles.statusBadge} ${statutConfig.className}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statutConfig.label}
                    </span>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardCode}>{permis.code}</h3>
                      <div className={styles.cardMeta}>
                        <div className={styles.metaItem}>
                          <span className={styles.typeEmoji}>{getTypeEmoji(permis.type)}</span>
                          {permis.type}
                        </div>
                        <div className={styles.metaItem}>
                          <Building2 className="w-4 h-4" />
                          {permis.titulaire}
                        </div>
                        <div className={styles.metaItem}>
                          <MapPin className="w-4 h-4" />
                          {permis.wilaya}
                        </div>
                        <div className={styles.metaItem}>
                          <Calendar className="w-4 h-4" />
                          {new Date(permis.dateOctroi).toLocaleDateString("fr-FR")}
                        </div>
                        <div className={styles.metaItem}>
                          <SquareIcon className="w-4 h-4" />
                          {permis.superficie} ha
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <Button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/investor/permis/${permis.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                        Voir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Award className="w-10 h-10" />
            </div>
            <h3>Aucun permis trouvé</h3>
            <p>Modifiez vos filtres ou soumettez une nouvelle demande de permis.</p>
            <Button onClick={() => navigate("/investor/nouvelle-demande")}>
              Nouvelle demande
            </Button>
          </div>
        )}
      </div>
    </InvestorLayout>
  );
};

export default MesPermis;

