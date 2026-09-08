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
  Camera,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  ImagePlus,
  LayoutDashboard,
  Mail,
  MapPinned,
  Phone,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import ProgressStepper from "@/components/ProgressStepper";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { useAuthStore } from "@/src/store/useAuthStore";
import {
  getDefaultDashboardPath,
  isCadastreRole,
} from "@/src/utils/roleNavigation";
import { toast } from "react-toastify";
import styles from "./DemandeDocumentCadastrale.module.css";

const apiURL = (
  process.env.NEXT_PUBLIC_API_URL ||
  (import.meta as any)?.env?.VITE_API_URL ||
  "http://localhost:3016"
).replace(/\/+$/, "");
const buildApiUrl = (path: string) => `${apiURL}${path}`;

type VerificationMode = "phone" | "email";
type StepNumber = 1 | 2 | 3;
type DocumentId = string;
type TitleVerificationState = "idle" | "checking" | "valid" | "invalid";
type ContactVerificationState = "idle" | "checking" | "valid" | "invalid";
type PreviewModalState = {
  url: string;
  title: string;
  fileName: string;
  mimeType: string;
} | null;

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
  objetDemandeAutre: string;
  baseCommunication: string;
};

type TypePermisOption = {
  id: number;
  lib_type: string | null;
  code_type: string | null;
};

type CadastreRequestResponse = {
  message?: string;
  demande?: {
    id: number;
    referenceDemande: string;
    statut?: string;
    otpVerifiedAt?: string | null;
    piecesJointes?: Array<{ typePiece: string; fichierUrl: string }>;
    accuseReceptionPdfUrl?: string | null;
    accuseReceptionPdfFilename?: string | null;
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

type DocumentReferenceResponse = {
  id: number;
  code: string;
  label: string;
  subtitle: string | null;
  description: string | null;
  iconKey: string | null;
  accentKey: string | null;
  isDefault: boolean;
  sortOrder: number;
};

const QUALITE_DEMANDEUR_OPTIONS = [
  "Representant legal",
  "Actionnaire",
  "Titulaire du titre minier",
];

const OBJET_DEMANDE_OPTIONS = [
  "Constitution de dossier administratif",
  "Transaction ou cession de droits miniers",
  "Contentieux ou procedure judiciaire",
  "Financement / garantie bancaire",
  "Controle et suivi reglementaire",
  "Autre",
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
  objetDemandeAutre: "",
  baseCommunication:
    "Demande introduite dans le cadre de la verification et de la constitution du dossier cadastral.",
};

const getQualityContactLabel = (quality: string) => {
  if (quality === "Actionnaire") return "actionnaire";
  if (quality === "Titulaire du titre minier") return "titulaire du titre minier";
  return "representant legal";
};

function StyledSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Selectionner",
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={[
        styles.customSelect,
        open ? styles.customSelectOpen : "",
        disabled ? styles.customSelectDisabled : "",
      ].join(" ")}
    >
      <button
        type="button"
        className={styles.customSelectButton}
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={18} className={styles.customSelectChevron} />
      </button>

      {open ? (
        <div className={styles.customSelectMenu}>
          {options.map((option) => {
            const active = option === value;
            return (
              <button
                key={option}
                type="button"
                className={[
                  styles.customSelectOption,
                  active ? styles.customSelectOptionActive : "",
                ].join(" ")}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                {active ? <CheckCircle2 size={16} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const OTP_LENGTH = 6;

export default function DemandeDocumentCadastralePage() {
  const navigate = useNavigate();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();

  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [verificationMode, setVerificationMode] = useState<VerificationMode>("phone");
  const [form, setForm] = useState<RequestForm>(DEFAULT_FORM);
  const [typePermisOptions, setTypePermisOptions] = useState<TypePermisOption[]>([]);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [requestReference, setRequestReference] = useState<string>("CDC-EN-ATTENTE");
  const [scanQrDone, setScanQrDone] = useState(false);
  const [scanIdentityDone, setScanIdentityDone] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [qrFileName, setQrFileName] = useState<string>("Aucun fichier");
  const [identityFileName, setIdentityFileName] = useState<string>("Aucun fichier");
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [identityPreviewUrl, setIdentityPreviewUrl] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>(null);
  const [qrScanChoiceOpen, setQrScanChoiceOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [titleVerification, setTitleVerification] = useState<TitleVerificationState>("idle");
  const [titleVerificationMessage, setTitleVerificationMessage] = useState<string>(
    "Verifiez que le QR, le code permis et le type correspondent au meme titre.",
  );
  const [contactVerification, setContactVerification] = useState<ContactVerificationState>("idle");
  const [contactVerificationMessage, setContactVerificationMessage] = useState<string>(
    "Verifiez que le contact correspond au detenteur moral du permis.",
  );
  const [step1Busy, setStep1Busy] = useState(false);
  const [step2Busy, setStep2Busy] = useState(false);
  const [step3Busy, setStep3Busy] = useState(false);
  const [attachmentsUploaded, setAttachmentsUploaded] = useState(false);
  const [generatedRequestMessage, setGeneratedRequestMessage] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState("accuse-reception.pdf");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<DocumentId[]>([]);
  const [generationKey, setGenerationKey] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(15);
  const [processingReady, setProcessingReady] = useState(false);
  const [processingStep, setProcessingStep] = useState<1 | 2 | 3 | 4>(1);

  const qrInputRef = useRef<HTMLInputElement | null>(null);
  const qrCameraInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!isAuthReady || !auth?.id) return;

    let cancelled = false;
    axios
      .get<TypePermisOption[]>(buildApiUrl("/type-permis"), { withCredentials: true })
      .then((response) => {
        if (cancelled) return;

        const options = (response.data || []).filter(
          (option) => Boolean(option.lib_type?.trim() || option.code_type?.trim()),
        );
        setTypePermisOptions(options);

        setForm((current) => {
          const currentExists = options.some(
            (option) =>
              option.lib_type?.trim() === current.typePermis ||
              option.code_type?.trim() === current.typePermis,
          );

          return {
            ...current,
            typePermis: currentExists
              ? current.typePermis
              : options[0]?.lib_type?.trim() || options[0]?.code_type?.trim() || "",
          };
        });
      })
      .catch(() => {
        if (!cancelled) {
          setNetworkError("Impossible de charger les types de permis depuis la base de données.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth?.id, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !auth?.id) return;

    let cancelled = false;
    axios
      .get<DocumentReferenceResponse[]>(
        buildApiUrl("/api/cadastre/demandes-documents-cadastraux/document-references"),
        { withCredentials: true },
      )
      .then((response) => {
        if (cancelled) return;
        const options = (response.data || []).map((item) => ({
          id: item.code,
          title: item.label,
          subtitle: item.subtitle || "",
          description: item.description || "",
          tags: ["PDF"],
          icon: item.iconKey === "map-pinned" ? MapPinned : FileText,
          accent: item.accentKey === "teal" ? "teal" : "green",
        } satisfies DocumentOption));
        setDocumentOptions(options);
        setSelectedDocs(
          (response.data || [])
            .filter((item) => item.isDefault)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((item) => item.code),
        );
      })
      .catch(() => {
        if (!cancelled) setNetworkError("Impossible de charger les documents cadastraux.");
      });

    return () => {
      cancelled = true;
    };
  }, [auth?.id, isAuthReady]);

  const displayName = useMemo(
    () => auth?.username || auth?.email || "Utilisateur cadastre",
    [auth?.email, auth?.username],
  );

  const selectedDocuments = useMemo(
    () => documentOptions.filter((doc) => selectedDocs.includes(doc.id)),
    [documentOptions, selectedDocs],
  );

  useEffect(() => {
    return () => {
      if (qrPreviewUrl) URL.revokeObjectURL(qrPreviewUrl);
    };
  }, [qrPreviewUrl]);

  useEffect(() => {
    return () => {
      if (identityPreviewUrl) URL.revokeObjectURL(identityPreviewUrl);
    };
  }, [identityPreviewUrl]);

  const otpComplete = otpDigits.every((digit) => digit.trim().length === 1);
  const otpCode = otpDigits.join("");
  const primaryDocumentType = useMemo(
    () =>
      selectedDocs.includes("PLAN_CADASTRAL_OFFICIEL")
        ? "PLAN_CADASTRAL_OFFICIEL"
        : "EXTRAIT_CERTIFIE_CONFORME",
    [selectedDocs],
  );
  const selectedDocumentsLabel = useMemo(
    () =>
      selectedDocuments.length > 0
        ? selectedDocuments.map((doc) => doc.title).join(" + ")
        : "Aucun document selectionne",
    [selectedDocuments],
  );
  const canContinueStep1 = requestId !== null && otpSent && otpComplete && scanQrDone && scanIdentityDone;
  const canContinueStep2 = selectedDocuments.length > 0;

  useEffect(() => {
    if (currentStep !== 3) return;

    setProcessingReady(true);
    setProcessingStep(4);
    setGenerationProgress(100);
  }, [currentStep, generationKey]);

  const resetTitleVerification = () => {
    setTitleVerification("idle");
    setTitleVerificationMessage(
      "Verifiez que le QR, le code permis et le type correspondent au meme titre.",
    );
  };

  const resetContactVerification = () => {
    setContactVerification("idle");
    setContactVerificationMessage(
      "Verifiez que le contact correspond au detenteur moral du permis.",
    );
  };

  const updateForm = (field: keyof RequestForm, value: string) => {
    if (["qrCode", "codePermis", "typePermis"].includes(field)) {
      resetTitleVerification();
      resetContactVerification();
    }
    if (["emailContact", "telephoneContact", "qualiteDemandeur"].includes(field)) {
      resetContactVerification();
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleScanBoxClick = (ref: RefObject<HTMLInputElement | null>) => {
    ref.current?.click();
  };

  const openQrScanChoice = () => {
    if (step1Busy) return;
    setQrScanChoiceOpen(true);
  };

  const chooseQrCamera = () => {
    setQrScanChoiceOpen(false);
    window.setTimeout(() => qrCameraInputRef.current?.click(), 0);
  };

  const chooseQrFile = () => {
    setQrScanChoiceOpen(false);
    window.setTimeout(() => qrInputRef.current?.click(), 0);
  };

  const openPreview = (
    url: string | null,
    fileName: string,
    mimeType: string | undefined,
    title: string,
  ) => {
    if (!url) return;
    setPreviewModal({
      url,
      title,
      fileName,
      mimeType: mimeType || "",
    });
  };

  const handleFilePick = (
    event: ChangeEvent<HTMLInputElement>,
    kind: "qr" | "identity",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (kind === "qr") {
      if (qrPreviewUrl) URL.revokeObjectURL(qrPreviewUrl);
      setQrScanChoiceOpen(false);
      setQrFile(file);
      setQrFileName(file.name);
      setQrPreviewUrl(URL.createObjectURL(file));
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
      if (identityPreviewUrl) URL.revokeObjectURL(identityPreviewUrl);
      setIdentityFile(file);
      setIdentityFileName(file.name);
      setIdentityPreviewUrl(URL.createObjectURL(file));
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

  const clearScan = (kind: "qr" | "identity") => {
    if (kind === "qr") {
      if (qrPreviewUrl) URL.revokeObjectURL(qrPreviewUrl);
      setPreviewModal((current) => (current?.url === qrPreviewUrl ? null : current));
      setQrFile(null);
      setQrFileName("Aucun fichier");
      setQrPreviewUrl(null);
      setScanQrDone(false);
      if (qrInputRef.current) qrInputRef.current.value = "";
      if (qrCameraInputRef.current) qrCameraInputRef.current.value = "";
    } else {
      if (identityPreviewUrl) URL.revokeObjectURL(identityPreviewUrl);
      setPreviewModal((current) => (current?.url === identityPreviewUrl ? null : current));
      setIdentityFile(null);
      setIdentityFileName("Aucun fichier");
      setIdentityPreviewUrl(null);
      setScanIdentityDone(false);
      if (identityInputRef.current) identityInputRef.current.value = "";
    }

    setAttachmentsUploaded(false);
    setOtpError(null);
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
      objetDemande: form.objetDemande.trim(),
      objetDemandeAutre: form.objetDemandeAutre.trim(),
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

  const verifyTitleInformation = async () => {
    setTitleVerification("checking");
    setTitleVerificationMessage("Verification du QR, du code permis et du type...");

    const payload = {
      qrCodeTitre: form.qrCode.trim(),
      codePermis: form.codePermis.trim(),
      typePermis: form.typePermis.trim(),
    };

    try {
      const response = await axios.post<{ valid?: boolean; message?: string }>(
        buildApiUrl("/api/cadastre/demandes-documents-cadastraux/verify-title"),
        payload,
        { withCredentials: true },
      );

      setTitleVerification("valid");
      setTitleVerificationMessage(
        response.data?.message || "QR code, code permis et type de permis valides.",
      );
      return true;
    } catch (error) {
      const rawMessage =
        axios.isAxiosError(error)
          ? (error.response?.data?.message as string) || error.message
          : error instanceof Error
            ? error.message
            : "";
      const message = rawMessage.includes("Cannot POST")
        ? "La route de verification n'est pas chargee cote serveur. Redemarrez le backend puis relancez le test."
        : rawMessage || "Le QR, le code permis ou le type ne correspondent pas.";

      setTitleVerification("invalid");
      setTitleVerificationMessage(message);
      throw error;
    }
  };

  const verifyContactInformation = async () => {
    setContactVerification("checking");
    setContactVerificationMessage(
      verificationMode === "phone"
        ? "Verification du numero avec le detenteur moral..."
        : "Verification de l'email avec le detenteur moral...",
    );

    const payload = {
      qrCodeTitre: form.qrCode.trim(),
      codePermis: form.codePermis.trim(),
      canalVerification: verificationMode === "phone" ? "TELEPHONE" : "EMAIL",
      qualiteDemandeur: form.qualiteDemandeur.trim(),
      emailContact: form.emailContact.trim(),
      telephoneContact: form.telephoneContact.trim(),
    };

    try {
      const response = await axios.post<{ valid?: boolean; message?: string }>(
        buildApiUrl("/api/cadastre/demandes-documents-cadastraux/verify-contact"),
        payload,
        { withCredentials: true },
      );

      setContactVerification("valid");
      setContactVerificationMessage(
        response.data?.message || "Contact conforme au detenteur moral.",
      );
      return true;
    } catch (error) {
      const rawMessage =
        axios.isAxiosError(error)
          ? (error.response?.data?.message as string) || error.message
          : error instanceof Error
            ? error.message
            : "";
      const message = rawMessage.includes("Cannot POST")
        ? "La route de verification du contact n'est pas chargee cote serveur. Redemarrez le backend puis relancez le test."
        : rawMessage || "Le contact saisi ne correspond pas au detenteur moral.";

      setContactVerification("invalid");
      setContactVerificationMessage(message);
      throw error;
    }
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
      await verifyTitleInformation();
      await verifyContactInformation();

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
          objetDemande: form.objetDemande.trim(),
          objetDemandeAutre: form.objetDemandeAutre.trim(),
          baseCommunication: form.baseCommunication.trim(),
        },
        { withCredentials: true },
      );

      setGeneratedRequestMessage(
        response.data?.message ||
          "Votre demande de cadastre a ete bien transmise avec succes.",
      );
      setReceiptUrl(response.data?.demande?.accuseReceptionPdfUrl || null);
      setReceiptFilename(
        response.data?.demande?.accuseReceptionPdfFilename ||
          `accuse-reception-${requestReference}.pdf`,
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
    setReceiptUrl(null);
    setReceiptFilename("accuse-reception.pdf");
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    setSelectedDocs([]);
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
      subtitle: "Vérification d'identité",
    },
    {
      number: 2 as const,
      title: "Sélection des documents",
      subtitle: "Extrait et/ou plan cadastral",
    },
    {
      number: 3 as const,
      title: "Téléchargement",
      subtitle: "Documents générés",
    },
  ];

  return (
    <InvestorLayout>
      <main className={styles.page}>
        <div className={styles.breadcrumb}>
          <span>GUNAM</span>
          <ArrowRight size={14} />
          <span>Cadastre</span>
          <ArrowRight size={14} />
          <b>Demande de documents</b>
        </div>

        <div className={styles.pageToolbar}>
          <button
            type="button"
            className={styles.dashboardButton}
            onClick={() => navigate(getDefaultDashboardPath(auth?.role), { replace: true })}
          >
            <LayoutDashboard size={16} />
            Retour au dashboard
          </button>
        </div>

        <div className={styles.workflowContainer}>
          <ProgressStepper steps={steps.map((step) => step.title)} currentStep={currentStep} />

          <section className={styles.hero}>
            <span className={styles.pageEyebrow}>Étape {currentStep}</span>
            <h1 className={styles.pageTitle}>Demande de documents cadastraux</h1>
            <p className={styles.pageLead}>
              Générez et téléchargez l&apos;extrait cadastral et le plan cadastral officiels
              d&apos;un titre minier.
            </p>
          </section>

          <section className={currentStep === 1 ? styles.panelActive : styles.panelHidden}>
          <div className={`${styles.card} ${styles.titleMinerCard}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>1. Informations du titre minier</h2>
              <p className={styles.cardDesc}>
                Scannez le QR code du permis, puis verifiez les informations du titre avant de continuer.
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

            <div className={styles.titleMinerLayout}>
              <div className={styles.titleMinerForm}>
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
                    <StyledSelect
                      value={form.typePermis}
                      options={typePermisOptions
                        .map((option) => option.lib_type?.trim() || option.code_type?.trim() || "")
                        .filter(Boolean)}
                      disabled={step1Busy || typePermisOptions.length === 0}
                      placeholder="Selectionner un type de permis"
                      onChange={(value) => updateForm("typePermis", value)}
                    />
                  </label>
                </div>

                <div
                  className={[
                    styles.titleCheck,
                    titleVerification === "valid" ? styles.titleCheckValid : "",
                    titleVerification === "invalid" ? styles.titleCheckInvalid : "",
                  ].join(" ")}
                >
                  <div className={styles.titleCheckIcon}>
                    {titleVerification === "valid" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
                  </div>
                  <div>
                    <div className={styles.titleCheckTitle}>
                      {titleVerification === "checking"
                        ? "Verification en cours"
                        : titleVerification === "valid"
                          ? "Titre verifie"
                          : titleVerification === "invalid"
                            ? "Correspondance invalide"
                            : "Verification du titre"}
                    </div>
                    <div className={styles.titleCheckText}>{titleVerificationMessage}</div>
                  </div>
                </div>
              </div>

              <aside className={styles.titleMinerScan}>
                <button
                  type="button"
                  className={`${styles.scanBox} ${styles.titleMinerScanBox}`}
                  onClick={openQrScanChoice}
                >
                  <div className={styles.scanFrame}>
                    <span className={`${styles.corner} ${styles.cornerTL}`} />
                    <span className={`${styles.corner} ${styles.cornerTR}`} />
                    <span className={`${styles.corner} ${styles.cornerBL}`} />
                    <span className={`${styles.corner} ${styles.cornerBR}`} />
                    <span className={styles.scanLine} aria-hidden="true" />
                    <ScanLine size={30} className={styles.scanIcon} />
                  </div>
                  <div className={styles.scanLabel}>Scanner un code permis</div>
                  <div className={styles.scanSub}>
                    Choisir la camera ou <u>importer une photo du QR code</u>
                  </div>
                </button>

                <input
                  ref={qrCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.hiddenInput}
                  onChange={(event) => handleFilePick(event, "qr")}
                />
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className={styles.hiddenInput}
                  onChange={(event) => handleFilePick(event, "qr")}
                />

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

                {scanQrDone ? (
                  <div className={styles.scanPreviewCard}>
                    <div className={styles.previewMedia}>
                      {qrPreviewUrl && qrFile?.type.startsWith("image/") ? (
                        <img src={qrPreviewUrl} alt="Apercu du QR code scanne" className={styles.previewImage} />
                      ) : (
                        <div className={styles.previewFileFallback}>
                          <FileText size={24} />
                          <span>Fichier joint</span>
                        </div>
                      )}
                    </div>
                    <div className={styles.previewDetails}>
                      <div className={styles.previewTitle}>Apercu du scan QR</div>
                      <div className={styles.previewMeta}>{qrFileName}</div>
                      <div className={styles.previewHint}>Supprimez ce fichier pour rescanner un autre QR code.</div>
                    </div>
                    <div className={styles.previewActions}>
                      <button
                        type="button"
                        className={styles.previewViewButton}
                        onClick={() =>
                          openPreview(qrPreviewUrl, qrFileName, qrFile?.type, "Apercu du scan QR")
                        }
                      >
                        <Eye size={16} />
                        Voir
                      </button>
                      <button type="button" className={styles.previewDeleteButton} onClick={() => clearScan("qr")}>
                        <Trash2 size={16} />
                        Supprimer
                      </button>
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>

            {qrScanChoiceOpen ? (
              <div
                className={styles.scanChoiceOverlay}
                role="dialog"
                aria-modal="true"
                aria-labelledby="qr-scan-choice-title"
                onClick={() => setQrScanChoiceOpen(false)}
              >
                <div className={styles.scanChoiceModal} onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.scanChoiceClose}
                    onClick={() => setQrScanChoiceOpen(false)}
                    aria-label="Fermer"
                  >
                    <X size={18} />
                  </button>
                  <div className={styles.scanChoiceHeader}>
                    <span className={styles.scanChoiceIcon}>
                      <ScanLine size={22} />
                    </span>
                    <div>
                      <h3 id="qr-scan-choice-title">Scanner le code permis</h3>
                      <p>Choisissez la methode de lecture du QR code.</p>
                    </div>
                  </div>
                  <div className={styles.scanChoiceGrid}>
                    <button type="button" className={styles.scanChoiceCard} onClick={chooseQrCamera}>
                      <span className={styles.scanChoiceCardIcon}>
                        <Camera size={22} />
                      </span>
                      <strong>Activer la camera</strong>
                      <small>Scanner directement avec l'appareil.</small>
                    </button>
                    <button type="button" className={styles.scanChoiceCard} onClick={chooseQrFile}>
                      <span className={styles.scanChoiceCardIcon}>
                        <ImagePlus size={22} />
                      </span>
                      <strong>Importer un fichier</strong>
                      <small>Photo, capture ou fichier PDF du QR code.</small>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className={`${styles.card} ${styles.identityCard}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>2. Identite du detenteur</h2>
              <p className={styles.cardDesc}>
                Scannez la carte d'identite, puis verifiez les informations du representant avant de continuer.
              </p>
            </div>

            <div className={styles.identityLayout}>
              <div className={styles.identityForm}>
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

            <div className={styles.otpPanel}>
              <div className={styles.sectionDivider}>Coordonnees pour OTP</div>
              <div className={styles.verificationSwitch}>
                <button
                  type="button"
                  className={[
                    styles.switchButton,
                    verificationMode === "phone" ? styles.switchButtonActive : "",
                  ].join(" ")}
                  onClick={() => {
                    setVerificationMode("phone");
                    resetContactVerification();
                  }}
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
                  onClick={() => {
                    setVerificationMode("email");
                    resetContactVerification();
                  }}
                >
                  <Mail size={16} />
                  Adresse email
                </button>
              </div>

              <div className={styles.fieldGrid}>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.fieldLabel}>
                  {verificationMode === "phone"
                    ? `Telephone du ${getQualityContactLabel(form.qualiteDemandeur)}`
                    : `Email du ${getQualityContactLabel(form.qualiteDemandeur)}`}
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
                  Le contact sera verifie avec celui lie au permis exact et a la qualite selectionnee.
                </span>
              </label>

              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.fieldLabel}>Qualite du demandeur</span>
                <StyledSelect
                  value={form.qualiteDemandeur}
                  disabled={step1Busy}
                  options={QUALITE_DEMANDEUR_OPTIONS}
                  onChange={(value) => updateForm("qualiteDemandeur", value)}
                />
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.fieldLabel}>Objet de la demande</span>
                <StyledSelect
                  value={form.objetDemande}
                  disabled={step1Busy}
                  options={OBJET_DEMANDE_OPTIONS}
                  onChange={(value) => updateForm("objetDemande", value)}
                />
              </label>
              {form.objetDemande === "Autre" ? (
                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span className={styles.fieldLabel}>Précisez l'objet de la demande</span>
                  <textarea
                    className={styles.fieldTextarea}
                    value={form.objetDemandeAutre}
                    disabled={step1Busy}
                    onChange={(event) => updateForm("objetDemandeAutre", event.target.value)}
                    placeholder="Décrivez l'objet de votre demande"
                  />
                </label>
              ) : null}
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
            </div>

            <div
              className={[
                styles.titleCheck,
                contactVerification === "valid" ? styles.titleCheckValid : "",
                contactVerification === "invalid" ? styles.titleCheckInvalid : "",
              ].join(" ")}
            >
              <div className={styles.titleCheckIcon}>
                {contactVerification === "valid" ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
              </div>
              <div>
                <div className={styles.titleCheckTitle}>
                  Verification separee du contact detenteur
                </div>
                <div className={styles.titleCheckText}>{contactVerificationMessage}</div>
              </div>
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

              <aside className={styles.identityScan}>
                <button
                  type="button"
                  className={`${styles.scanBox} ${styles.scanBoxCard} ${styles.identityScanBox}`}
                  onClick={() => handleScanBoxClick(identityInputRef)}
                >
                  <div className={`${styles.scanFrame} ${styles.scanFrameWide}`}>
                    <span className={`${styles.corner} ${styles.cornerTL}`} />
                    <span className={`${styles.corner} ${styles.cornerTR}`} />
                    <span className={`${styles.corner} ${styles.cornerBL}`} />
                    <span className={`${styles.corner} ${styles.cornerBR}`} />
                    <span className={styles.scanLine} aria-hidden="true" />
                    <Upload size={30} className={styles.scanIcon} />
                  </div>
                  <div className={styles.scanLabel}>Scanner la carte d'identite</div>
                  <div className={styles.scanSub}>
                    Activer la camera ou <u>importer une photo de la carte</u>
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

                {scanIdentityDone ? (
                  <div className={styles.scanPreviewCard}>
                    <div className={styles.previewMedia}>
                      {identityPreviewUrl && identityFile?.type.startsWith("image/") ? (
                        <img src={identityPreviewUrl} alt="Apercu de la carte d'identite scannee" className={styles.previewImage} />
                      ) : (
                        <div className={styles.previewFileFallback}>
                          <FileText size={24} />
                          <span>Fichier joint</span>
                        </div>
                      )}
                    </div>
                    <div className={styles.previewDetails}>
                      <div className={styles.previewTitle}>Apercu de la carte</div>
                      <div className={styles.previewMeta}>{identityFileName}</div>
                      <div className={styles.previewHint}>Supprimez ce fichier pour rescanner une autre carte.</div>
                    </div>
                    <div className={styles.previewActions}>
                      <button
                        type="button"
                        className={styles.previewViewButton}
                        onClick={() =>
                          openPreview(
                            identityPreviewUrl,
                            identityFileName,
                            identityFile?.type,
                            "Apercu de la carte d'identite",
                          )
                        }
                      >
                        <Eye size={16} />
                        Voir
                      </button>
                      <button type="button" className={styles.previewDeleteButton} onClick={() => clearScan("identity")}>
                        <Trash2 size={16} />
                        Supprimer
                      </button>
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>

          {previewModal ? (
            <div
              className={styles.previewModalOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="document-preview-title"
              onClick={() => setPreviewModal(null)}
            >
              <div className={styles.previewModal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.previewModalHeader}>
                  <div>
                    <h3 id="document-preview-title">{previewModal.title}</h3>
                    <p>{previewModal.fileName}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.previewModalClose}
                    onClick={() => setPreviewModal(null)}
                    aria-label="Fermer l'apercu"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.previewModalBody}>
                  {previewModal.mimeType.startsWith("image/") ? (
                    <img src={previewModal.url} alt={previewModal.title} className={styles.previewModalImage} />
                  ) : (
                    <iframe
                      src={previewModal.url}
                      title={previewModal.title}
                      className={styles.previewModalFrame}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}

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
              {documentOptions.map((document) => {
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
                    Votre demande a ete envoyee avec succes !
                  </div>
                  <div className={styles.successText}>
                    Votre dossier a bien ete enregistre et transmis au service du cadastre. Vous recevrez une notification
                    dans votre espace Cadastre des que vos documents seront prets.
                    {generatedRequestMessage ? ` ${generatedRequestMessage}` : ""}
                  </div>
                </div>
              </div>

              <div className={styles.successBanner}>
                <Sparkles size={18} />
                <span>
                  Merci pour votre demande. L'accuse de reception est disponible ci-dessous. Nous vous informerons des que
                  le traitement sera termine et que vos documents cadastraux seront disponibles.
                </span>
              </div>

              <div className={styles.downloadList}>
                <div className={styles.downloadRow}>
                  <div className={styles.downloadIcon}>
                    <FileText size={20} />
                  </div>
                  <div className={styles.downloadMeta}>
                    <div className={styles.downloadTitle}>{receiptFilename}</div>
                    <div className={styles.downloadSub}>Accuse de reception horodate - PDF officiel</div>
                  </div>
                  {receiptUrl ? (
                    <a
                      className={styles.downloadButton}
                      href={`${apiURL}${receiptUrl}`}
                      download={receiptFilename}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download size={16} />
                      Telecharger
                    </a>
                  ) : (
                    <span className={styles.downloadSub}>Accuse en cours de preparation</span>
                  )}
                </div>
              </div>
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
        </div>
      </main>
    </InvestorLayout>
  );
}
