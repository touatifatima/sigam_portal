import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArcGISMap, {
  type ArcGISMapRef,
  type Coordinate,
} from "@/components/arcgismap/ArcgisMap";
import {
  ArrowLeft,
  FileText,
  CreditCard,
  History,
  Download,
  MapPin,
  Building2,
  Calendar,
  Ruler,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck,
  AlertCircle,
  Sparkles,
  Eye,
  Banknote,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./DemandeDetails.module.css";

type DemandeCommune = {
  principale?: boolean | null;
  commune?: {
    nom_communeFR?: string | null;
    daira?: {
      nom_dairaFR?: string | null;
      wilaya?: { nom_wilayaFR?: string | null } | null;
    } | null;
  } | null;
};

type DemandeDetail = {
  id_demande: number;
  code_demande?: string | null;
  statut_demande?: string | null;
  date_demande?: string | null;
  superficie?: number | null;
  lieu_ditFR?: string | null;
  id_proc?: number | null;
  procedure?: { date_debut_proc?: string | null } | null;
  typePermis?: { lib_type?: string | null; code_type?: string | null } | null;
  typeProcedure?: { libelle?: string | null } | null;
  detenteur?: { nom_societeFR?: string | null; nom_societeAR?: string | null } | null;
  wilaya?: { nom_wilayaFR?: string | null } | null;
  daira?: { nom_dairaFR?: string | null } | null;
  commune?: { nom_communeFR?: string | null } | null;
  communes?: DemandeCommune[];
};

type ProcedureEtapeItem = {
  statut?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  etape?: { lib_etape?: string | null; ordre_etape?: number | null } | null;
};

type DocumentItem = {
  nom: string;
  statut: string;
  date?: string | null;
  size?: string | null;
  fileUrl?: string | null;
};

type PaiementItem = {
  libelle: string;
  montant: string;
  statut: string;
  date?: string | null;
};

const apiURL =
  process.env.NEXT_PUBLIC_API_URL ||
  ((typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_URL) as string) ||
  "";

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const coerceNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pickName = (obj: any, keys: string[]) => {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const value = obj?.[key];
    if (value && typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const formatPersonName = (obj: any): string | null => {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  const company = pickName(obj, [
    "nom_societeFR",
    "nom_societeAR",
    "nom_societe",
    "raison_sociale",
    "nom_entreprise",
    "nomEntreprise",
  ]);
  if (company) return company;
  const nom = pickName(obj, ["nom", "nom_fr", "nom_ar", "nom_responsable", "nom_gerant"]);
  const prenom = pickName(obj, ["prenom", "prenom_fr", "prenom_ar"]);
  if (nom && prenom) return `${nom} ${prenom}`.trim();
  return nom || prenom || null;
};

const resolveTitulaire = (...payloads: any[]): string | null => {
  const candidates: any[] = [];
  payloads.forEach((payload) => {
    if (!payload) return;
    candidates.push(
      payload?.titulaire,
      payload?.detenteur,
      payload?.detenteurdemande?.[0]?.detenteur,
      payload?.demandeur,
      payload?.societe,
      payload?.entreprise,
      payload?.personne_morale,
      payload?.personneMorale,
      payload?.personne_physique,
      payload?.personnePhysique,
    );
  });
  for (const candidate of candidates) {
    const name = formatPersonName(candidate);
    if (name) return name;
  }
  return null;
};

const DemandeDetails = () => {
  const { id, code, demandeId } = useParams();
  const navigate = useNavigate();

  const demandeKey = useMemo(() => {
    const raw = id || demandeId || code || "";
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [id, demandeId, code]);

  const [demande, setDemande] = useState<DemandeDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [paiements, setPaiements] = useState<PaiementItem[]>([]);
  const [substances, setSubstances] = useState<string[]>([]);
  const [procedureEtapes, setProcedureEtapes] = useState<ProcedureEtapeItem[]>([]);
  const [factureId, setFactureId] = useState<number | null>(null);
  const [factureMontant, setFactureMontant] = useState<number | null>(null);
  const [factureStatut, setFactureStatut] = useState<string | null>(null);
  const [titulaireOverride, setTitulaireOverride] = useState<string | null>(null);
  const [superficieCadastrale, setSuperficieCadastrale] = useState<number | null>(
    null,
  );
  const [perimetrePoints, setPerimetrePoints] = useState<Coordinate[]>([]);
  const [perimetreZone, setPerimetreZone] = useState<number | undefined>(undefined);
  const [perimetreHemisphere, setPerimetreHemisphere] = useState<
    "N" | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<ArcGISMapRef | null>(null);

  useEffect(() => {
    let active = true;

    if (!demandeKey) {
      setError("Demande invalide.");
      setIsLoading(false);
      return;
    }
    if (!apiURL) {
      setError("API URL manquant.");
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const demandeRes = await axios.get(`${apiURL}/demandes/${demandeKey}`, {
          withCredentials: true,
        });
        if (!active) return;
        const demandeData = demandeRes.data as DemandeDetail;
        setDemande(demandeData);

        const idProc = demandeData?.id_proc;

        const [
          substancesRes,
          documentsRes,
          factureRes,
          procedureRes,
          verificationRes,
          coordsRes,
          demandeProcRes,
          inscriptionRes,
          entrepriseRes,
        ] = await Promise.all([
            axios
              .get(`${apiURL}/api/substances/demande/${demandeKey}/substances`, {
                withCredentials: true,
              })
              .catch(() => null),
            axios
              .get(`${apiURL}/api/procedure/${demandeKey}/documents`, {
                withCredentials: true,
              })
              .catch(() => null),
            axios
              .get(`${apiURL}/api/facture/demande/${demandeKey}`, {
                withCredentials: true,
              })
              .catch(() => null),
            idProc
              ? axios
                  .get(`${apiURL}/api/procedure-etape/procedure/${idProc}`, {
                    withCredentials: true,
                  })
                  .catch(() => null)
              : Promise.resolve(null),
            axios
              .get(`${apiURL}/verification-geo/demande/${demandeKey}`, {
                withCredentials: true,
              })
              .catch(() => null),
            idProc
              ? axios
                  .get(`${apiURL}/coordinates/procedure/${idProc}`, {
                    withCredentials: true,
                  })
                  .catch(() => null)
              : Promise.resolve(null),
            idProc
              ? axios
                  .get(`${apiURL}/api/procedures/${idProc}/demande`, {
                    withCredentials: true,
                  })
                  .catch(() => null)
              : Promise.resolve(null),
            idProc
              ? axios
                  .get(`${apiURL}/inscription-provisoire/procedure/${idProc}`, {
                    withCredentials: true,
                  })
                  .catch(() => null)
              : Promise.resolve(null),
            axios
              .get(`${apiURL}/api/profil/entreprise`, { withCredentials: true })
              .catch(() => null),
          ]);

        if (!active) return;

        const subsPayload = Array.isArray(substancesRes?.data)
          ? substancesRes?.data
          : [];
        const subsNames = subsPayload
          .map((s: any) => s?.nom_subFR || s?.nom_subAR || s?.code_sub)
          .filter(Boolean);
        setSubstances(subsNames);

        const docsPayload = Array.isArray(documentsRes?.data?.documents)
          ? documentsRes?.data?.documents
          : [];
        const dossierDate = documentsRes?.data?.dossierFournis?.date_depot ?? null;
        const mappedDocs: DocumentItem[] = docsPayload.map((doc: any) => ({
          nom: doc.nom_doc,
          statut: doc.statut,
          date: dossierDate,
          size: doc.taille_doc ? String(doc.taille_doc) : null,
          fileUrl: doc.file_url || null,
        }));
        setDocuments(mappedDocs);

        const facture = factureRes?.data?.facture ?? null;
        if (facture) {
          setFactureId(facture.id_facture ?? null);
          const montantValue =
            typeof facture.montant_total === "number" ? facture.montant_total : null;
          setFactureMontant(montantValue);
          setFactureStatut(facture.statut ?? null);
          const montantLabel = montantValue != null
            ? `${montantValue.toLocaleString("fr-FR")} DZD`
            : facture.montant_total
            ? `${facture.montant_total} DZD`
            : "--";
          setPaiements([
            {
              libelle: "Facture",
              montant: montantLabel,
              statut: facture.statut || "EN_ATTENTE",
              date: facture.date_emission || null,
            },
          ]);
        } else {
          setFactureId(null);
          setFactureMontant(null);
          setFactureStatut(null);
          setPaiements([]);
        }

        const steps = Array.isArray(procedureRes?.data?.ProcedureEtape)
          ? procedureRes?.data?.ProcedureEtape
          : [];
        setProcedureEtapes(steps);

        const verifSurface =
          typeof verificationRes?.data?.superficie_cadastrale === "number"
            ? verificationRes?.data?.superficie_cadastrale
            : null;

        const coordsPayload = Array.isArray(coordsRes?.data) ? coordsRes?.data : [];
        const mappedPoints = coordsPayload
          .map((item: any, index: number) => {
            const coord = item?.coordonnee ?? item;
            const x = Number(coord?.x);
            const y = Number(coord?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const zoneRaw = coord?.zone;
            const zone = zoneRaw != null ? Number(zoneRaw) : undefined;
            const hemisphere = "N";
            const system = (coord?.system as Coordinate["system"]) || "UTM";
            return {
              id: coord?.id_coordonnees ?? coord?.id ?? index + 1,
              idTitre: coord?.idTitre ?? 1007,
              h: coord?.h ?? 0,
              x,
              y,
              system,
              zone,
              hemisphere,
            } as Coordinate;
          })
          .filter(Boolean) as Coordinate[];
        setPerimetrePoints(mappedPoints);
        const detectedZone = mappedPoints.find((p) => Number.isFinite(p.zone as any))?.zone;
        const detectedHem = mappedPoints.find((p) => p.hemisphere)?.hemisphere;
        if (detectedZone !== undefined) {
          setPerimetreZone(detectedZone);
        } else {
          setPerimetreZone(undefined);
        }
        if (detectedHem === "N") {
          setPerimetreHemisphere(detectedHem);
        } else {
          setPerimetreHemisphere(undefined);
        }

        const demandeProcPayload = demandeProcRes?.data ?? null;
        const entrepriseDetenteur = entrepriseRes?.data?.detenteur ?? null;
        const titulaireCandidate = resolveTitulaire(
          demandeData,
          demandeProcPayload,
          entrepriseDetenteur,
          entrepriseRes?.data,
        );
        setTitulaireOverride(titulaireCandidate);

        const extraSuperficie =
          coerceNumber(demandeProcPayload?.superficie_cadastrale) ??
          coerceNumber(demandeProcPayload?.superficie_cadastrale_ha) ??
          coerceNumber(demandeProcPayload?.superficie_declaree) ??
          coerceNumber(demandeProcPayload?.superficieDeclaree) ??
          coerceNumber(demandeProcPayload?.superficie_calculee) ??
          coerceNumber(demandeProcPayload?.superficie_sig) ??
          coerceNumber(demandeProcPayload?.superficie_ha) ??
          coerceNumber(demandeProcPayload?.superficieHa) ??
          coerceNumber(demandeProcPayload?.superficie);

        const inscriptionSuperficie =
          coerceNumber(inscriptionRes?.data?.superficie_declaree) ??
          coerceNumber(inscriptionRes?.data?.superficie);

        const demandeSuperficie = coerceNumber(demandeData?.superficie);

        const finalSuperficie =
          verifSurface ?? extraSuperficie ?? inscriptionSuperficie ?? demandeSuperficie;

        setSuperficieCadastrale(finalSuperficie);
      } catch (err) {
        if (!active) return;
        console.error("Erreur chargement demande", err);
        setError("Erreur lors du chargement de la demande.");
        toast.error("Erreur lors du chargement de la demande.");
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [demandeKey, apiURL]);

  useEffect(() => {
    if (perimetrePoints.length < 3) return;
    const timer = window.setTimeout(() => {
      mapRef.current?.zoomToCurrentPolygon?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [perimetrePoints]);

  const getStatutConfig = (statut: string) => {
    const configs: Record<string, { label: string; icon: typeof Clock; className: string }> = {
      EN_COURS: { label: "En cours", icon: Clock, className: styles.badgeWarning },
      EN_ATTENTE: { label: "En attente", icon: Clock, className: styles.badgeWarning },
      ACCEPTEE: { label: "Acceptee", icon: CheckCircle2, className: styles.badgeSuccess },
      REJETEE: { label: "Rejetee", icon: XCircle, className: styles.badgeDanger },
    };
    return configs[statut] || configs.EN_COURS;
  };

  const timelineItems = useMemo(() => {
    const items = procedureEtapes.map((item, index) => {
      const statutRaw = (item.statut || "EN_ATTENTE").toUpperCase();
      const state = statutRaw === "TERMINEE"
        ? "completed"
        : statutRaw === "EN_COURS"
        ? "active"
        : "pending";
      const label = state === "completed"
        ? "Completee"
        : state === "active"
        ? "En cours"
        : "En attente";
      const description = state === "completed"
        ? "Etape terminee"
        : state === "active"
        ? "Etape en cours de traitement"
        : "Etape en attente";

      return {
        etape: item.etape?.lib_etape || `Etape ${index + 1}`,
        ordre: item.etape?.ordre_etape ?? index + 1,
        statut: label,
        state,
        description,
        date: item.date_fin || item.date_debut || null,
      };
    });

    return items.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }, [procedureEtapes]);

  const progressInfo = useMemo(() => {
    const total = timelineItems.length;
    if (!total) {
      return { percent: 0, label: "Aucune etape" };
    }
    const completed = timelineItems.filter((item) => item.state === "completed").length;
    const percent = Math.round((completed / total) * 100);
    const active = timelineItems.find((item) => item.state === "active");
    const label = active ? active.etape : completed === total ? "Dossier termine" : "En attente";
    return { percent, label };
  }, [timelineItems]);

  const handleDownloadPDF = () => {
    if (!apiURL) {
      toast.error("API URL manquant.");
      return;
    }
    if (!factureId) {
      toast.info("Aucune facture disponible pour cette demande.");
      return;
    }
    window.open(`${apiURL}/api/facture/${factureId}/pdf`, "_blank");
  };

  if (isLoading) {
    return (
      <InvestorLayout>
        <div className={styles.loadingState}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonHero}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonTabs}`} />
          <div className={styles.skeletonGrid}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonCard}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonCard}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonCard}`} />
          </div>
        </div>
      </InvestorLayout>
    );
  }

  if (error || !demande) {
    return (
      <InvestorLayout>
        <div className={styles.errorState}>
          <h2>Demande introuvable</h2>
          <p>{error || "Aucune information disponible pour cette demande."}</p>
          <Button onClick={() => navigate("/investisseur/demandes")}>Retour a la liste</Button>
        </div>
      </InvestorLayout>
    );
  }

  const statutValue = demande.statut_demande || "EN_COURS";
  const statutConfig = getStatutConfig(statutValue);
  const StatusIcon = statutConfig.icon;

  const codeDemande = demande.code_demande || `DEM-${demande.id_demande}`;
  const typePermisLabel =
    demande.typePermis?.lib_type || demande.typePermis?.code_type || "--";
  const typeProcedureLabel = demande.typeProcedure?.libelle || "--";
  const detenteurLabel =
    titulaireOverride ||
    demande.detenteur?.nom_societeFR ||
    demande.detenteur?.nom_societeAR ||
    "--";

  const primaryCommune =
    demande.commune?.nom_communeFR ||
    demande.communes?.find((item) => item.principale)?.commune?.nom_communeFR ||
    demande.communes?.[0]?.commune?.nom_communeFR ||
    "--";

  const primaryDaira =
    demande.daira?.nom_dairaFR ||
    demande.communes?.find((item) => item.principale)?.commune?.daira?.nom_dairaFR ||
    demande.communes?.[0]?.commune?.daira?.nom_dairaFR ||
    "--";

  const primaryWilaya =
    demande.wilaya?.nom_wilayaFR ||
    demande.communes?.find((item) => item.principale)?.commune?.daira?.wilaya?.nom_wilayaFR ||
    demande.communes?.[0]?.commune?.daira?.wilaya?.nom_wilayaFR ||
    "--";

  const superficieValue =
    typeof superficieCadastrale === "number"
      ? superficieCadastrale
      : typeof demande.superficie === "number"
      ? demande.superficie
      : null;
  const superficieLabel =
    typeof superficieValue === "number" ? `${superficieValue.toFixed(2)} ha` : "--";

  const dateDepotLabel = formatDate(
    demande.date_demande || demande.procedure?.date_debut_proc || null,
  );

  const totalMontantLabel =
    factureMontant != null
      ? `${factureMontant.toLocaleString("fr-FR")} DZD`
      : "--";
  const paiementEffectue = (factureStatut || "").toUpperCase().includes("PAY");
  const montantPaye = totalMontantLabel !== "--" && paiementEffectue ? totalMontantLabel : "0 DZD";
  const montantRestant = totalMontantLabel !== "--" && paiementEffectue ? "0 DZD" : totalMontantLabel;

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.heroHeader}>
          <div className={styles.heroNav}>
            <Button
              variant="ghost"
              onClick={() => navigate("/investisseur/demandes")}
              className={styles.backButton}
            >
              <ArrowLeft className="w-4 h-4" />
              Retour a la liste
            </Button>
            <Button onClick={handleDownloadPDF} className={styles.pdfButton}>
              <Download className="w-4 h-4" />
              Telecharger recapitulatif PDF
            </Button>
          </div>

          <div className={styles.heroContent}>
            <div className={styles.heroInfo}>
              <div className={styles.heroLabel}>
                <Sparkles className="w-4 h-4" />
                <span>Demande de permis</span>
              </div>
              <h1 className={styles.heroTitle}>{codeDemande}</h1>
              <p className={styles.heroSubtitle}>
                {typePermisLabel} • {typeProcedureLabel}
              </p>
            </div>
            <div className={`${styles.heroStatus} ${statutConfig.className}`}>
              <StatusIcon className="w-5 h-5" />
              <span>{statutConfig.label}</span>
            </div>
          </div>

          <div className={styles.progressCard}>
            <div className={styles.progressInfo}>
              <div className={styles.progressLabel}>
                <Clock className="w-4 h-4" />
                <span>Progression du dossier</span>
              </div>
              <span className={styles.progressValue}>{progressInfo.percent}%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressInfo.percent}%` }} />
            </div>
            <p className={styles.progressStatus}>{progressInfo.label}</p>
          </div>
        </div>

        <div className={styles.mainContent}>
          <Tabs defaultValue="general" className={styles.tabs}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="general" className={styles.tabTrigger}>
                <Eye className="w-4 h-4" />
                <span>Apercu</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className={styles.tabTrigger}>
                <FileText className="w-4 h-4" />
                <span>Documents</span>
              </TabsTrigger>
              <TabsTrigger value="paiements" className={styles.tabTrigger}>
                <CreditCard className="w-4 h-4" />
                <span>Paiements</span>
              </TabsTrigger>
              <TabsTrigger value="historique" className={styles.tabTrigger}>
                <History className="w-4 h-4" />
                <span>Historique</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className={styles.tabContent}>
              <div className={styles.infoGrid}>
                <Card className={styles.infoCard}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Titulaire</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={styles.infoValue}>{detenteurLabel}</p>
                  </CardContent>
                </Card>

                <Card className={styles.infoCard}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Date de depot</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={styles.infoValue}>{dateDepotLabel}</p>
                  </CardContent>
                </Card>

                <Card className={styles.infoCard}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Ruler className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Superficie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={styles.infoValue}>{superficieLabel}</p>
                  </CardContent>
                </Card>

                <Card className={`${styles.infoCard} ${styles.fullWidth}`}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Localisation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={styles.locationGrid}>
                      <div className={styles.locationItem}>
                        <span className={styles.locationLabel}>Wilaya</span>
                        <span className={styles.locationValue}>{primaryWilaya}</span>
                      </div>
                      <div className={styles.locationItem}>
                        <span className={styles.locationLabel}>Daira</span>
                        <span className={styles.locationValue}>{primaryDaira}</span>
                      </div>
                      <div className={styles.locationItem}>
                        <span className={styles.locationLabel}>Commune</span>
                        <span className={styles.locationValue}>{primaryCommune}</span>
                      </div>
                    </div>
                    <div className={styles.mapFrame}>
                      {perimetrePoints.length >= 3 ? (
                        <div className={styles.mapCanvas}>
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
                          <div className={styles.simpleLegend}>
                            <span className={styles.legendSwatch} />
                            <span>Votre perimetre</span>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.mapPlaceholder}>
                          <MapPin className="w-8 h-8" />
                          <p>Aucun perimetre disponible</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${styles.infoCard} ${styles.fullWidth}`}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Substances minieres</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={styles.substancesList}>
                      {substances.length > 0 ? (
                        substances.map((sub, idx) => (
                          <Badge key={idx} variant="secondary" className={styles.substanceBadge}>
                            {sub}
                          </Badge>
                        ))
                      ) : (
                        <span className={styles.locationValue}>Aucune substance renseignee</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="documents" className={styles.tabContent}>
              <div className={styles.documentsList}>
                {documents.length === 0 && (
                  <Card className={styles.documentCard}>
                    <div className={styles.documentInfo}>
                      <h4>Aucun document trouve</h4>
                      <p>Les documents n'ont pas encore ete renseignes.</p>
                    </div>
                  </Card>
                )}
                {documents.map((doc, index) => {
                  const statut = (doc.statut || "").toUpperCase();
                  const isValid = statut.includes("PRESENT") || statut.includes("VALIDE");
                  const isMissing = statut.includes("MANQUANT") || statut.includes("ABSENT");
                  const badgeClass = isValid
                    ? styles.badgeSuccess
                    : isMissing
                    ? styles.badgeDanger
                    : styles.badgeWarning;
                  const badgeLabel = isValid
                    ? "Present"
                    : isMissing
                    ? "Manquant"
                    : doc.statut || "En attente";
                  const docDate = doc.date ? formatDate(doc.date) : "--";
                  const fileUrl = doc.fileUrl
                    ? doc.fileUrl.startsWith("http")
                      ? doc.fileUrl
                      : `${apiURL}${doc.fileUrl}`
                    : null;

                  return (
                    <Card key={index} className={styles.documentCard}>
                      <div className={styles.documentIcon}>
                        <FileCheck className="w-6 h-6" />
                      </div>
                      <div className={styles.documentInfo}>
                        <h4>{doc.nom}</h4>
                        <p>
                          <span>{doc.size || "--"}</span>
                          <span>•</span>
                          <span>Televerse le {docDate}</span>
                        </p>
                      </div>
                      <div className={styles.documentActions}>
                        <Badge className={badgeClass}>
                          {isValid ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : isMissing ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          {badgeLabel}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={styles.downloadIconBtn}
                          onClick={() => fileUrl && window.open(fileUrl, "_blank")}
                          disabled={!fileUrl}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="paiements" className={styles.tabContent}>
              <div className={styles.paiementsList}>
                {paiements.length === 0 && (
                  <Card className={styles.paiementCard}>
                    <div className={styles.paiementInfo}>
                      <h4>Aucune facture disponible</h4>
                      <p>Le paiement n'a pas encore ete genere.</p>
                    </div>
                  </Card>
                )}
                {paiements.map((paiement, index) => {
                  const statut = (paiement.statut || "").toUpperCase();
                  const isPaid = statut.includes("PAY");
                  const badgeClass = isPaid ? styles.badgeSuccess : styles.badgeWarning;
                  const badgeLabel = isPaid ? "Paye" : paiement.statut || "En attente";

                  return (
                    <Card key={index} className={styles.paiementCard}>
                      <div className={styles.paiementIcon}>
                        <Banknote className="w-6 h-6" />
                      </div>
                      <div className={styles.paiementInfo}>
                        <h4>{paiement.libelle}</h4>
                        <p>
                          {paiement.date ? `Emise le ${formatDate(paiement.date)}` : "--"}
                        </p>
                      </div>
                      <div className={styles.paiementAmount}>
                        <span className={styles.amount}>{paiement.montant}</span>
                        <Badge className={badgeClass}>
                          {isPaid ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {badgeLabel}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}

                <Card className={styles.totalCard}>
                  <div className={styles.totalInfo}>
                    <span>Total a payer</span>
                    <span className={styles.totalAmount}>{totalMontantLabel}</span>
                  </div>
                  <div className={styles.totalStatus}>
                    <span>Paye: {montantPaye}</span>
                    <span>Restant: {montantRestant}</span>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="historique" className={styles.tabContent}>
              {timelineItems.length === 0 ? (
                <Card className={styles.documentCard}>
                  <div className={styles.documentInfo}>
                    <h4>Aucun historique disponible</h4>
                    <p>Les etapes ne sont pas encore chargees.</p>
                  </div>
                </Card>
              ) : (
                <div className={styles.timeline}>
                  {timelineItems.map((item, index) => {
                    const isCompleted = item.state === "completed";
                    const isActive = item.state === "active";

                    return (
                      <div key={index} className={styles.timelineItem}>
                        <div
                          className={`${styles.timelineDot} ${
                            isCompleted
                              ? styles.completed
                              : isActive
                              ? styles.active
                              : styles.pending
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isActive ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <div className={styles.emptyDot} />
                          )}
                        </div>
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineHeader}>
                            <h4>{item.etape}</h4>
                            <Badge
                              className={
                                isCompleted
                                  ? styles.badgeSuccess
                                  : isActive
                                  ? styles.badgeWarning
                                  : styles.badgeMuted
                              }
                            >
                              {item.statut}
                            </Badge>
                          </div>
                          <p className={styles.timelineDesc}>{item.description}</p>
                          {item.date && (
                            <span className={styles.timelineDate}>{formatDate(item.date)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </InvestorLayout>
  );
};

export default DemandeDetails;
