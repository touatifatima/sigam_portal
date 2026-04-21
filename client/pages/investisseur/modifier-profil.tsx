import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  KeyRound,
  Mail,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/src/hooks/use-toast";
import { useAuthStore } from "@/src/store/useAuthStore";
import styles from "./modifier-profil.module.css";

type ProfileUpdateStatus = {
  canEdit: boolean;
  lastProfileUpdateAt: string | null;
  nextAvailableAt: string | null;
  remainingMs: number;
  cooldownMessage: string | null;
  hasPendingRequest: boolean;
  pendingExpiresAt: string | null;
  resendAvailableAt: string | null;
};

type ProfileFormState = {
  Prenom: string;
  nom: string;
  email: string;
  telephone: string;
  password: string;
  confirmPassword: string;
};

const emptyStatus: ProfileUpdateStatus = {
  canEdit: true,
  lastProfileUpdateAt: null,
  nextAvailableAt: null,
  remainingMs: 0,
  cooldownMessage: null,
  hasPendingRequest: false,
  pendingExpiresAt: null,
  resendAvailableAt: null,
};

export default function ModifierProfilPage() {
  const navigate = useNavigate();
  const { auth, initialize } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [status, setStatus] = useState<ProfileUpdateStatus>(emptyStatus);
  const [statusLoading, setStatusLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState(auth.email || "");
  const [pendingExpiresLabel, setPendingExpiresLabel] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>({
    Prenom: auth.Prenom || "",
    nom: auth.nom || "",
    email: auth.email || "",
    telephone: auth.telephone || "",
    password: "",
    confirmPassword: "",
  });
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpCode = useMemo(() => otpDigits.join(""), [otpDigits]);

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      Prenom: auth.Prenom || "",
      nom: auth.nom || "",
      email: auth.email || "",
      telephone: auth.telephone || "",
    }));
    setOtpEmail(auth.email || "");
  }, [auth.Prenom, auth.email, auth.nom, auth.telephone]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const normalizePhoneValue = (value?: string | null) =>
    String(value || "").replace(/\D/g, "");

  const extractApiMessage = (error: any, fallback: string) => {
    const message = error?.response?.data?.message;
    if (Array.isArray(message)) {
      return message.join(" ");
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    if (typeof error?.response?.data?.error === "string" && error.response.data.error.trim()) {
      return error.response.data.error;
    }
    return fallback;
  };

  const syncStatus = async () => {
    if (!apiURL) {
      setStatus({
        ...emptyStatus,
        canEdit: false,
        cooldownMessage: "Configuration API manquante.",
      });
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    try {
      const response = await axios.get(`${apiURL}/auth/profile-update/status`, {
        withCredentials: true,
      });
      const nextStatus = response.data as ProfileUpdateStatus;
      setStatus(nextStatus);
      setOtpStep(Boolean(nextStatus.hasPendingRequest));
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpError(null);
      setOtpInfo(
        nextStatus.hasPendingRequest
          ? "Une demande est deja en attente. Saisissez le code OTP recu par email."
          : null,
      );
      const resendAt = nextStatus.resendAvailableAt
        ? new Date(nextStatus.resendAvailableAt).getTime()
        : 0;
      setResendSecondsLeft(
        resendAt > Date.now() ? Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)) : 0,
      );
      setPendingExpiresLabel(formatDateTime(nextStatus.pendingExpiresAt));
    } catch (error: any) {
      toast({
        title: "Chargement impossible",
        description: extractApiMessage(
          error,
          "Impossible de recuperer le statut de modification du profil.",
        ),
        variant: "destructive",
      });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void syncStatus();
  }, [apiURL]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSecondsLeft]);

  useEffect(() => {
    if (!otpStep) return;
    const timer = window.setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [otpStep]);

  const handleChange =
    (field: keyof ProfileFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const remainingLabel = useMemo(() => {
    if (!status.remainingMs || status.remainingMs <= 0) return null;
    const totalMinutes = Math.ceil(status.remainingMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) {
      return `${minutes} min`;
    }
    if (minutes === 0) {
      return `${hours} h`;
    }
    return `${hours} h ${minutes} min`;
  }, [status.remainingMs]);

  const handleRequestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiURL || !status.canEdit || submitting) return;

    const normalizedPhone = normalizePhoneValue(formState.telephone);
    if (normalizedPhone && !/^0\d{9}$/.test(normalizedPhone)) {
      toast({
        title: "Telephone invalide",
        description:
          "Veuillez entrer un numero de telephone valide (10 chiffres commencant par 0).",
        variant: "destructive",
      });
      return;
    }

    const hasChanges =
      formState.Prenom.trim() !== (auth.Prenom || "").trim() ||
      formState.nom.trim() !== (auth.nom || "").trim() ||
      formState.email.trim().toLowerCase() !== (auth.email || "").trim().toLowerCase() ||
      normalizedPhone !== normalizePhoneValue(auth.telephone) ||
      Boolean(formState.password || formState.confirmPassword);

    if (!hasChanges) {
      toast({
        title: "Aucune modification",
        description: "Aucune modification detectee.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formState,
        telephone: normalizedPhone || null,
      };
      const response = await axios.post(
        `${apiURL}/auth/profile-update/request`,
        payload,
        { withCredentials: true },
      );

      const resendAt = response.data?.resendAvailableAt
        ? new Date(response.data.resendAvailableAt).getTime()
        : Date.now() + 60 * 1000;
      setResendSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
      setOtpStep(true);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpEmail(auth.email || formState.email);
      setPendingExpiresLabel(formatDateTime(response.data?.expiresAt));
      setOtpError(null);
      setOtpInfo(
        "Un code a 6 chiffres a ete envoye a votre adresse email actuelle pour confirmer la modification.",
      );
      setStatus((current) => ({
        ...current,
        hasPendingRequest: true,
        pendingExpiresAt: response.data?.expiresAt ?? current.pendingExpiresAt,
        resendAvailableAt:
          response.data?.resendAvailableAt ?? current.resendAvailableAt,
      }));

    } catch (error: any) {
      toast({
        title: "Envoi impossible",
        description: extractApiMessage(
          error,
          "Impossible de lancer la verification OTP.",
        ),
        variant: "destructive",
      });
      if (error?.response?.status === 429) {
        await syncStatus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!apiURL) return;
    if (otpCode.length !== 6) {
      setOtpError("Veuillez saisir le code complet a 6 chiffres.");
      setOtpInfo(null);
      return;
    }

    setVerifying(true);
    setOtpError(null);
    try {
      await axios.post(
        `${apiURL}/auth/profile-update/verify`,
        { code: otpCode },
        { withCredentials: true },
      );

      await initialize();
      setOtpInfo("Code verifie. Vos informations personnelles ont ete mises a jour.");
      navigate("/investisseur/profil");
    } catch (error: any) {
      setOtpInfo(null);
      setOtpError(extractApiMessage(error, "Le code OTP est invalide ou expire."));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!apiURL || resendSecondsLeft > 0) return;

    setSubmitting(true);
    try {
      const response = await axios.post(
        `${apiURL}/auth/profile-update/resend`,
        {},
        { withCredentials: true },
      );

      const resendAt = response.data?.resendAvailableAt
        ? new Date(response.data.resendAvailableAt).getTime()
        : Date.now() + 60 * 1000;
      setResendSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
      setPendingExpiresLabel(formatDateTime(response.data?.expiresAt));
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpError(null);
      setOtpInfo("Nouveau code envoye a votre adresse email actuelle.");
      otpInputRefs.current[0]?.focus();
    } catch (error: any) {
      setOtpInfo(null);
      setOtpError(extractApiMessage(error, "Impossible de renvoyer le code OTP."));
    } finally {
      setSubmitting(false);
    }
  };

  const isBlocked = !status.canEdit;
  const handleOtpInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const nextDigits = [...otpDigits];
    nextDigits[index] = value.slice(-1);
    setOtpDigits(nextDigits);
    setOtpError(null);
    setOtpInfo(null);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pastedData = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    const nextDigits = ["", "", "", "", "", ""];
    pastedData.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    setOtpDigits(nextDigits);
    setOtpError(null);
    setOtpInfo(null);

    const targetIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[targetIndex]?.focus();
  };

  const getOtpInputClassName = (index: number) => {
    let className = styles.otpInput;
    if (otpDigits[index]) className += ` ${styles.otpInputFilled}`;
    if (otpError) className += ` ${styles.otpInputError}`;
    return className;
  };

  return (
    <InvestorLayout>
      <div className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.headerCard}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate("/investisseur/profil")}
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au profil
            </button>

            <div className={styles.headerCopy}>
              <span className={styles.eyebrow}>Modification securisee</span>
              <h1 className={styles.title}>Modifier mes informations personnelles</h1>
              <p className={styles.subtitle}>
                Toute modification est protegee par OTP envoye sur votre adresse email actuelle
                et reste limitee a une validation tous les 2 jours.
              </p>
            </div>
          </div>

          {statusLoading ? (
            <section className={styles.noticeCard}>
              <p className={styles.noticeText}>Verification de vos droits de modification...</p>
            </section>
          ) : isBlocked ? (
            <section className={`${styles.noticeCard} ${styles.noticeWarning}`}>
              <div className={styles.noticeIcon}>
                <Clock3 className="w-5 h-5" />
              </div>
              <div className={styles.noticeBody}>
                <h2 className={styles.noticeTitle}>Modification temporairement indisponible</h2>
                <p className={styles.noticeText}>
                  {status.cooldownMessage ||
                    "Vous avez deja modifie vos informations personnelles recemment."}
                </p>
                {remainingLabel ? (
                  <p className={styles.noticeMeta}>Disponible a nouveau dans {remainingLabel}.</p>
                ) : null}
              </div>
            </section>
          ) : (
            <div className={styles.grid}>
              <section className={styles.formCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={styles.cardEyebrow}>Formulaire</span>
                    <h2 className={styles.cardTitle}>Informations modifiables</h2>
                  </div>
                </div>

                <form className={styles.formGrid} onSubmit={handleRequestOtp}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Prenom</span>
                    <Input
                      value={formState.Prenom}
                      onChange={handleChange("Prenom")}
                      placeholder="Votre prenom"
                      className={styles.inputControl}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Nom</span>
                    <Input
                      value={formState.nom}
                      onChange={handleChange("nom")}
                      placeholder="Votre nom"
                      className={styles.inputControl}
                    />
                  </label>

                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span className={styles.fieldLabel}>Email</span>
                    <Input
                      type="email"
                      value={formState.email}
                      onChange={handleChange("email")}
                      placeholder="vous@exemple.com"
                      className={styles.inputControl}
                    />
                  </label>

                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span className={styles.fieldLabel}>Telephone</span>
                    <Input
                      value={formState.telephone}
                      onChange={handleChange("telephone")}
                      placeholder="0550 00 00 00"
                      className={styles.inputControl}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Nouveau mot de passe</span>
                    <Input
                      type="password"
                      value={formState.password}
                      onChange={handleChange("password")}
                      placeholder="Laisser vide pour ne pas changer"
                      className={styles.inputControl}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Confirmer le mot de passe</span>
                    <Input
                      type="password"
                      value={formState.confirmPassword}
                      onChange={handleChange("confirmPassword")}
                      placeholder="Confirmer le nouveau mot de passe"
                      className={styles.inputControl}
                    />
                  </label>

                  <div className={`${styles.actions} ${styles.fieldFull}`}>
                    <Button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={submitting}
                    >
                      <Save className="w-4 h-4" />
                      Enregistrer les modifications
                    </Button>
                  </div>
                </form>
              </section>

              <aside className={styles.sidePanel}>
                <section className={styles.sideCard}>
                  <div className={styles.sideCardHeader}>
                    <ShieldCheck className="w-5 h-5" />
                    <h3>Regles de securite</h3>
                  </div>
                  <ul className={styles.ruleList}>
                    <li>Validation obligatoire par code OTP a 6 chiffres.</li>
                    <li>Le code expire 10 minutes apres son envoi.</li>
                    <li>Le code est envoye a votre adresse email actuelle.</li>
                    <li>Une seule modification confirmee toutes les 48 heures.</li>
                  </ul>
                </section>

                {otpStep ? (
                  <section className={`${styles.sideCard} ${styles.otpCard}`}>
                    <div className={styles.sideCardHeader}>
                      <KeyRound className="w-5 h-5" />
                      <h3>Validation OTP</h3>
                    </div>

                    <p className={styles.sideText}>
                      Saisissez le code envoye a <strong>{otpEmail}</strong>.
                    </p>
                    {pendingExpiresLabel ? (
                      <p className={styles.sideMeta}>Code valable jusqu au {pendingExpiresLabel}.</p>
                    ) : null}

                    <div className={styles.otpInputWrap}>
                      {otpError ? (
                        <div className={`${styles.otpAlert} ${styles.otpAlertError}`}>
                          <AlertCircle className="w-4 h-4" />
                          <span>{otpError}</span>
                        </div>
                      ) : null}
                      {otpInfo ? (
                        <div className={`${styles.otpAlert} ${styles.otpAlertSuccess}`}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{otpInfo}</span>
                        </div>
                      ) : null}

                      <div className={styles.otpInputs} onPaste={handleOtpPaste}>
                        {otpDigits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              otpInputRefs.current[index] = element;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={1}
                            value={digit}
                            disabled={verifying}
                            onChange={(event) =>
                              handleOtpInputChange(index, event.target.value)
                            }
                            onKeyDown={(event) => handleOtpKeyDown(index, event)}
                            className={getOtpInputClassName(index)}
                            aria-label={`Chiffre OTP ${index + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={styles.otpActions}>
                      <Button
                        className={styles.primaryButton}
                        onClick={handleVerifyOtp}
                        disabled={otpCode.length !== 6 || verifying}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Valider le code
                      </Button>

                      <Button
                        variant="outline"
                        className={styles.secondaryButton}
                        onClick={handleResendOtp}
                        disabled={resendSecondsLeft > 0 || submitting}
                      >
                        <Mail className="w-4 h-4" />
                        {resendSecondsLeft > 0
                          ? `Renvoyer dans ${resendSecondsLeft}s`
                          : "Renvoyer le code"}
                      </Button>
                    </div>
                  </section>
                ) : null}

                <section className={styles.sideCard}>
                  <div className={styles.sideCardHeader}>
                    <AlertCircle className="w-5 h-5" />
                    <h3>Important</h3>
                  </div>
                  <p className={styles.sideText}>
                    Si vous changez votre email ou votre mot de passe, la modification n est
                    appliquee qu apres verification OTP.
                  </p>
                </section>
              </aside>
            </div>
          )}
        </div>
      </div>
    </InvestorLayout>
  );
}
