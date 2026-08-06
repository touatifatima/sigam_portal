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
  LayoutDashboard,
  Mail,
  MapPinned,
  Phone,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  type LucideIcon,
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

type VerificationMode = string;
type StepNumber = 1 | 2 | 3;

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
    accuseReceptionPdfUrl?: string | null;
    accuseReceptionPdfFilename?: string | null;
    accuseReceptionGeneratedAt?: string | null;
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

type WorkflowDocumentReference = {
  id: number;
  code: string;
  label: string;
  subtitle?: string | null;
  description?: string | null;
  iconKey?: string | null;
  accentKey?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
};

type WorkflowVerificationReference = {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  iconKey?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
};

type WorkflowReferencePayload = {
  documents: WorkflowDocumentReference[];
  verificationChannels: WorkflowVerificationReference[];
};

type ContactValidationResponse = {
  valid: boolean;
  message: string;
  qualiteDemandeur: string;
  canalVerification: "EMAIL" | "TELEPHONE";
  expectedContact: string | null;
  actualContact: string;
  targetLabel: string;
  permisId: number | null;
  permisCode: string | null;
};

type DocumentOption = {
  code: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  icon: LucideIcon;
  accent: "green" | "teal";
  isDefault: boolean;
};

type VerificationOption = {
  code: string;
  label: string;
  description: string;
  icon: LucideIcon;
  isDefault: boolean;
  iconKey?: string | null;
};

type TypePermisOption = {
  id: number;
  code_type?: string | null;
  lib_type?: string | null;
};

const DOCUMENT_TAGS_BY_CODE: Record<string, string[]> = {
  EXTRAIT_CERTIFIE_CONFORME: ["PDF", "A4", "QR de verification"],
  PLAN_CADASTRAL_OFFICIEL: ["PDF", "A4 paysage", "Coordonnees"],
};

const DOCUMENT_ICON_BY_KEY: Record<string, LucideIcon> = {
  "file-text": FileText,
  filetext: FileText,
  extrait: FileText,
  "map-pinned": MapPinned,
  mappinned: MapPinned,
  plan: MapPinned,
};

const DOCUMENT_ACCENT_BY_KEY: Record<string, "green" | "teal"> = {
  green: "green",
  teal: "teal",
};

const VERIFICATION_ICON_BY_KEY: Record<string, LucideIcon> = {
  phone: Phone,
  mobile: Phone,
  tel: Phone,
  email: Mail,
  mail: Mail,
};

const DEFAULT_FORM: RequestForm = {
  qrCode: "",
  codePermis: "",
  titulaire: "",
  numeroRc: "",
  typePermis: "",
  nin: "",
  nom: "",
  prenom: "",
  numeroPiece: "",
  emailContact: "",
  telephoneContact: "",
  qualiteDemandeur: "",
  objetDemande: "",
  baseCommunication: "",
};

const OTP_LENGTH = 6;

export default function DemandeDocumentCadastralePage() {
  const navigate = useNavigate();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();

  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [verificationMode, setVerificationMode] = useState<VerificationMode>("");
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
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [typePermisOptions, setTypePermisOptions] = useState<TypePermisOption[]>([]);
  const [typePermisLoading, setTypePermisLoading] = useState(false);
  const [typePermisError, setTypePermisError] = useState<string | null>(null);
  const [documentOptions, setDocumentOptions] = useState<WorkflowDocumentReference[]>([]);
  const [verificationOptions, setVerificationOptions] = useState<WorkflowVerificationReference[]>([]);
  const [workflowOptionsLoading, setWorkflowOptionsLoading] = useState(false);
  const [workflowOptionsError, setWorkflowOptionsError] = useState<string | null>(null);
  const [contactValidation, setContactValidation] = useState<ContactValidationResponse | null>(null);
  const [contactValidationLoading, setContactValidationLoading] = useState(false);
  const [generationKey, setGenerationKey] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(15);
  const [processingReady, setProcessingReady] = useState(false);
  const [processingStep, setProcessingStep] = useState<1 | 2 | 3 | 4>(1);

  const qrInputRef = useRef<HTMLInputElement | null>(null);
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const contactValidationToastRef = useRef<string>("");

  const resolveDocumentIcon = (option: WorkflowDocumentReference) => {
    const key = String(option.iconKey || option.code || "").toLowerCase();
    return DOCUMENT_ICON_BY_KEY[key] || (key.includes("plan") ? MapPinned : FileText);
  };

  const resolveDocumentAccent = (option: WorkflowDocumentReference) => {
    const key = String(option.accentKey || "").toLowerCase();
    if (DOCUMENT_ACCENT_BY_KEY[key]) {
      return DOCUMENT_ACCENT_BY_KEY[key];
    }
    return option.code === "PLAN_CADASTRAL_OFFICIEL" ? "teal" : "green";
  };

  const resolveDocumentTags = (option: WorkflowDocumentReference) => {
    return DOCUMENT_TAGS_BY_CODE[option.code] || ["PDF", "Document officiel"];
  };

  const resolveVerificationIcon = (option: WorkflowVerificationReference | VerificationOption) => {
    const key = String(option.iconKey || option.code || "").toLowerCase();
    return VERIFICATION_ICON_BY_KEY[key] || (option.code === "TELEPHONE" ? Phone : Mail);
  };

  const workflowDocumentOptions = useMemo<DocumentOption[]>(
    () =>
      documentOptions.map((option) => ({
        code: option.code,
        title: option.label,
        subtitle: option.subtitle || "",
        description: option.description || "",
        tags: resolveDocumentTags(option),
        icon: resolveDocumentIcon(option),
        accent: resolveDocumentAccent(option),
        isDefault: Boolean(option.isDefault),
      })),
    [documentOptions],
  );

  const workflowVerificationOptions = useMemo<VerificationOption[]>(
    () =>
      verificationOptions.map((option) => ({
        code: option.code,
        label: option.label,
        description: option.description || "",
        icon: resolveVerificationIcon(option),
        isDefault: Boolean(option.isDefault),
      })),
    [verificationOptions],
  );

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

    const loadTypePermis = async () => {
      setTypePermisLoading(true);
      setTypePermisError(null);

      const sources = ["/type-permis", "/type-permis_conf"];
      let lastError: unknown = null;
      let loadedOptions: TypePermisOption[] = [];

      for (const source of sources) {
        try {
          const response = await axios.get<TypePermisOption[]>(buildApiUrl(source), {
            withCredentials: true,
          });
          loadedOptions = Array.isArray(response.data) ? response.data : [];
          if (loadedOptions.length > 0) {
            break;
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (!active) return;

      setTypePermisOptions(loadedOptions);
      if (loadedOptions.length === 0) {
        setTypePermisError(
          axios.isAxiosError(lastError)
            ? (lastError.response?.data?.message as string) ||
                lastError.response?.data?.error ||
                lastError.message
            : "Aucun type de permis disponible.",
        );
      }

      if (active) {
        setTypePermisLoading(false);
      }
    };

    void loadTypePermis();

    return () => {
      active = false;
    };
  }, [auth?.role, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !isCadastreRole(auth?.role)) return;

    let active = true;

    const loadWorkflowReferences = async () => {
      setWorkflowOptionsLoading(true);
      setWorkflowOptionsError(null);

      try {
        const response = await axios.get<WorkflowReferencePayload>(
          buildApiUrl("/api/cadastre/demandes-documents-cadastraux/references"),
          { withCredentials: true },
        );
        const payload = response.data || { documents: [], verificationChannels: [] };
        const docs = Array.isArray(payload.documents) ? payload.documents : [];
        const channels = Array.isArray(payload.verificationChannels)
          ? payload.verificationChannels
          : [];

        if (!active) return;

        setDocumentOptions(docs);
        setVerificationOptions(channels);

        setSelectedDocs((current) => {
          const validCurrent = current.filter((code) =>
            docs.some((document) => document.code === code),
          );
          return validCurrent;
        });

        setVerificationMode((current) => {
          return channels.some((channel) => channel.code === current) ? current : "";
        });
      } catch (error) {
        if (!active) return;
        const message = axios.isAxiosError(error)
          ? (error.response?.data?.message as string) ||
            error.response?.data?.error ||
            error.message
          : error instanceof Error
            ? error.message
            : "Impossible de charger les options du workflow cadastral.";
        setWorkflowOptionsError(message);
      } finally {
        if (active) {
          setWorkflowOptionsLoading(false);
        }
      }
    };

    void loadWorkflowReferences();

    return () => {
      active = false;
    };
  }, [auth?.role, isAuthReady]);

  const displayName = useMemo(
    () => auth?.username || auth?.email || "Utilisateur cadastre",
    [auth?.email, auth?.username],
  );

  const selectedDocuments = useMemo(
    () => workflowDocumentOptions.filter((doc) => selectedDocs.includes(doc.code)),
    [selectedDocs, workflowDocumentOptions],
  );

  const otpComplete = otpDigits.every((digit) => digit.trim().length === 1);
  const otpCode = otpDigits.join("");
  const primaryDocumentType = useMemo(
    () =>
      selectedDocuments.find((doc) => doc.isDefault)?.code ||
      selectedDocuments[0]?.code ||
      workflowDocumentOptions.find((doc) => doc.isDefault)?.code ||
      workflowDocumentOptions[0]?.code ||
      "",
    [selectedDocuments, workflowDocumentOptions],
  );
  const selectedDocumentsLabel = useMemo(
    () =>
      selectedDocuments.length > 0
        ? selectedDocuments.map((doc) => doc.title).join(" + ")
        : "Aucun document selectionne",
    [selectedDocuments],
  );
  const selectedVerificationOption = useMemo(
    () => workflowVerificationOptions.find((option) => option.code === verificationMode) || null,
    [verificationMode, workflowVerificationOptions],
  );
  const selectedVerificationLabel = selectedVerificationOption?.label || "Canal OTP";
  const selectedContactValue = useMemo(() => {
    if (verificationMode === "TELEPHONE") {
      return form.telephoneContact.trim();
    }
    if (verificationMode === "EMAIL") {
      return form.emailContact.trim();
    }
    return "";
  }, [form.emailContact, form.telephoneContact, verificationMode]);
  const selectedDemandeurTargetLabel = useMemo(() => {
    const quality = form.qualiteDemandeur.toLowerCase();
    if (quality.includes("representant")) {
      return "representant legal";
    }
    if (quality.includes("actionnaire")) {
      return "actionnaire";
    }
    if (quality.includes("titulaire")) {
      return "titulaire";
    }
    return "demandeur";
  }, [form.qualiteDemandeur]);
  const contactFieldLabel = useMemo(() => {
    if (verificationMode === "TELEPHONE") {
      return `Telephone du ${selectedDemandeurTargetLabel}`;
    }
    if (verificationMode === "EMAIL") {
      return `Email du ${selectedDemandeurTargetLabel}`;
    }
    return "Selectionnez un canal OTP";
  }, [selectedDemandeurTargetLabel, verificationMode]);
  const contactValidationReady =
    !requestId &&
    form.qualiteDemandeur.trim().length > 0 &&
    verificationMode.trim().length > 0 &&
    selectedContactValue.length > 0 &&
    form.qrCode.trim().length > 0 &&
    form.codePermis.trim().length > 0 &&
    form.typePermis.trim().length > 0;
  const workflowReady =
    !workflowOptionsLoading &&
    !workflowOptionsError &&
    documentOptions.length > 0 &&
    verificationOptions.length > 0;
  const receiptDownloadUrl = requestId
    ? buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${requestId}/accuse-reception`)
    : "";
  const canContinueStep1 =
    requestId !== null &&
    otpSent &&
    otpComplete &&
    scanQrDone &&
    scanIdentityDone &&
    form.typePermis.trim().length > 0 &&
    workflowReady &&
    verificationMode.trim().length > 0;
  const canContinueStep2 = selectedDocuments.length > 0;

  useEffect(() => {
    if (requestId) {
      setContactValidation(null);
      setContactValidationLoading(false);
      contactValidationToastRef.current = "";
      return;
    }

    if (!contactValidationReady) {
      setContactValidation(null);
      setContactValidationLoading(false);
      contactValidationToastRef.current = "";
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setContactValidationLoading(true);
      try {
        const response = await axios.post<ContactValidationResponse>(
          buildApiUrl("/api/cadastre/demandes-documents-cadastraux/verification-contact"),
          {
            qrCodeTitre: form.qrCode.trim(),
            codePermis: form.codePermis.trim(),
            typePermis: form.typePermis.trim(),
            qualiteDemandeur: form.qualiteDemandeur.trim(),
            canalVerification: verificationMode === "TELEPHONE" ? "TELEPHONE" : "EMAIL",
            emailContact: form.emailContact.trim(),
            telephoneContact: form.telephoneContact.trim(),
          },
          { withCredentials: true },
        );

        if (!active) return;

        const validation = response.data;
        setContactValidation(validation);

        if (!validation.valid) {
          if (contactValidationToastRef.current !== validation.message) {
            contactValidationToastRef.current = validation.message;
            toast.error(validation.message);
          }
        } else {
          contactValidationToastRef.current = "";
        }
      } catch (error) {
        if (!active) return;
        const message = axios.isAxiosError(error)
          ? (error.response?.data?.message as string) ||
            error.response?.data?.error ||
            error.message
          : error instanceof Error
            ? error.message
            : "Impossible de verifier le contact du demandeur.";
        setContactValidation({
          valid: false,
          message,
          qualiteDemandeur: form.qualiteDemandeur.trim(),
          canalVerification: verificationMode === "TELEPHONE" ? "TELEPHONE" : "EMAIL",
          expectedContact: null,
          actualContact: selectedContactValue,
          targetLabel: form.qualiteDemandeur.toLowerCase().includes("representant")
            ? "representant legal"
            : "titulaire",
          permisId: null,
          permisCode: null,
        });
        if (contactValidationToastRef.current !== message) {
          contactValidationToastRef.current = message;
          toast.error(message);
        }
      } finally {
        if (active) {
          setContactValidationLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    contactValidationReady,
    form.codePermis,
    form.emailContact,
    form.qualiteDemandeur,
    form.qrCode,
    form.telephoneContact,
    requestId,
    selectedContactValue,
    verificationMode,
  ]);

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
    }

    if (kind === "identity") {
      setIdentityFile(file);
      setIdentityFileName(file.name);
      setScanIdentityDone(true);
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
    if (!workflowReady || !verificationMode.trim()) {
      throw new Error("Les options du workflow cadastral ne sont pas encore chargees.");
    }
    if (!form.typePermis.trim()) {
      throw new Error("Veuillez selectionner un type de permis.");
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

  const toggleDocument = (code: string) => {
    setSelectedDocs((prev) =>
      prev.includes(code) ? prev.filter((value) => value !== code) : [...prev, code],
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
    setVerificationMode("");
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

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(getDefaultDashboardPath(auth?.role), { replace: true })}
            >
              <LayoutDashboard size={18} />
              Retour au dashboard
            </button>
          </div>

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
                    <strong>{selectedVerificationLabel}</strong>
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
                Renseignez ou verifiez les informations du titre minier avant de continuer.
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
                <select
                  className={styles.fieldSelect}
                  value={form.typePermis}
                  onChange={(event) => updateForm("typePermis", event.target.value)}
                  disabled={typePermisLoading}
                >
                  <option value="">
                    {typePermisLoading ? "Chargement des types..." : "Selectionnez un type de permis"}
                  </option>
                  {typePermisOptions.map((option) => (
                    <option
                      key={option.id}
                      value={option.lib_type || option.code_type || String(option.id)}
                    >
                      {option.code_type && option.lib_type
                        ? `${option.code_type} - ${option.lib_type}`
                        : option.lib_type || option.code_type || `Type ${option.id}`}
                    </option>
                  ))}
                </select>
                {typePermisError ? <div className={styles.fieldHint}>{typePermisError}</div> : null}
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
                Renseignez l'identite du detenteur a partir de la carte scannee ou de la saisie manuelle.
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
            {workflowOptionsLoading ? (
              <div className={styles.workflowState}>Chargement des canaux OTP depuis la base...</div>
            ) : workflowOptionsError ? (
              <div className={`${styles.workflowState} ${styles.workflowStateError}`}>{workflowOptionsError}</div>
            ) : (
              <div className={styles.verificationSwitch}>
                {workflowVerificationOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = verificationMode === option.code;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      className={[
                        styles.switchButton,
                        selected ? styles.switchButtonActive : "",
                      ].join(" ")}
                      onClick={() => setVerificationMode(option.code)}
                    >
                      <Icon size={16} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{contactFieldLabel}</span>
                <div className={styles.inlineRow}>
                  <input
                    className={styles.fieldInput}
                    value={
                      verificationMode === "TELEPHONE"
                        ? form.telephoneContact
                        : verificationMode === "EMAIL"
                          ? form.emailContact
                          : ""
                    }
                    disabled={step1Busy}
                    onChange={(event) =>
                      verificationMode === "TELEPHONE"
                        ? updateForm("telephoneContact", event.target.value)
                        : verificationMode === "EMAIL"
                          ? updateForm("emailContact", event.target.value)
                          : undefined
                    }
                    placeholder={
                      verificationMode
                        ? ""
                        : "Choisissez le canal OTP au-dessus avant de saisir le contact."
                    }
                  />
                  <button
                    type="button"
                    className={styles.secondaryButton}
                  onClick={handleSendOtp}
                  disabled={
                    step1Busy ||
                    !workflowReady ||
                    (!requestId &&
                      (!form.typePermis.trim() ||
                        !verificationMode.trim() ||
                        !form.qualiteDemandeur.trim() ||
                        !selectedContactValue.length ||
                        !form.qrCode.trim() ||
                        !form.codePermis.trim() ||
                        contactValidationLoading ||
                        contactValidation?.valid !== true))
                  }
                >
                  {requestId ? "Renvoyer le code" : "Envoyer le code"}
                </button>
              </div>
                  {contactValidationLoading ? (
                  <span className={styles.fieldHint}>Verification du contact en cours...</span>
                ) : contactValidation ? (
                  <span className={contactValidation.valid ? styles.fieldHint : styles.errorText}>
                    {contactValidation.message}
                  </span>
                ) : (
                  <span className={styles.fieldHint}>
                    Veuillez saisir le code QR, le code permis et le type de permis avant d&apos;envoyer le code OTP.
                  </span>
                )}
                <span className={styles.fieldHint}>
                  {verificationMode
                    ? "Le code de verification sera envoye au canal selectionne."
                    : "Aucun canal n'est selectionne pour le moment."}
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
                  <option value="">Selectionnez la qualite du demandeur</option>
                  <option>Titulaire du titre minier</option>
                  <option>Representant legal</option>
                  <option>Actionnaire</option>
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
                  <option value="">Selectionnez l'objet de la demande</option>
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
                  placeholder="Precisez le fondement legal ou l'interet legitime justifiant la communication."
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
                  Code envoye au {verificationMode === "TELEPHONE" ? form.telephoneContact : form.emailContact}.
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

            {workflowOptionsLoading ? (
              <div className={styles.workflowState}>Chargement des options depuis la base...</div>
            ) : workflowOptionsError ? (
              <div className={`${styles.workflowState} ${styles.workflowStateError}`}>{workflowOptionsError}</div>
            ) : (
              <div className={styles.documentGrid}>
                {workflowDocumentOptions.map((document) => {
                  const selected = selectedDocs.includes(document.code);
                  const Icon = document.icon;
                  return (
                    <button
                      key={document.code}
                      type="button"
                      className={[
                        styles.documentCard,
                        selected ? styles.documentCardSelected : "",
                        document.accent === "teal" ? styles.documentCardTeal : "",
                      ].join(" ")}
                      onClick={() => toggleDocument(document.code)}
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
            )}

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
          <div className={styles.card}>
            <div className={styles.successHeader}>
              <div className={styles.successIcon}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className={styles.successTitle}>
                  Votre demande de cadastre a ete enregistree avec succes
                </div>
                <div className={styles.successText}>
                  L&apos;accuse de reception a ete genere et archive dans le dossier public du serveur.
                  {generatedRequestMessage ? ` ${generatedRequestMessage}` : ""}
                </div>
              </div>
            </div>

            <div className={styles.successBanner}>
              <Sparkles size={18} />
              <span>
                Vous pouvez telecharger votre accuse de reception maintenant. Les autres documents seront traites
                apres le traitement interne et la synchronisation.
              </span>
            </div>

            <a
              href={receiptDownloadUrl}
              className={`${styles.primaryButton} ${styles.fullWidthButton}`}
              target="_blank"
              rel="noreferrer"
            >
              <Download size={18} />
              Telecharger l&apos;accuse de reception
            </a>
          </div>

          <div className={styles.footerBar}>
            <button type="button" className={styles.secondaryButton} onClick={handleResetWorkflow}>
              Nouvelle demande
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(getDefaultDashboardPath(auth?.role), { replace: true })}
            >
              Retour au dashboard
            </button>
          </div>
        </section>
      </main>
    </InvestorLayout>
  );
}
