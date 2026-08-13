import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Download, FileText, MessageSquare, Phone, RefreshCcw, Send, UserRound, X } from "lucide-react";
import { toast } from "react-toastify";
import Navbar from "@/pages/navbar/Navbar";
import Sidebar from "@/pages/sidebar/Sidebar";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useViewNavigator } from "@/src/hooks/useViewNavigator";
import { getDefaultDashboardPath, isAdminRole, normalizeRoles } from "@/src/utils/roleNavigation";
import {
  buildApiUrl, type CadastreDocumentRequest, documentLabel, displayName, formatBytes, formatDateTime,
  handleApiError, organizationName, statusClass, statusLabel,
} from "./shared";
import styles from "./detail_demande_documents.module.css";

const getPayload = (
  value: CadastreDocumentRequest | { demande?: CadastreDocumentRequest },
): CadastreDocumentRequest | null => {
  if ("id" in value && "referenceDemande" in value) return value as CadastreDocumentRequest;
  return value.demande || null;
};

export default function DetailDemandeDocumentPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const auth = useAuthStore((state) => state.auth);
  const isAuthReady = useAuthReady();
  const [item, setItem] = useState<CadastreDocumentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = isAdminRole(auth?.role) || normalizeRoles(auth?.role).includes("agent_cadastre");
  const { navigateTo } = useViewNavigator("agent_cadastre_documents");

  useEffect(() => {
    if (!isAuthReady || !auth) return;
    if (!isAdmin) navigate(getDefaultDashboardPath(auth.role), { replace: true });
  }, [auth, isAdmin, isAuthReady, navigate]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await axios.get<CadastreDocumentRequest | { demande?: CadastreDocumentRequest }>(
        buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${id}`), { withCredentials: true },
      );
      setItem(getPayload(response.data));
    } catch (error) {
      toast.error(handleApiError(error, "Impossible de charger la demande."));
      navigate("/admin_panel/agent_cadastre/gestion_demandes_documents", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { if (isAuthReady && isAdmin) void load(); }, [isAdmin, isAuthReady, load]);

  const updateStatus = async (statut: string) => {
    if (!item) return;
    if (["REJETEE", "EN_COMPLEMENT"].includes(statut) && !comment.trim()) {
      toast.error("Ajoutez un commentaire pour expliquer cette décision.");
      return;
    }
    setSaving(true);
    try {
      const response = await axios.post<{ demande?: CadastreDocumentRequest }>(
        buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${item.id}/admin/status`),
        { statut, commentaire: comment.trim() }, { withCredentials: true },
      );
      setItem(response.data.demande || { ...item, statut });
      setComment("");
      toast.success("Décision enregistrée.");
    } catch (error) {
      toast.error(handleApiError(error, "La décision n’a pas pu être enregistrée."));
    } finally {
      setSaving(false);
    }
  };

  const addNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!item || !note.trim()) return;
    setSaving(true);
    try {
      await axios.post(buildApiUrl(`/api/cadastre/demandes-documents-cadastraux/${item.id}/admin/note`), { note: note.trim() }, { withCredentials: true });
      setNote("");
      await load();
      toast.success("Note ajoutée à l’historique.");
    } catch (error) {
      toast.error(handleApiError(error, "La note n’a pas pu être enregistrée."));
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthReady || !auth || !isAdmin || loading) {
    return <div className={styles.loading}><RefreshCcw className={styles.spin} size={20} /> Chargement de la demande...</div>;
  }
  if (!item) return null;

  const applicantName = displayName(item);
  const organization = organizationName(item);
  const pieces = item.piecesJointes || [];
  const generated = item.documentsGeneres || [];
  const history = item.historique || [];

  return (
    <div className={styles.shell}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView="agent_cadastre_documents" navigateTo={navigateTo} />
        <main className={styles.page}>
        <button type="button" className={styles.backButton} onClick={() => navigate("/admin_panel/agent_cadastre/gestion_demandes_documents")}><ArrowLeft size={17} /> Retour aux demandes</button>
        <div className={styles.hero}>
          <div><div className={styles.eyebrow}>Détail de la demande</div><h1>{item.referenceDemande}</h1><p>Demandeur : {applicantName} · Créée le {formatDateTime(item.dateDemande)}</p></div>
          <span className={`${styles.status} ${styles[statusClass(item.statut)]}`}><i />{statusLabel(item.statut)}</span>
        </div>

        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            <section className={styles.card}><h2>Informations de la demande</h2><div className={styles.infoGrid}>
              <Info label="Type de document" value={documentLabel(item.typeDocument)} /><Info label="Objet / permis" value={item.codePermis || item.permis?.code_permis || "—"} /><Info label="Date de soumission" value={formatDateTime(item.dateSoumission || item.dateDemande)} /><Info label="Qualité du demandeur" value={item.qualiteDemandeur || "—"} /><div className={styles.full}><label>Motif de la demande</label><p>{item.objetDemande || "—"}</p></div><div className={styles.full}><label>Base de communication</label><p>{item.baseCommunication || "—"}</p></div>
            </div></section>

            <section className={styles.card}><h2><UserRound size={18} /> Demandeur et organisation</h2><div className={styles.profileGrid}><div className={styles.profile}><span className={styles.bigAvatar}>{(applicantName[0] || "?").toUpperCase()}</span><div><strong>{applicantName}</strong><span>{item.emailContact || item.utilisateur?.email || "—"}</span><span><Phone size={13} /> {item.telephoneContact || item.utilisateur?.telephone || "—"}</span></div></div><div className={styles.organization}><FileText size={20} /><div><label>Organisation / titulaire</label><strong>{organization}</strong><span>RC : {item.numeroRc || "—"}</span></div></div></div></section>

            <section className={styles.card}><h2><FileText size={18} /> Pièces jointes</h2>{pieces.length === 0 && generated.length === 0 ? <p className={styles.muted}>Aucun document joint.</p> : <div className={styles.documents}>{[...pieces.map((piece) => ({ id: `piece-${piece.id}`, name: piece.nomFichierOriginal || piece.typePiece || "Pièce jointe", url: piece.fichierUrl, meta: `${piece.typePiece || "Pièce"} · ${formatBytes(piece.tailleOctets)}` })), ...generated.map((doc) => ({ id: `doc-${doc.id}`, name: doc.referenceDocument || "Document cadastral généré", url: doc.fichierUrl, meta: `${documentLabel(doc.typeDocument)} · ${formatDateTime(doc.dateGeneration)}` }))].map((document) => <div className={styles.documentRow} key={document.id}><span className={styles.fileIcon}><FileText size={17} /></span><span><strong>{document.name}</strong><small>{document.meta}</small></span>{document.url && <a href={buildApiUrl(document.url)} target="_blank" rel="noreferrer" className={styles.download}><Download size={15} /> Ouvrir</a>}</div>)}</div>}</section>

            <section className={styles.card}><h2>Historique de traitement</h2><div className={styles.timeline}>{history.length === 0 ? <p className={styles.muted}>Aucun événement.</p> : history.map((event, index) => <div className={styles.timelineItem} key={event.id}><span className={`${styles.timelineDot} ${index === 0 ? styles.activeDot : ""}`} /><div><strong>{event.action || "Événement"}</strong><small>{formatDateTime(event.dateAction)} · {event.agentEmetteur || "Système"}</small>{event.detailsCommunication && <p>{event.detailsCommunication}</p>}</div></div>)}</div></section>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.card}><h2>Décision finale</h2><p className={styles.help}>La décision est historisée et visible par le demandeur.</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Commentaire ou motif de décision..." /><div className={styles.decisionButtons}><button type="button" className={styles.acceptButton} disabled={saving} onClick={() => void updateStatus("ACCEPTEE")}><Check size={16} /> Accepter</button><button type="button" className={styles.rejectButton} disabled={saving} onClick={() => void updateStatus("REJETEE")}><X size={16} /> Refuser</button><button type="button" className={styles.complementButton} disabled={saving} onClick={() => void updateStatus("EN_COMPLEMENT")}><MessageSquare size={16} /> Demander un complément</button></div><button type="button" className={styles.examButton} disabled={saving} onClick={() => void updateStatus("EN_COURS_EXAMEN")}>Marquer en cours d’examen</button></section>

            <section className={styles.card}><h2>Notes administratives</h2><form onSubmit={addNote}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ajouter une note interne..." /><button type="submit" className={styles.noteButton} disabled={saving || !note.trim()}><Send size={15} /> Enregistrer la note</button></form>{history.filter((event) => event.action === "NOTE_AJOUTEE").map((event) => <div className={styles.note} key={event.id}><small>{formatDateTime(event.dateAction)} · {event.agentEmetteur || "Agent"}</small><p>{event.detailsCommunication}</p></div>)}</section>

            <section className={styles.card}><h2>Vérifications</h2><div className={styles.checkLine}><span>OTP identité</span><strong className={item.otpVerifiedAt ? styles.ok : styles.pending}>{item.otpVerifiedAt ? "Vérifié" : "Non vérifié"}</strong></div><div className={styles.checkLine}><span>QR / permis</span><strong className={item.permis ? styles.ok : styles.pending}>{item.permis ? "Correspondance trouvée" : "À vérifier"}</strong></div><div className={styles.checkLine}><span>Preuve de paiement</span><strong className={item.preuvePaiementUrl ? styles.ok : styles.pending}>{item.preuvePaiementUrl ? "Présente" : "Non renseignée"}</strong></div></section>
          </aside>
        </div>
        </main>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><label>{label}</label><strong>{value}</strong></div>;
}
