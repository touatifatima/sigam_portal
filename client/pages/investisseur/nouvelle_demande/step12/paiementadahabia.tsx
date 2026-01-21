import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CreditCard, Lock, ArrowLeft, Shield, CheckCircle, AlertCircle } from "lucide-react";
import axios from "axios";
import styles from "./PaiementAdahabia.module.css";

interface PaymentData {
  codedemande: string;
  montant: number;
  societe: string;
  typePermis: string;
}

const PaiementAdahabia = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Récupérer les données depuis la navigation ou utiliser des valeurs par défaut
  const paymentData: PaymentData = location.state || {
    codedemande: `DEM-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`,
    montant: 125000,
    societe: "Société ABC Mining SARL",
    typePermis: "Permis d'Exploration"
  };

  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  // Formater le numéro de carte (ajouter des espaces tous les 4 chiffres)
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, "$1 ");
    return formatted.substring(0, 19); // Max 16 chiffres + 3 espaces
  };

  // Formater la date d'expiration (MM/AA)
  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + "/" + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  // Validation du formulaire
  const isFormValid = () => {
    const cardDigits = cardNumber.replace(/\s/g, "");
    const expiryParts = expiryDate.split("/");
    
    return (
      cardDigits.length === 16 &&
      expiryParts.length === 2 &&
      expiryParts[0].length === 2 &&
      expiryParts[1].length === 2 &&
      cvv.length >= 3
    );
  };

  // Traitement du paiement
  const handlePayment = async () => {
    if (!isFormValid()) {
      setError("Veuillez remplir tous les champs correctement.");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      // Simulation d'appel API Adahabia
      // Dans une vraie implémentation, utiliser:
      // const response = await axios.post('/api/paiement/adahabia', { ... });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulation délai

      // Simuler une réponse réussie
      const transactionId = `TXN-${Date.now()}`;
      
      // Rediriger vers la page de confirmation
      navigate("/investisseur/nouvelle_demande/step12/confirmationpay", {
        state: {
          ...paymentData,
          transactionId,
          datePaiement: new Date().toISOString(),
          dernierChiffres: cardNumber.replace(/\s/g, "").slice(-4)
        }
      });

    } catch (err) {
      setError("Une erreur est survenue lors du traitement du paiement. Veuillez réessayer.");
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={20} />
            Retour
          </button>
          <h1 className={styles.title}>Paiement par Carte Adahabia</h1>
          <p className={styles.subtitle}>
            Effectuez votre paiement en toute sécurité
          </p>
        </div>

        <div className={styles.content}>
          {/* Résumé de la commande */}
          <div className={styles.summaryCard}>
            <h2 className={styles.sectionTitle}>Résumé de la demande</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Code Demande</span>
                <span className={styles.summaryValue}>{paymentData.codedemande}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Type de Permis</span>
                <span className={styles.summaryValue}>{paymentData.typePermis}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Titulaire</span>
                <span className={styles.summaryValue}>{paymentData.societe}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Montant à payer</span>
                <span className={styles.summaryAmount}>
                  {paymentData.montant.toLocaleString()} DA
                </span>
              </div>
            </div>
          </div>

          {/* Formulaire de paiement */}
          <div className={styles.paymentCard}>
            <div className={styles.cardHeader}>
              <CreditCard className={styles.cardIcon} size={24} />
              <h2 className={styles.sectionTitle}>Informations de la carte</h2>
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handlePayment(); }}>
              {/* Numéro de carte */}
              <div className={styles.inputGroup}>
                <label htmlFor="cardNumber" className={styles.label}>
                  Numéro de carte
                </label>
                <div className={styles.inputWrapper}>
                  <CreditCard className={styles.inputIcon} size={18} />
                  <input
                    id="cardNumber"
                    type="text"
                    className={styles.input}
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Ligne date + CVV */}
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label htmlFor="expiry" className={styles.label}>
                    Date d'expiration
                  </label>
                  <input
                    id="expiry"
                    type="text"
                    className={styles.input}
                    placeholder="MM/AA"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                    maxLength={5}
                    disabled={isProcessing}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="cvv" className={styles.label}>
                    CVV
                  </label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} size={18} />
                    <input
                      id="cvv"
                      type="password"
                      className={styles.input}
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").substring(0, 4))}
                      maxLength={4}
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </div>

              {/* Bouton de paiement */}
              <button
                type="submit"
                className={styles.payButton}
                disabled={!isFormValid() || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className={styles.spinner}></div>
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    Confirmer le paiement de {paymentData.montant.toLocaleString()} DA
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer sécurité */}
          <div className={styles.securityFooter}>
            <Shield className={styles.securityIcon} size={20} />
            <div className={styles.securityText}>
              <strong>Paiement 100% sécurisé</strong>
              <span>Vos données sont protégées par un cryptage SSL 256 bits</span>
            </div>
            <div className={styles.badges}>
              <span className={styles.badge}>
                <CheckCircle size={14} />
                Adahabia
              </span>
              <span className={styles.badge}>
                <Lock size={14} />
                SSL
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaiementAdahabia;
