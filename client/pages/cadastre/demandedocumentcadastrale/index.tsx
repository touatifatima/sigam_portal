import axios from "axios";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  MapPinned,
  Phone,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { useAuthStore } from "@/src/store/useAuthStore";
import {
  getDefaultDashboardPath,
  isCadastreRole,
} from "@/src/utils/roleNavigation";
import { toast } from "react-toastify";
import styles from "./DemandeDocumentCadastrale.module.css";

const apiURL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const buildApiUrl = (path: string) => `${apiURL}${path}`;

type VerificationMode = "phone" | "email";
type StepNumber = 1 | 2 | 3;
type DocumentId = "extrait" | "plan";

type RequestForm = {
  qrCode: string;
  codePermis: string;
  titulaire: string;
  numeroRc: string;
  typePermis: string;
  nin: string;
  nom: string;
  prenom: string;
  numeroPiece: string;
  emailContact: string;
  telephoneContact: string;
  qualiteDemandeur: string;
  objetDemande: string;
  baseCommunication: string;
};

type CadastreRequestResponse = {
  message?: string;
  demande?: {
    id: number;
    referenceDemande: string;
    statut?: string;
    otpVerifiedAt?: string | null;
    piecesJointes?: Array<{ typePiece: string; fichierUrl: string }>;
  };
};

type UploadResponse = {
  message?: string;
  piece?: {
    id: number;
    typePiece: string;
    fichierUrl: string;
  };
};

type DocumentOption = {
  id: DocumentId;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  icon: typeof FileText;
  accent: "green" | "teal";
};

const DOCUMENT_OPTIONS: DocumentOption[] = [
  {
    id: "extrait",
    title: "Extrait cadastral officiel",
    subtitle: "Document d'identification juridique du titre",
    description:
      "Fiche officielle avec les informations du titre, du titulaire et des elements necessaires au suivi cadastral.",
    tags: ["PDF", "A4", "QR de verification"],
    icon: FileText,
    accent: "green",
  },
  {
    id: "plan",
    title: "Plan cadastral officiel",
    subtitle: "Representation cartographique du perimetre",
    description:
      "Plan de reference avec les limites, sommets, points de controle et la lecture cartographique du titre.",
    tags: ["PDF", "A4 paysage", "Coordonnees"],
    icon: MapPinned,
    accent: "teal",
  },
];

const DEFAULT_FORM: RequestForm = {
  qrCode: "QR-PEM48-2026-0317",
  codePermis: "PEM/48/2026/0317",
  titulaire: "SARL AURIFERE DU SUD MINES",
  numeroRc: "16/00-1234567 B 24",
  typePermis: "Permis d'exploitation",
  nin: "118420056398",
  nom: "Kerrouche",
  prenom: "Boualem",
  numeroPiece: "118420056398",
  emailContact: "b.kerrouche@cadastre-demo.dz",
  telephoneContact: "+213 555 12 34 89",
  qualiteDemandeur: "Representant legal",
  objetDemande: "Constitution de dossier administratif",
  baseCommunication:
    "Demande introduite dans le cadre de la verification et de la constitution du dossier cadastral.",
};

const OTP_LENGTH = 6;

export default function DemandeDocumentCadastralePage() {
  const navigate = useNavigate();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();

  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [verificationMode, setVerificationMode] = useState<VerificationMode>("phone");
  const [form, setForm] = useState<RequestForm>(DEFAULT_FORM);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [requestReference, setRequestReference] = useState<string>("CDC-EN-ATTENTE");
  const [scanQrDone, setScanQrDone] = useState(false);
  const [scanIdentityDone, setScanIdentityDone] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [qrFileName, setQrFileName] = useState<string>("Aucun fichier");
  const [identityFileName, setIdentityFileName] = useState<string>("Aucun fichier");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [step1Busy, setStep1Busy] = useState(false);
  const [step2Busy, setStep2Busy] = useState(false);
  const [step3Busy, setStep3Busy] = useState(false);
  const [attachmentsUploaded, setAttachmentsUploaded] = useState(false);
  const [generatedRequestMessage, setGeneratedRequestMessage] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [selectedDocs, setSelectedDocs] = useState<DocumentId[]>(["extrait", "plan"]);
  const [generationKey, setGenerationKey] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(15);
  const [processingReady, setProcessingReady] = useState(false);
  const [processingStep, setProcessingStep] = useState<1 | 2 | 3 | 4>(1);

  const qrInputRef = useRef<HTMLInputElement | null>(null);
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

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

  const displayName = useMemo(
    () => auth?.username || auth?.email || "Utilisateur cadastre",
    [auth?.email, auth?.username],
  );

  const selectedDocuments = useMemo(
    () => DOCUMENT_OPTIONS.filter((doc) => selectedDocs.includes(doc.id)),
    [selectedDocs],
  );

  const otpComplete = otpDigits.every((digit) => digit.trim().length === 1);
  const otpCode = otpDigits.join("");
  const primaryDocumentType = useMemo(
    () =>
      selectedDocs.includes("plan")
        ? "PLAN_CADASTRAL_OFFICIEL"
        : "EXTRAIT_CERTIFIE_CONFORME",
    [selectedDocs],
  );
  const selectedDocumentsLabel = useMemo(
    () =>
      selectedDocuments.length > 0
        ? selectedDocuments.map((doc) => doc.title).join(" + ")
        : "Extrait cadastral officiel",
    [selectedDocuments],
  );
  const canContinueStep1 = requestId !== null && otpSent && otpComplete && scanQrDone && scanIdentityDone;
  const canContinueStep2 = selectedDocuments.length > 0;

  useEffect(() => {
    if (currentStep !== 3) return;

    setProcessingReady(false);
    setProcessingStep(1);
    setGenerationProgress(15);

    const timers: number[] = [];

    timers.push(
      window.setTimeout(() => {
        setGenerationProgress(45);
        setProcessingStep(2);
      }, 1200),
    );

    timers.push(
      window.setTimeout(() => {
        setGenerationProgress(75);
        setProcessingStep(3);
      }, 2400),
    );

    timers.push(
      window.setTimeout(() => {
        setGenerationProgress(100);
        setProcessingStep(4);
      }, 3600),
    );

    timers.push(
      window.setTimeout(() => {
        setProcessingReady(true);
      }, 4300),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [currentStep, generationKey]);

  const updateForm = (field: keyof RequestForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleScanBoxClick = (ref: RefObject<HTMLInputElement | null>) => {
    ref.current?.click();
  };

  const handleFilePick = (
    event: ChangeEvent<HTMLInputElement>,
    kind: "qr" | "identity",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (kind === "qr") {
      setQrFile(file);
      setQrFileName(file.name);
      setScanQrDone(true);
      setForm((prev) => ({
        ...prev,
        qrCode: prev.qrCode || "QR-PEM48-2026-0317",
        codePermis: prev.codePermis || "PEM/48/2026/0317",
        titulaire: prev.titulaire || "SARL AURIFERE DU SUD MINES",
        numeroRc: prev.numeroRc || "16/00-1234567 B 24",
      }));
    }

    if (kind === "identity") {
      setIdentityFile(file);
      setIdentityFileName(file.name);
      setScanIdentityDone(true);
      setForm((prev) => ({
        ...prev,
        nin: prev.nin || "118420056398",
        nom: prev.nom || "Kerrouche",
        prenom: prev.prenom || "Boualem",
      }));
    }

    event.target.value = "";
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
    setOtpError(null);
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const uploadPiece = async (requestIdValue: number, typePiece: "SCAN_TITRE" | "SCAN_CARTE_IDENTITE", file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axios.post<UploadResponse>(
      buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${requestIdValue}/pieces-jointes/${typePiece}`),
      formData,
      {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data;
  };

  const createCadastreRequest = async () => {
    if (!scanQrDone || !scanIdentityDone || !qrFile || !identityFile) {
      throw new Error("Veuillez d'abord fournir le scan du titre et la carte d'identite.");
    }

    const payload = {
      typeDocument: primaryDocumentType,
      qrCodeTitre: form.qrCode.trim(),
      codePermis: form.codePermis.trim(),
      titulaire: form.titulaire.trim(),
      numeroRc: form.numeroRc.trim(),
      typePermis: form.typePermis.trim(),
      nin: form.nin.trim(),
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      emailContact: form.emailContact.trim(),
      telephoneContact: form.telephoneContact.trim(),
      canalVerification: verificationMode === "phone" ? "TELEPHONE" : "EMAIL",
      qualiteDemandeur: form.qualiteDemandeur.trim(),
      objetDemande: `${form.objetDemande.trim()} - ${selectedDocumentsLabel}`,
      baseCommunication: form.baseCommunication.trim(),
    };

    const response = await axios.post<CadastreRequestResponse>(
      buildApiUrl("/api/cadastre/demandes-documents-cadastraux"),
      payload,
      { withCredentials: true },
    );

    const demande = response.data?.demande;
    if (!demande?.id) {
      throw new Error("La demande a ete creee mais l'identifiant est manquant.");
    }

    setRequestId(demande.id);
    setRequestReference(demande.referenceDemande || demande.id.toString());
    setGeneratedRequestMessage(response.data?.message || "Demande cadastrale creee.");
    return demande;
  };

  const resendOtp = async () => {
    if (!requestId) {
      throw new Error("Aucune demande n'a encore ete creee.");
    }

    await axios.post(
      buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${requestId}/otp/resend`),
      {},
      { withCredentials: true },
    );
  };

  const handleSendOtp = async () => {
    setStep1Busy(true);
    setNetworkError(null);
    setOtpError(null);
    try {
      if (!requestId) {
        await createCadastreRequest();
      } else {
        await resendOtp();
      }

      setOtpSent(true);
      setOtpVerified(false);
      setAttachmentsUploaded(false);
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      toast.success("Code OTP envoye avec succes.");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? (error.response?.data?.message as string) ||
            error.response?.data?.error ||
            error.message
          : error instanceof Error
            ? error.message
            : "Impossible d'envoyer le code OTP.";
      setNetworkError(message);
      toast.error(message);
    } finally {
      setStep1Busy(false);
    }
  };

  const handleVerifyAndContinue = async () => {
    if (!requestId) {
      setOtpError("Veuillez d'abord envoyer le code de verification.");
      return;
    }

    if (!otpComplete) {
      setOtpError("Saisissez les 6 chiffres du code OTP.");
      return;
    }

    if (!qrFile || !identityFile) {
      setOtpError("Les deux scans obligatoires doivent etre selectionnes.");
      return;
    }

    setStep1Busy(true);
    setNetworkError(null);
    setOtpError(null);
    try {
      await axios.post(
        buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${requestId}/otp/verify`),
        { code: otpCode },
        { withCredentials: true },
      );

      setOtpVerified(true);
      setStep1Busy(true);

      await uploadPiece(requestId, "SCAN_TITRE", qrFile);
      await uploadPiece(requestId, "SCAN_CARTE_IDENTITE", identityFile);
      setAttachmentsUploaded(true);

      toast.success("Verification terminee et pieces jointes transmettes.");
      setCurrentStep(2);
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? (error.response?.data?.message as string) ||
            error.response?.data?.error ||
            error.message
          : error instanceof Error
            ? error.message
            : "Impossible de verifier la demande.";
      setOtpError(message);
      setNetworkError(message);
      toast.error(message);
    } finally {
      setStep1Busy(false);
    }
  };

  const toggleDocument = (id: DocumentId) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const goToStep = (step: StepNumber) => {
    if (step === 1) {
      setCurrentStep(1);
      setProcessingReady(false);
    }

    if (step === 2) {
      setCurrentStep(2);
      setProcessingReady(false);
    }

    if (step === 3) {
      setCurrentStep(3);
      setGenerationKey((value) => value + 1);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerateDocuments = async () => {
    if (!canContinueStep2 || !requestId) return;

    setStep2Busy(true);
    setNetworkError(null);
    try {
      const response = await axios.post<CadastreRequestResponse>(
        buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${requestId}/submit`),
        {
          typeDocument: primaryDocumentType,
          qualiteDemandeur: form.qualiteDemandeur.trim(),
          objetDemande: `${form.objetDemande.trim()} - ${selectedDocumentsLabel}`,
          baseCommunication: form.baseCommunication.trim(),
        },
        { withCredentials: true },
      );

      setGeneratedRequestMessage(
        response.data?.message ||
          "Votre demande de cadastre a ete bien transmise avec succes.",
      );
      toast.success("Votre demande a ete transmise avec succes.");
      goToStep(3);
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? (error.response?.data?.message as string) ||
            error.response?.data?.error ||
            error.message
          : error instanceof Error
            ? error.message
            : "Impossible de transmettre la demande.";
      setNetworkError(message);
      toast.error(message);
    } finally {
      setStep2Busy(false);
    }
  };

  const handleResetWorkflow = () => {
    setCurrentStep(1);
    setVerificationMode("phone");
    setForm(DEFAULT_FORM);
    setRequestId(null);
    setRequestReference("CDC-EN-ATTENTE");
    setScanQrDone(false);
    setScanIdentityDone(false);
    setQrFile(null);
    setIdentityFile(null);
    setQrFileName("Aucun fichier");
    setIdentityFileName("Aucun fichier");
    setOtpSent(false);
    setOtpVerified(false);
    setOtpError(null);
    setNetworkError(null);
    setStep1Busy(false);
    setStep2Busy(false);
    setStep3Busy(false);
    setAttachmentsUploaded(false);
    setGeneratedRequestMessage(null);
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    setSelectedDocs(["extrait", "plan"]);
    setGenerationProgress(15);
    setProcessingReady(false);
    setProcessingStep(1);
    setGenerationKey((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isAuthReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  const steps = [
    {
      number: 1 as const,
      title: "Identification du demandeur",
      subtitle: "Verification d'identite",
    },
    {
      number: 2 as const,
      title: "Selection des documents",
      subtitle: "Extrait et/ou plan cadastral",
    },
    {
      number: 3 as const,
      title: "Telechargement",
      subtitle: "Documents generes",
    },
  ];

  const downloads = selectedDocuments.length > 0 ? selectedDocuments : DOCUMENT_OPTIONS;

  return (
    <InvestorLayout>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.breadcrumb}>Documents cadastraux / <b>Nouvelle demande</b></div>
          <h1 className={styles.pageTitle}>Demande de documents cadastraux</h1>
          <p className={styles.pageLead}>
            Generez et telechargez l&apos;extrait cadastral et le plan cadastral officiels
            d&apos;un titre minier.
          </p>

          <div className={styles.heroBar}>
            <div className={styles.heroBadge}>
              <ShieldCheck size={18} />
              <span>Role cadastre</span>
            </div>
            <div className={styles.heroBadge}>
              <Sparkles size={18} />
              <span>Workflow premium</span>
            </div>
            <div className={styles.heroBadge}>
              <QrCode size={18} />
              <span>OCR et OTP</span>
            </div>
          </div>
        </section>

        <section className={styles.stepper} aria-label="Progression de la demande">
          {steps.map((step, index) => {
            const isCurrent = currentStep === step.number;
            const isDone = currentStep > step.number;
            return (
              <div key={step.number} className={styles.stepGroup}>
                <div
                  className={[
                    styles.step,
                    isCurrent ? styles.stepCurrent : "",
                    isDone ? styles.stepDone : "",
                  ].join(" ")}
                >
                  <div className={styles.stepCircle}>{step.number}</div>
                  <div className={styles.stepText}>
                    <div className={styles.stepTitle}>{step.title}</div>
                    <div className={styles.stepSubtitle}>{step.subtitle}</div>
                  </div>
                </div>
                {index < steps.length - 1 ? (
                  <div className={[styles.stepConnector, isDone ? styles.stepConnectorDone : ""].join(" ")} />
                ) : null}
              </div>
            );
          })}
        </section>

        <section className={currentStep === 1 ? styles.panelActive : styles.panelHidden}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>1. Scannez le QR code du permis</h2>
              <p className={styles.cardDesc}>
                Utilisez la camera de votre appareil pour scanner le QR code figurant sur la
                decision d&apos;octroi du titre minier.
              </p>
            </div>

            {(generatedRequestMessage || networkError) && (
              <div
                className={styles.infoBanner}
                style={
                  networkError
                    ? {
                        background: "#fef2f2",
                        borderColor: "#fecaca",
                        color: "#b91c1c",
                      }
                    : undefined
                }
              >
                <Sparkles size={18} />
                <span>{networkError || generatedRequestMessage}</span>
              </div>
            )}

            {requestId ? (
              <div className={styles.summaryPanel}>
                <div>
                  <div className={styles.summaryTitle}>Demande creee</div>
                  <div className={styles.summaryText}>
                    Reference {requestReference} - {attachmentsUploaded ? "Pieces jointes transmises" : "Pieces jointes en attente"}
                  </div>
                </div>
                <div className={styles.summaryStats}>
                  <div>
                    <strong>{verificationMode === "phone" ? "Telephone" : "Email"}</strong>
                    <span>canal OTP</span>
                  </div>
                  <div>
                    <strong>{otpSent ? "OTP actif" : "OTP a envoyer"}</strong>
                    <span>etat de verification</span>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className={styles.scanBox}
              onClick={() => handleScanBoxClick(qrInputRef)}
            >
              <div className={styles.scanFrame}>
                <span className={`${styles.corner} ${styles.cornerTL}`} />
                <span className={`${styles.corner} ${styles.cornerTR}`} />
                <span className={`${styles.corner} ${styles.cornerBL}`} />
                <span className={`${styles.corner} ${styles.cornerBR}`} />
                <ScanLine size={30} className={styles.scanIcon} />
              </div>
              <div className={styles.scanLabel}>Cliquez pour activer la camera</div>
              <div className={styles.scanSub}>
                ou <u>importer une photo du QR code</u>
              </div>
              <input
                ref={qrInputRef}
                type="file"
                accept="image/*,.pdf"
                className={styles.hiddenInput}
                onChange={(event) => handleFilePick(event, "qr")}
              />
            </button>

            <div className={[styles.scanResult, scanQrDone ? styles.scanResultVisible : ""].join(" ")}>
              <div className={styles.scanResultIcon}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className={styles.scanResultTitle}>QR code du permis reconnu</div>
                <div className={styles.scanResultText}>
                  Fichier: {qrFileName}. Titre associe: {form.codePermis} - {form.titulaire}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>2. Informations du titre minier</h2>
              <p className={styles.cardDesc}>
                Ces informations sont pre-remplies a partir du QR code scanne. Verifiez-les avant de continuer.
              </p>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Code QR</span>
                <input
                  className={styles.fieldInput}
                  value={form.qrCode}
                  onChange={(event) => updateForm("qrCode", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Code de permis</span>
                <input
                  className={styles.fieldInput}
                  value={form.codePermis}
                  onChange={(event) => updateForm("codePermis", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Titulaire</span>
                <input
                  className={styles.fieldInput}
                  value={form.titulaire}
                  onChange={(event) => updateForm("titulaire", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Numero de registre de commerce</span>
                <input
                  className={styles.fieldInput}
                  value={form.numeroRc}
                  onChange={(event) => updateForm("numeroRc", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Type de permis</span>
                <input
                  className={styles.fieldInput}
                  value={form.typePermis}
                  onChange={(event) => updateForm("typePermis", event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>3. Scannez votre carte d'identite</h2>
              <p className={styles.cardDesc}>
                Presentez le recto de la carte d'identite nationale du representant legal ou de la personne mandatee.
              </p>
            </div>

            <button
              type="button"
              className={styles.scanBox}
              onClick={() => handleScanBoxClick(identityInputRef)}
            >
              <div className={`${styles.scanFrame} ${styles.scanFrameWide}`}>
                <span className={`${styles.corner} ${styles.cornerTL}`} />
                <span className={`${styles.corner} ${styles.cornerTR}`} />
                <span className={`${styles.corner} ${styles.cornerBL}`} />
                <span className={`${styles.corner} ${styles.cornerBR}`} />
                <Upload size={30} className={styles.scanIcon} />
              </div>
              <div className={styles.scanLabel}>Cliquez pour activer la camera</div>
              <div className={styles.scanSub}>
                ou <u>importer une photo de la carte</u>
              </div>
              <input
                ref={identityInputRef}
                type="file"
                accept="image/*,.pdf"
                className={styles.hiddenInput}
                onChange={(event) => handleFilePick(event, "identity")}
              />
            </button>

            <div className={[styles.scanResult, scanIdentityDone ? styles.scanResultVisible : ""].join(" ")}>
              <div className={styles.scanResultIcon}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className={styles.scanResultTitle}>Carte d'identite reconnue</div>
                <div className={styles.scanResultText}>
                  Fichier: {identityFileName}. Representant associe: {form.prenom} {form.nom} - NIN {form.nin}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>4. Identite du detenteur</h2>
              <p className={styles.cardDesc}>
                Ces informations sont pre-remplies a partir de la carte d'identite scannee. Verifiez-les avant de continuer.
              </p>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nom</span>
                <input
                  className={styles.fieldInput}
                  value={form.nom}
                  disabled={step1Busy}
                  onChange={(event) => updateForm("nom", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Prenom</span>
                <input
                  className={styles.fieldInput}
                  value={form.prenom}
                  disabled={step1Busy}
                  onChange={(event) => updateForm("prenom", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>NIN</span>
                <input
                  className={styles.fieldInput}
                  value={form.nin}
                  disabled={step1Busy}
                  onChange={(event) => updateForm("nin", event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Numero de piece d'identite</span>
                <input
                  className={styles.fieldInput}
                  value={form.numeroPiece}
                  disabled={step1Busy}
                  onChange={(event) => updateForm("numeroPiece", event.target.value)}
                />
              </label>
            </div>

            <div className={styles.sectionDivider}>Coordonnees pour OTP</div>
            <div className={styles.verificationSwitch}>
              <button
                type="button"
                className={[
                  styles.switchButton,
                  verificationMode === "phone" ? styles.switchButtonActive : "",
                ].join(" ")}
                onClick={() => setVerificationMode("phone")}
              >
                <Phone size={16} />
                Numero de telephone
              </button>
              <button
                type="button"
                className={[
                  styles.switchButton,
                  verificationMode === "email" ? styles.switchButtonActive : "",
                ].join(" ")}
                onClick={() => setVerificationMode("email")}
              >
                <Mail size={16} />
                Adresse email
              </button>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  {verificationMode === "phone" ? "Telephone du representant" : "Email du representant"}
                </span>
                <div className={styles.inlineRow}>
                  <input
                    className={styles.fieldInput}
                    value={verificationMode === "phone" ? form.telephoneContact : form.emailContact}
                    disabled={step1Busy}
                    onChange={(event) =>
                      verificationMode === "phone"
                        ? updateForm("telephoneContact", event.target.value)
                        : updateForm("emailContact", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleSendOtp}
                    disabled={step1Busy}
                  >
                    {requestId ? "Renvoyer le code" : "Envoyer le code"}
                  </button>
                </div>
                <span className={styles.fieldHint}>
                  Le code de verification sera envoye au canal selectionne.
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Qualite du demandeur</span>
                <select
                  className={styles.fieldSelect}
                  value={form.qualiteDemandeur}
                  disabled={step1Busy}
                  onChange={(event) => updateForm("qualiteDemandeur", event.target.value)}
                >
                  <option>Titulaire du titre minier</option>
                  <option>Representant legal</option>
                  <option>Mandataire</option>
                  <option>Administration / organisme public</option>
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.fieldLabel}>Objet de la demande</span>
                <select
                  className={styles.fieldSelect}
                  value={form.objetDemande}
                  disabled={step1Busy}
                  onChange={(event) => updateForm("objetDemande", event.target.value)}
                >
                  <option>Constitution de dossier administratif</option>
                  <option>Transaction ou cession de droits miniers</option>
                  <option>Contentieux ou procedure judiciaire</option>
                  <option>Financement / garantie bancaire</option>
                  <option>Controle et suivi reglementaire</option>
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.fieldLabel}>Base de communication ou interet legitime</span>
                <textarea
                  className={styles.fieldTextarea}
                  value={form.baseCommunication}
                  disabled={step1Busy}
                  onChange={(event) => updateForm("baseCommunication", event.target.value)}
                  placeholder="Precisez le fondement legal ou l'interet legitime justifiant la communication des documents cadastraux."
                />
              </label>
            </div>

            {otpSent ? (
              <div className={styles.otpBox}>
                <div className={styles.cardTitleSmall}>Code OTP a 6 chiffres</div>
                <div className={styles.otpRow}>
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => {
                        otpRefs.current[index] = node;
                      }}
                      className={styles.otpInput}
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    />
                  ))}
                </div>
                {otpError ? <div className={styles.errorText}>{otpError}</div> : null}
                <div className={styles.fieldHint}>
                  Code envoye au {verificationMode === "phone" ? form.telephoneContact : form.emailContact}.
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.footerBar}>
            <div className={styles.footerNote}>
              <ShieldCheck size={16} />
              <span>La verification OTP doit etre terminee avant de passer a la selection des documents.</span>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleVerifyAndContinue}
              disabled={!canContinueStep1 || step1Busy}
            >
              {step1Busy ? "Verification..." : "Verifier et continuer"}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <section className={currentStep === 2 ? styles.panelActive : styles.panelHidden}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Choisissez le ou les documents souhaites</h2>
              <p className={styles.cardDesc}>
                Selectionnez un ou plusieurs documents officiels a generer pour le titre identifie a l'etape precedente.
              </p>
            </div>

            <div className={styles.documentGrid}>
              {DOCUMENT_OPTIONS.map((document) => {
                const selected = selectedDocs.includes(document.id);
                const Icon = document.icon;
                return (
                  <button
                    key={document.id}
                    type="button"
                    className={[
                      styles.documentCard,
                      selected ? styles.documentCardSelected : "",
                      document.accent === "teal" ? styles.documentCardTeal : "",
                    ].join(" ")}
                    onClick={() => toggleDocument(document.id)}
                  >
                    <div className={styles.documentCheck}>{selected ? <CheckCircle2 size={18} /> : null}</div>
                    <div className={styles.documentIcon}>
                      <Icon size={22} />
                    </div>
                    <div className={styles.documentTitle}>{document.title}</div>
                    <div className={styles.documentSubtitle}>{document.subtitle}</div>
                    <div className={styles.documentDescription}>{document.description}</div>
                    <div className={styles.documentTags}>
                      {document.tags.map((tag) => (
                        <span key={tag} className={styles.documentTag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={styles.infoBanner}>
              <Sparkles size={18} />
              <span>
                Votre demande passera automatiquement en mode premium de transmission. Vous recevrez une notification
                dans votre espace cadastre des que le document sera pret.
              </span>
            </div>

            <div className={styles.summaryPanel}>
              <div>
                <div className={styles.summaryTitle}>Recapitulatif de la demande</div>
                <div className={styles.summaryText}>
                  {form.titulaire} - {form.codePermis}
                </div>
                <div className={styles.summaryText}>
                  Reference {requestReference} - {selectedDocumentsLabel}
                </div>
              </div>
              <div className={styles.summaryStats}>
                <div>
                  <strong>{selectedDocuments.length}</strong>
                  <span>document(s) selectionne(s)</span>
                </div>
                <div>
                  <strong>{form.qualiteDemandeur}</strong>
                  <span>qualite du demandeur</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.footerBar}>
            <button type="button" className={styles.secondaryButton} onClick={() => goToStep(1)}>
              Retour
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleGenerateDocuments}
              disabled={!canContinueStep2 || step2Busy}
            >
              {step2Busy ? "Transmission..." : "Confirmer et generer"}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <section className={currentStep === 3 ? styles.panelActive : styles.panelHidden}>
          {!processingReady ? (
            <div className={styles.card}>
              <div className={styles.processingHeader}>
                <div className={styles.processingSpinner} />
                <div>
                  <div className={styles.processingTitle}>
                    Vos documents sont en cours de generation
                  </div>
                  <div className={styles.processingText}>
                    Reference demande {requestReference} - Ne fermez pas cette page
                  </div>
                </div>
              </div>

              <div className={styles.processingTrack}>
                <div className={styles.processingFill} style={{ width: `${generationProgress}%` }} />
              </div>

              <div className={styles.processingList}>
                <div className={[styles.processingItem, styles.processingDone].join(" ")}>
                  <span className={styles.processingCheck}>
                    <CheckCircle2 size={16} />
                  </span>
                  <span>Identite et titre minier verifies</span>
                </div>
                <div
                  className={[
                    styles.processingItem,
                    processingStep >= 2 ? styles.processingDone : "",
                    processingStep === 2 ? styles.processingActive : "",
                  ].join(" ")}
                >
                  <span className={styles.processingCheck}>
                    {processingStep >= 2 ? <CheckCircle2 size={16} /> : <span className={styles.processingDot} />}
                  </span>
                  <span>Generation des documents cadastraux</span>
                </div>
                <div
                  className={[
                    styles.processingItem,
                    processingStep >= 3 ? styles.processingDone : "",
                    processingStep === 3 ? styles.processingActive : "",
                  ].join(" ")}
                >
                  <span className={styles.processingCheck}>
                    {processingStep >= 3 ? <CheckCircle2 size={16} /> : <span className={styles.processingDot} />}
                  </span>
                  <span>Signature electronique et code de verification</span>
                </div>
                <div
                  className={[
                    styles.processingItem,
                    processingStep >= 4 ? styles.processingDone : "",
                    processingStep === 4 ? styles.processingActive : "",
                  ].join(" ")}
                >
                  <span className={styles.processingCheck}>
                    {processingStep >= 4 ? <CheckCircle2 size={16} /> : <span className={styles.processingDot} />}
                  </span>
                  <span>Transmission des fichiers a votre espace</span>
                </div>
              </div>

              <div className={styles.infoBanner}>
                <Sparkles size={18} />
                <span>
                  Le delai moyen de transmission est de quelques instants. Vous recevrez egalement une notification
                  par email une fois les documents disponibles.
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.successHeader}>
                <div className={styles.successIcon}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div className={styles.successTitle}>
                    Votre demande de cadastre a ete transmise avec succes
                  </div>
                  <div className={styles.successText}>
                    Vous recevrez une notification dans votre espace cadastre des que votre document aura ete prepare.
                    {generatedRequestMessage ? ` ${generatedRequestMessage}` : ""}
                  </div>
                </div>
              </div>

              <div className={styles.successBanner}>
                <Sparkles size={18} />
                <span>
                  Demande enregistree et transmise. Le dossier a bien ete pris en charge par le workflow cadastral.
                </span>
              </div>

              <div className={styles.downloadList}>
                {downloads.map((document) => {
                  const isExtrait = document.id === "extrait";
                  return (
                    <div key={document.id} className={styles.downloadRow}>
                      <div className={styles.downloadIcon}>
                        <document.icon size={20} />
                      </div>
                      <div className={styles.downloadMeta}>
                        <div className={styles.downloadTitle}>{document.title}.pdf</div>
                        <div className={styles.downloadSub}>
                          {isExtrait ? "6,7 Ko - 1 page" : "7,4 Ko - 1 page - A4 paysage"}
                        </div>
                      </div>
                      <button type="button" className={styles.downloadButton}>
                        <Download size={16} />
                        Telecharger
                      </button>
                    </div>
                  );
                })}
              </div>

              <button type="button" className={`${styles.primaryButton} ${styles.fullWidthButton}`}>
                <Download size={18} />
                Telecharger tout (.zip)
              </button>
            </div>
          )}

          <div className={styles.footerBar}>
            {processingReady ? (
              <button type="button" className={styles.secondaryButton} onClick={handleResetWorkflow}>
                Nouvelle demande
              </button>
            ) : (
              <button type="button" className={styles.secondaryButton} onClick={() => goToStep(2)}>
                Retour
              </button>
            )}
            <div className={styles.footerNote}>
              <ShieldCheck size={16} />
              <span>
                {processingReady
                  ? "Le dossier est termine. Vous pouvez repartir sur une nouvelle demande."
                  : "Le traitement est en cours. Le workflow passe automatiquement a la phase finale."}
              </span>
            </div>
          </div>
        </section>
      </main>
    </InvestorLayout>
  );
}
