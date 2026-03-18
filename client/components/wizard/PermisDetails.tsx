import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Download,
  Award,
  Building2,
  MapPin,
  Calendar,
  SquareIcon,
  FileText,
  Map,
  Gem,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
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
  MessageSquareText,
} from "lucide-react";
import styles from "./PermisDetails.module.css";
import EntityMessagesPanel from "@/components/chat/EntityMessagesPanel";
import type { Coordinate } from "@/components/arcgismap/ArcgisMap";
import PerimeterCoordinatesTable from "@/components/perimeter/PerimeterCoordinatesTable";

interface Permis {
  id: string;
  code: string;
  type: string;
  titulaire: string;
  wilaya: string;
  daira: string;
  commune: string;
  lieuDit: string;
  statut: "ACTIF" | "EXPIRE" | "SUSPENDU" | "EN_RENOUVELLEMENT";
  dateOctroi: string;
  dateExpiration: string;
  superficie: number;
  perimetrePoints: Coordinate[];
  substances: { nom: string; principal: boolean }[];
  documents: { nom: string; type: string; date: string; taille: string; statut: string }[];
  historique: { titre: string; date: string; description: string; type: string }[];
  procedures: { code: string; type: string; statut: string; dateDepot: string; dateTraitement: string | null }[];
  obligationsFiscales: { libelle: string; montant: number; echeance: string; statut: "PAYE" | "EN_ATTENTE" | "EN_RETARD" }[];
}

interface ActionRapide {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  available: boolean;
}

const PermisDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // Mock data - à remplacer par les vraies données
  const [permis] = useState<Permis>({
    id: id || "1",
    code: "PRM-2024-0015",
    type: "Exploitation",
    titulaire: "SARL Mines du Sud",
    wilaya: "Tamanrasset",
    daira: "Tamanrasset",
    commune: "Tamanrasset",
    lieuDit: "Oued Tin Zaouatine",
    statut: "ACTIF",
    dateOctroi: "2024-03-15",
    dateExpiration: "2034-03-14",
    superficie: 250,
    perimetrePoints: [
      { id: 1, idTitre: 1007, h: 0, x: 512345.123456, y: 2723456.654321, system: "UTM", zone: 31, hemisphere: "N" },
      { id: 2, idTitre: 1007, h: 0, x: 513002.221134, y: 2722988.554221, system: "UTM", zone: 31, hemisphere: "N" },
      { id: 3, idTitre: 1007, h: 0, x: 513445.002211, y: 2723380.113004, system: "UTM", zone: 31, hemisphere: "N" },
      { id: 4, idTitre: 1007, h: 0, x: 513102.771244, y: 2724012.998711, system: "UTM", zone: 31, hemisphere: "N" },
      { id: 5, idTitre: 1007, h: 0, x: 512598.440003, y: 2724220.221155, system: "UTM", zone: 31, hemisphere: "N" },
    ],
    substances: [
      { nom: "Or", principal: true },
      { nom: "Argent", principal: false },
      { nom: "Cuivre", principal: false },
    ],
    documents: [
      { nom: "Arrêté d'octroi", type: "PDF", date: "2024-03-15", taille: "2.4 MB", statut: "Validé" },
      { nom: "Plan cadastral", type: "PDF", date: "2024-03-10", taille: "5.1 MB", statut: "Validé" },
      { nom: "Étude d'impact", type: "PDF", date: "2024-02-28", taille: "12.3 MB", statut: "Validé" },
      { nom: "Cahier des charges", type: "PDF", date: "2024-03-15", taille: "1.8 MB", statut: "En révision" },
    ],
    historique: [
      {
        titre: "Permis octroyé",
        date: "2024-03-15",
        description: "Octroi du permis d'exploitation pour une durée de 10 ans.",
        type: "octroi",
      },
      {
        titre: "Demande approuvée",
        date: "2024-03-01",
        description: "Approbation de la demande après étude technique complète.",
        type: "validation",
      },
      {
        titre: "Demande soumise",
        date: "2024-01-15",
        description: "Soumission initiale de la demande de permis d'exploitation.",
        type: "submission",
      },
    ],
    procedures: [
      { code: "PROC-2024-0089", type: "Demande initiale", statut: "TERMINEE", dateDepot: "2024-01-15", dateTraitement: "2024-03-15" },
      { code: "PROC-2024-0156", type: "Modification périmètre", statut: "EN_COURS", dateDepot: "2024-11-20", dateTraitement: null },
    ],
    obligationsFiscales: [
      { libelle: "Redevance superficiaire 2024", montant: 125000, echeance: "2024-12-31", statut: "PAYE" },
      { libelle: "Taxe d'extraction Q4 2024", montant: 87500, echeance: "2025-01-15", statut: "EN_ATTENTE" },
      { libelle: "Redevance superficiaire 2025", montant: 125000, echeance: "2025-03-15", statut: "EN_ATTENTE" },
      { libelle: "Taxe environnementale 2024", montant: 45000, echeance: "2024-11-30", statut: "EN_RETARD" },
    ],
  });

  const actionsRapides: ActionRapide[] = [
    { id: "option", label: "Option-2025", icon: ChevronRight, description: "Demander une option sur le périmètre", available: true },
    { id: "renouvellement", label: "Renouvellement", icon: Repeat, description: "Renouveler le permis avant expiration", available: true },
    { id: "modification", label: "Modification", icon: Edit3, description: "Modifier les caractéristiques du permis", available: true },
    { id: "fusion", label: "Fusion", icon: GitMerge, description: "Fusionner avec un autre permis", available: true },
    { id: "division", label: "Division", icon: Scissors, description: "Diviser le périmètre en plusieurs permis", available: true },
    { id: "transfert", label: "Transfert", icon: ArrowRightLeft, description: "Transférer le permis à un tiers", available: false },
    { id: "cession", label: "Cession", icon: HandCoins, description: "Céder les droits du permis", available: false },
    { id: "renonciation", label: "Renonciation", icon: LogOut, description: "Renoncer au permis", available: true },
    { id: "retrait", label: "Retrait", icon: Trash2, description: "Demander le retrait du permis", available: false },
    { id: "regularisation", label: "Régularisation", icon: FileCheck, description: "Régulariser une situation", available: true },
  ];

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
      EN_ATTENTE: { label: "En attente", icon: Clock, className: styles.obligationPending },
      EN_RETARD: { label: "En retard", icon: AlertTriangle, className: styles.obligationOverdue },
    };
    return configs[statut as keyof typeof configs] || configs.EN_ATTENTE;
  };

  const getTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      Exploitation: "⛏️",
      Exploration: "🔍",
      Prospection: "🧭",
    };
    return emojis[type] || "📋";
  };

  const handleDownloadPDF = () => {
    console.log("Downloading permit PDF...");
    // TODO: Implement PDF generation with jsPDF
  };

  const statutConfig = getStatutConfig(permis.statut);
  const StatusIcon = statutConfig.icon;

  const totalObligations = permis.obligationsFiscales.reduce((sum, o) => sum + o.montant, 0);
  const totalPaye = permis.obligationsFiscales
    .filter((o) => o.statut === "PAYE")
    .reduce((sum, o) => sum + o.montant, 0);
  const totalEnAttente = permis.obligationsFiscales
    .filter((o) => o.statut === "EN_ATTENTE")
    .reduce((sum, o) => sum + o.montant, 0);
  const totalEnRetard = permis.obligationsFiscales
    .filter((o) => o.statut === "EN_RETARD")
    .reduce((sum, o) => sum + o.montant, 0);

  return (
    <InvestorLayout>
      <div className={styles.container}>
        {/* Hero Header */}
        <div className={styles.heroHeader}>
          <div className={styles.heroContent}>
            <div className={styles.heroNav}>
              <Button
                variant="ghost"
                className={styles.backBtn}
                onClick={() => navigate("/investor/mes-permis")}
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la liste
              </Button>
              <Button className={styles.downloadBtn} onClick={handleDownloadPDF}>
                <Download className="w-4 h-4" />
                Télécharger le permis (PDF)
              </Button>
            </div>

            <div className={styles.heroInfo}>
              <div className={styles.heroIcon}>{getTypeEmoji(permis.type)}</div>
              <div className={styles.heroText}>
                <h1 className={styles.heroCode}>{permis.code}</h1>
                <div className={styles.heroMeta}>
                  <span className={styles.heroType}>
                    <Award className="w-4 h-4" />
                    Permis de {permis.type}
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

        {/* Main Content */}
        <div className={styles.mainContent}>
          <div className={styles.sectionGrid}>
            {/* Informations générales */}
            <div className={styles.infoCard} style={{ animationDelay: "0.1s" }}>
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
                    <span className={styles.infoValue}>{permis.code}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Type</span>
                    <span className={styles.infoValue}>{permis.type}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Titulaire</span>
                    <span className={styles.infoValue}>{permis.titulaire}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Statut</span>
                    <span className={styles.infoValue}>{statutConfig.label}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date d'octroi</span>
                    <span className={styles.infoValue}>
                      {new Date(permis.dateOctroi).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date d'expiration</span>
                    <span className={styles.infoValue}>
                      {new Date(permis.dateExpiration).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Localisation */}
            <div className={styles.infoCard} style={{ animationDelay: "0.15s" }}>
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
                    <span className={styles.infoValue}>{permis.wilaya}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Daïra</span>
                    <span className={styles.infoValue}>{permis.daira}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Commune</span>
                    <span className={styles.infoValue}>{permis.commune}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Lieu-dit</span>
                    <span className={styles.infoValue}>{permis.lieuDit}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Superficie & Carte */}
            <div
              className={`${styles.infoCard} ${styles.sectionFull}`}
              style={{ animationDelay: "0.2s" }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <Map className="w-5 h-5" />
                </div>
                <h2 className={styles.cardTitle}>Superficie & Périmètre</h2>
              </div>
              <div className={styles.cardContent}>
                <div style={{ marginBottom: "1rem" }}>
                  <span className={styles.infoLabel}>Superficie totale</span>
                  <span className={styles.infoValueLarge}>{permis.superficie} hectares</span>
                </div>
                <div className={styles.mapContainer}>
                  <div className={styles.mapPlaceholder}>
                    <div className={styles.mapIcon}>
                      <Map className="w-8 h-8" />
                    </div>
                    <p>Visualisation du périmètre minier</p>
                    <Button
                      className={styles.viewMapBtn}
                      onClick={() => navigate("/operator/carte-sig")}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Voir sur la carte SIG
                    </Button>
                  </div>
                </div>
                <PerimeterCoordinatesTable
                  points={permis.perimetrePoints}
                  emptyMessage="Aucun perimetre defini pour ce permis."
                  className={styles.coordinatesBlock}
                />
              </div>
            </div>

            {/* Substances */}
            <div className={styles.infoCard} style={{ animationDelay: "0.25s" }}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <Gem className="w-5 h-5" />
                </div>
                <h2 className={styles.cardTitle}>Substances minières</h2>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.substancesList}>
                  {permis.substances.map((sub, index) => (
                    <span
                      key={index}
                      className={`${styles.substanceBadge} ${sub.principal ? styles.primary : ""}`}
                    >
                      {sub.principal && <Gem className="w-3.5 h-3.5" />}
                      {sub.nom}
                      {sub.principal && " (principal)"}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Procédures */}
            <div className={styles.infoCard} style={{ animationDelay: "0.3s" }}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <Gavel className="w-5 h-5" />
                </div>
                <h2 className={styles.cardTitle}>Procédures liées</h2>
              </div>
              <div className={styles.cardContent}>
                {permis.procedures.length > 0 ? (
                  <div className={styles.proceduresList}>
                    {permis.procedures.map((proc, index) => {
                      const procStatut = getProcedureStatutConfig(proc.statut);
                      return (
                        <div key={index} className={styles.procedureItem}>
                          <div className={styles.procedureInfo}>
                            <div className={styles.procedureCode}>{proc.code}</div>
                            <div className={styles.procedureType}>{proc.type}</div>
                            <div className={styles.procedureDates}>
                              <span>Dépôt: {new Date(proc.dateDepot).toLocaleDateString("fr-FR")}</span>
                              {proc.dateTraitement && (
                                <span> • Traité: {new Date(proc.dateTraitement).toLocaleDateString("fr-FR")}</span>
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

            {/* Actions Rapides */}
            <div
              className={`${styles.infoCard} ${styles.sectionFull}`}
              style={{ animationDelay: "0.35s" }}
            >
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
                        onClick={() => action.available && navigate(`/investor/procedure/${action.id}/${permis.id}`)}
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

            {/* Obligations Fiscales */}
            <div
              className={`${styles.infoCard} ${styles.sectionFull}`}
              style={{ animationDelay: "0.4s" }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <DollarSign className="w-5 h-5" />
                </div>
                <h2 className={styles.cardTitle}>Obligations fiscales</h2>
              </div>
              <div className={styles.cardContent}>
                {/* Stats */}
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

                {/* Progress */}
                <div className={styles.fiscalProgress}>
                  <div className={styles.fiscalProgressHeader}>
                    <span>Progression des paiements</span>
                    <span>{Math.round((totalPaye / totalObligations) * 100)}%</span>
                  </div>
                  <Progress value={(totalPaye / totalObligations) * 100} className={styles.progressBar} />
                </div>

                {/* Table */}
                <div className={styles.obligationsTable}>
                  <div className={styles.tableHeader}>
                    <span>Libellé</span>
                    <span>Montant</span>
                    <span>Échéance</span>
                    <span>Statut</span>
                    <span>Action</span>
                  </div>
                  {permis.obligationsFiscales.map((obligation, index) => {
                    const obligStatut = getObligationStatutConfig(obligation.statut);
                    const ObligIcon = obligStatut.icon;
                    return (
                      <div key={index} className={styles.tableRow}>
                        <span className={styles.tableCellLibelle}>{obligation.libelle}</span>
                        <span className={styles.tableCellMontant}>
                          {obligation.montant.toLocaleString("fr-FR")} DA
                        </span>
                        <span className={styles.tableCellEcheance}>
                          {new Date(obligation.echeance).toLocaleDateString("fr-FR")}
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
                  })}
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className={styles.infoCard} style={{ animationDelay: "0.45s" }}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className={styles.cardTitle}>Documents associés</h2>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.documentsList}>
                  {permis.documents.map((doc, index) => (
                    <div key={index} className={styles.documentItem}>
                      <div className={styles.documentIcon}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className={styles.documentInfo}>
                        <p className={styles.documentName}>{doc.nom}</p>
                        <span className={styles.documentMeta}>
                          {doc.type} • {doc.taille} •{" "}
                          {new Date(doc.date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <span className={`${styles.docStatusBadge} ${doc.statut === "Validé" ? styles.docValidated : styles.docPending}`}>
                        {doc.statut}
                      </span>
                      <Button variant="ghost" size="icon" className={styles.documentDownload}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Historique */}
            <div className={styles.infoCard} style={{ animationDelay: "0.5s" }}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <Clock className="w-5 h-5" />
                </div>
                <h2 className={styles.cardTitle}>Historique & Renouvellements</h2>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.timeline}>
                  {permis.historique.map((event, index) => (
                    <div key={index} className={styles.timelineItem}>
                      <div className={`${styles.timelineDot} ${styles[event.type] || ""}`} />
                      <div className={styles.timelineContent}>
                        <h4 className={styles.timelineTitle}>{event.titre}</h4>
                        <p className={styles.timelineDate}>
                          {new Date(event.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p className={styles.timelineDescription}>{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Commentaires / Messages */}
            <div
              className={`${styles.infoCard} ${styles.sectionFull}`}
              style={{ animationDelay: "0.55s" }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <MessageSquareText className="w-5 h-5" />
                </div>
                <h2 className={styles.cardTitle}>Commentaires / Messages</h2>
              </div>
              <div className={styles.cardContent}>
                <EntityMessagesPanel entityType="permis" entityCode={permis.code} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </InvestorLayout>
  );
};

export default PermisDetails;
