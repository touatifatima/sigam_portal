import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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
import { useAuthReady } from "@/src/hooks/useAuthReady";
import {
  computePermisSuperficie,
  getPermisTitulaireName,
  getPermisWilayaName,
} from "@/utils/permisHelpers";
import styles from "@/components/wizard/MesPermis.module.css";

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

const normalizeTypeLabel = (permis: any) =>
  permis?.typePermis?.lib_type ??
  permis?.typePermis?.code_type ??
  permis?.type ??
  "N/A";

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

const deriveStatut = (permis: any): Permis["statut"] => {
  const exp = permis?.date_expiration ? new Date(permis.date_expiration) : null;
  if (exp && !isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
    return "EXPIRE";
  }
  const lib = String(permis?.statut?.lib_statut ?? "").toLowerCase();
  if (lib.includes("suspend")) return "SUSPENDU";
  if (hasRenouvellementProcedure(permis)) return "EN_RENOUVELLEMENT";
  return "ACTIF";
};

const MesPermisOperateur = () => {
  const navigate = useNavigate();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const isAuthReady = useAuthReady();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permis, setPermis] = useState<Permis[]>([]);

  const fetchPermis = useCallback(async () => {
    if (!apiURL) {
      setError("API URL manquante");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${apiURL}/operateur/permis`, {
        withCredentials: true,
      });
      const raw = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      const mapped: Permis[] = raw.map((item: any) => ({
        id: String(item.id),
        code: item.code_permis ?? item.code ?? "N/A",
        type: normalizeTypeLabel(item),
        titulaire: getPermisTitulaireName(item) || item?.detenteur?.nom_societeFR || "N/A",
        wilaya: getPermisWilayaName(item) || "N/A",
        statut: deriveStatut(item),
        dateOctroi:
          item.date_octroi_effective ??
          item.date_octroi ??
          item.date_octroi_proc ??
          item.date_signature ??
          "",
        dateExpiration: item.date_expiration ?? "",
        superficie:
          computePermisSuperficie(item) ??
          (typeof item.superficie === "number" ? item.superficie : 0),
      }));
      setPermis(mapped);
    } catch (err) {
      console.error("Erreur chargement permis:", err);
      setError("Impossible de charger vos permis.");
    } finally {
      setLoading(false);
    }
  }, [apiURL]);

  useEffect(() => {
    if (!isAuthReady) return;
    fetchPermis();
  }, [isAuthReady, fetchPermis]);

  const stats = useMemo(
    () => ({
      total: permis.length,
      actifs: permis.filter((p) => p.statut === "ACTIF").length,
      expires: permis.filter((p) => p.statut === "EXPIRE").length,
      renouvellement: permis.filter((p) => p.statut === "EN_RENOUVELLEMENT").length,
    }),
    [permis]
  );

  const getStatutConfig = (statut: string) => {
    const configs = {
      ACTIF: { label: "Actif", icon: CheckCircle2, className: styles.badgeActive },
      EXPIRE: { label: "Expiré", icon: XCircle, className: styles.badgeExpired },
      SUSPENDU: { label: "Suspendu", icon: AlertTriangle, className: styles.badgeSuspended },
      EN_RENOUVELLEMENT: { label: "Renouvellement", icon: RefreshCw, className: styles.badgeRenewal },
    };
    return configs[statut as keyof typeof configs] || configs.ACTIF;
  };

  const getTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      Exploitation: "⛏️",
      Exploration: "🔍",
      Prospection: "🗺️",
    };
    return emojis[type] || "📄";
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
        <div className={styles.heroHeader}>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <div className={styles.heroLabel}>
                <Award className="w-4 h-4" />
                Espace Permis
              </div>
              <h1 className={styles.heroTitle}>Mes Permis Miniers</h1>
              <p className={styles.heroSubtitle}>
                Consultez et gÃ©rez tous vos permis d'exploitation, d'exploration et de prospection
              </p>
            </div>

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
                <span className={styles.statLabel}>ExpirÃ©s</span>
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
                  <SelectValue placeholder="Statut" className={styles.selectValue} />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem value="all" className={styles.selectItem}>Tous les statuts</SelectItem>
                  <SelectItem value="ACTIF" className={styles.selectItem}>Actif</SelectItem>
                  <SelectItem value="EXPIRE" className={styles.selectItem}>ExpirÃ©</SelectItem>
                  <SelectItem value="SUSPENDU" className={styles.selectItem}>Suspendu</SelectItem>
                  <SelectItem value="EN_RENOUVELLEMENT" className={styles.selectItem}>En renouvellement</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Type" className={styles.selectValue} />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem value="all" className={styles.selectItem}>Tous les types</SelectItem>
                  <SelectItem value="Exploitation" className={styles.selectItem}>Exploitation</SelectItem>
                  <SelectItem value="Exploration" className={styles.selectItem}>Exploration</SelectItem>
                  <SelectItem value="Prospection" className={styles.selectItem}>Prospection</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {error && <div className={styles.emptyState}><p>{error}</p></div>}

        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            {filteredPermis.length} permis trouvÃ©{filteredPermis.length > 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p>Chargement des permis...</p>
          </div>
        ) : filteredPermis.length > 0 ? (
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
                          {permis.dateOctroi
                            ? new Date(permis.dateOctroi).toLocaleDateString("fr-FR")
                            : "--"}
                        </div>
                        <div className={styles.metaItem}>
                          <SquareIcon className="w-4 h-4" />
                          {permis.superficie ? `${permis.superficie} ha` : "--"}
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <Button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/operateur/permisdashboard/${permis.id}`)}
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
                          {permis.dateOctroi
                            ? new Date(permis.dateOctroi).toLocaleDateString("fr-FR")
                            : "--"}
                        </div>
                        <div className={styles.metaItem}>
                          <SquareIcon className="w-4 h-4" />
                          {permis.superficie ? `${permis.superficie} ha` : "--"}
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <Button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/operateur/permisdashboard/${permis.id}`)}
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
            <h3>Aucun permis trouvÃ©</h3>
            <p>Modifiez vos filtres ou revenez plus tard.</p>
            <Button onClick={fetchPermis}>Recharger</Button>
          </div>
        )}
      </div>
    </InvestorLayout>
  );
};

export default MesPermisOperateur;

