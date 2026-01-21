import { useNavigate, useLocation } from "react-router-dom";
import { 
  CheckCircle, 
  Download, 
  Mail, 
  Home, 
  FileText, 
  Calendar, 
  CreditCard,
  Building,
  Hash,
  Clock
} from "lucide-react";
import { jsPDF } from "jspdf";
import styles from "./confirmationpay.module.css";

interface ConfirmationData {
  codedemande: string;
  montant: number;
  societe: string;
  typePermis: string;
  transactionId: string;
  datePaiement: string;
  dernierChiffres: string;
}

const ConfirmationPaiement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const data: ConfirmationData = location.state || {
    codedemande: "DEM-2026-00001",
    montant: 125000,
    societe: "Société ABC Mining SARL",
    typePermis: "Permis d'Exploration",
    transactionId: `TXN-${Date.now()}`,
    datePaiement: new Date().toISOString(),
    dernierChiffres: "3456"
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('fr-DZ', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // En-tête
    doc.setFillColor(139, 58, 98); // Couleur primary mauve
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("SIGAM - Confirmation de Paiement", pageWidth / 2, 25, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Agence Nationale des Activités Minières", pageWidth / 2, 35, { align: "center" });
    
    // Badge de succès
    doc.setTextColor(34, 139, 34);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("✓ PAIEMENT RÉUSSI", pageWidth / 2, 60, { align: "center" });
    
    // Informations de la transaction
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Détails de la transaction", 20, 80);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 85, pageWidth - 20, 85);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const leftCol = 25;
    const rightCol = 85;
    let yPos = 95;
    const lineHeight = 10;
    
    // Détails
    const details = [
      { label: "N° Transaction:", value: data.transactionId },
      { label: "Code Demande:", value: data.codedemande },
      { label: "Date et Heure:", value: formatDate(data.datePaiement) },
      { label: "Montant payé:", value: `${data.montant.toLocaleString()} DA` },
      { label: "Mode de paiement:", value: `Carte Adahabia ****${data.dernierChiffres}` },
      { label: "Titulaire:", value: data.societe },
      { label: "Type de permis:", value: data.typePermis },
    ];
    
    details.forEach((item) => {
      doc.setFont("helvetica", "bold");
      doc.text(item.label, leftCol, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(item.value, rightCol, yPos);
      yPos += lineHeight;
    });
    
    // Ligne de séparation
    yPos += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
    
    // Message d'information
    yPos += 15;
    doc.setFillColor(240, 240, 250);
    doc.roundedRect(20, yPos, pageWidth - 40, 35, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const infoText = [
      "Ce document constitue une preuve de paiement officielle.",
      "Veuillez le conserver pour vos archives.",
      "Pour toute question, contactez-nous à: anam@anam.gov.dz"
    ];
    
    yPos += 10;
    infoText.forEach((line) => {
      doc.text(line, pageWidth / 2, yPos, { align: "center" });
      yPos += 8;
    });
    
    // Pied de page
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "SIGAM - Système Intégré de Gestion des Activités Minières",
      pageWidth / 2,
      280,
      { align: "center" }
    );
    doc.text(
      `Document généré le ${new Date().toLocaleDateString('fr-DZ')}`,
      pageWidth / 2,
      286,
      { align: "center" }
    );
    
    // Télécharger le PDF
    doc.save(`recu-paiement-${data.codedemande}.pdf`);
  };

  const handleSendEmail = () => {
    // Simulation d'envoi par email
    // Dans une vraie implémentation, appeler une API
    alert("Un email de confirmation a été envoyé à votre adresse email enregistrée.");
  };

  const handleGoToDashboard = () => {
    navigate("/investor/dashboard");
  };

  const handleViewDemandes = () => {
    navigate("/investor/demandes");
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Animation de succès */}
        <div className={styles.successAnimation}>
          <div className={styles.checkCircle}>
            <CheckCircle size={48} />
          </div>
        </div>

        {/* Message de succès */}
        <div className={styles.header}>
          <h1 className={styles.title}>Paiement effectué avec succès !</h1>
          <p className={styles.subtitle}>
            Votre transaction a été traitée. Un reçu vous sera envoyé par email.
          </p>
        </div>

        {/* Carte de confirmation */}
        <div className={styles.confirmationCard}>
          <div className={styles.cardHeader}>
            <FileText className={styles.cardIcon} size={24} />
            <h2 className={styles.cardTitle}>Détails du paiement</h2>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Hash size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>N° Transaction</span>
                <span className={styles.detailValue}>{data.transactionId}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <FileText size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Code Demande</span>
                <span className={styles.detailValue}>{data.codedemande}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Calendar size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Date & Heure</span>
                <span className={styles.detailValue}>{formatDate(data.datePaiement)}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <CreditCard size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Mode de paiement</span>
                <span className={styles.detailValue}>Carte Adahabia ****{data.dernierChiffres}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Building size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Titulaire</span>
                <span className={styles.detailValue}>{data.societe}</span>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Clock size={18} />
              </div>
              <div className={styles.detailContent}>
                <span className={styles.detailLabel}>Type de permis</span>
                <span className={styles.detailValue}>{data.typePermis}</span>
              </div>
            </div>
          </div>

          {/* Montant total */}
          <div className={styles.totalSection}>
            <span className={styles.totalLabel}>Montant payé</span>
            <span className={styles.totalAmount}>{data.montant.toLocaleString()} DA</span>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleDownloadPDF}>
            <Download size={18} />
            Télécharger le reçu PDF
          </button>
          
          <button className={styles.btnSecondary} onClick={handleSendEmail}>
            <Mail size={18} />
            Envoyer par email
          </button>
        </div>

        {/* Navigation */}
        <div className={styles.navigation}>
          <button className={styles.navButton} onClick={handleGoToDashboard}>
            <Home size={18} />
            Retour au tableau de bord
          </button>
          <button className={styles.navButton} onClick={handleViewDemandes}>
            <FileText size={18} />
            Voir mes demandes
          </button>
        </div>

        {/* Message d'info */}
        <div className={styles.infoBox}>
          <p>
            <strong>Prochaines étapes :</strong> Votre demande est maintenant en cours de traitement. 
            Vous recevrez une notification par email dès qu'une mise à jour sera disponible.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPaiement;
