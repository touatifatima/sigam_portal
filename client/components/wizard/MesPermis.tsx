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

  const filteredPermis = permis.filter((p) => {
    const matchSearch =
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.titulaire.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.wilaya.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatut = filterStatut === "all" || p.statut === filterStatut;
    const matchType = filterType === "all" || p.type === filterType;
    return matchSearch && matchStatut && matchType;
  });

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
              <Filter className="w-4 h-4" />
              Filtres
            </div>
            <div className={styles.filtersGrid}>
              <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} />
                <Input
                  placeholder="Rechercher par code, titulaire, wilaya..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="ACTIF">Actif</SelectItem>
                  <SelectItem value="EXPIRE">Expiré</SelectItem>
                  <SelectItem value="SUSPENDU">Suspendu</SelectItem>
                  <SelectItem value="EN_RENOUVELLEMENT">En renouvellement</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="Exploitation">Exploitation</SelectItem>
                  <SelectItem value="Exploration">Exploration</SelectItem>
                  <SelectItem value="Prospection">Prospection</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Info */}
        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            {filteredPermis.length} permis trouvé{filteredPermis.length > 1 ? "s" : ""}
          </span>
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
