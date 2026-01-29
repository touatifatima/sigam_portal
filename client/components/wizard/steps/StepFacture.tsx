import { FileText, Download, ArrowRight, ArrowLeft, Info, CheckCircle, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "./StepFacture.module.css";
import { DemandeFormData } from "@/pages/investor/NouvelleDemande";

interface StepFactureProps {
  data: any;
  formData: DemandeFormData;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

// Tarifs fictifs pour le calcul
const TARIFS = {
  droitFixe: {
    prospection: 30000,
    exploration: 50000,
    exploitation_petite: 80000,
    exploitation_grande: 150000,
    carriere: 40000,
  },
  redevanceSuperficiaire: 500, // par hectare
  taxeSubstance: {
    or: 15000,
    argent: 12000,
    cuivre: 8000,
    zinc: 7000,
    fer: 5000,
    phosphate: 6000,
    plomb: 7500,
    manganese: 6500,
    autres: 5000,
  },
  fraisAdministratifs: 10000,
};

export const StepFacture = ({ formData, onNext, onBack }: StepFactureProps) => {
  const navigate = useNavigate();
  
  // Récupération des données du formulaire
  const typePermis = formData.typePermis?.selectedType || "exploration";
  const superficie = formData.coordonneesCadastrales?.superficie || 100;
  const substances = formData.localisationSubstances?.substances || ["or", "cuivre"];
  const nomSociete = formData.identification?.nomSocieteFr || formData.localisationSubstances?.societe || "Société ABC Mining SARL";
  
  // Génération du code demande
  const codedemande = `DEM-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`;
  
  // Calcul des montants
  const calculerMontants = () => {
    const lignes = [];
    
    // 1. Droit fixe d'instruction
    const droitFixe = TARIFS.droitFixe[typePermis as keyof typeof TARIFS.droitFixe] || TARIFS.droitFixe.exploration;
    lignes.push({
      poste: "Droit fixe d'instruction",
      baseCalcul: `Fixe selon type de permis (${typePermis})`,
      montant: droitFixe,
    });
    
    // 2. Redevance superficiaire
    const redevanceSuperficiaire = superficie * TARIFS.redevanceSuperficiaire;
    lignes.push({
      poste: "Redevance superficiaire",
      baseCalcul: `${superficie} ha × ${TARIFS.redevanceSuperficiaire.toLocaleString()} DA/ha`,
      montant: redevanceSuperficiaire,
    });
    
    // 3. Taxes par substance
    substances.forEach((substance: string) => {
      const tarif = TARIFS.taxeSubstance[substance.toLowerCase() as keyof typeof TARIFS.taxeSubstance] || TARIFS.taxeSubstance.autres;
      lignes.push({
        poste: `Taxe substance (${substance})`,
        baseCalcul: `Tarif par substance`,
        montant: tarif,
      });
    });
    
    // 4. Frais administratifs
    lignes.push({
      poste: "Frais administratifs",
      baseCalcul: "Frais de traitement du dossier",
      montant: TARIFS.fraisAdministratifs,
    });
    
    const total = lignes.reduce((sum, ligne) => sum + ligne.montant, 0);
    
    return { lignes, total };
  };
  
  const { lignes, total } = calculerMontants();
  
  // Fonction pour télécharger la facture (simulation)
  const handleDownloadPDF = () => {
    // Simulation - dans une vraie app, on générerait un PDF
    const factureData = {
      codedemande,
      typePermis,
      societe: nomSociete,
      superficie,
      substances,
      lignes,
      total,
      date: new Date().toLocaleDateString('fr-DZ'),
    };
    
    // Créer un blob avec les données JSON (simulation)
    const blob = new Blob([JSON.stringify(factureData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture-${codedemande}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const getTypePermisLabel = (type: string) => {
    const labels: Record<string, string> = {
      prospection: "Permis de Prospection",
      exploration: "Permis d'Exploration",
      exploitation_petite: "Permis d'Exploitation (Petite mine)",
      exploitation_grande: "Permis d'Exploitation (Grande mine)",
      carriere: "Autorisation de Carrière",
    };
    return labels[type] || type;
  };

  // Navigation vers la page de paiement Adahabia
  const handlePayerParCarte = () => {
    navigate("/investor/paiement-adahabia", {
      state: {
        codedemande,
        montant: total,
        societe: nomSociete,
        typePermis: getTypePermisLabel(typePermis)
      }
    });
  };

  return (
    <div className={styles.factureContainer}>
      {/* En-tête */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <FileText className="inline-block mr-2 mb-1" size={28} />
          Facture à Payer
        </h1>
        <p className={styles.subtitle}>
          Récapitulatif des droits et taxes à régler pour votre demande
        </p>
      </div>

      {/* Carte d'informations */}
      <div className={styles.infoCard}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Code Demande</span>
            <span className={styles.infoValue}>{codedemande}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Type de Permis</span>
            <span className={styles.infoValue}>{getTypePermisLabel(typePermis)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Titulaire</span>
            <span className={styles.infoValue}>{nomSociete}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Superficie</span>
            <span className={styles.infoValue}>{superficie.toLocaleString()} hectares</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Statut</span>
            <span className={styles.badge}>
              <CheckCircle size={14} />
              En attente de paiement
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Substances</span>
            <div>
              {substances.map((sub: string, idx: number) => (
                <span key={idx} className={styles.subtancesTag}>
                  {sub}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tableau des montants */}
      <div className={styles.tableSection}>
        <h2 className={styles.sectionTitle}>
          <FileText size={20} />
          Détail des montants
        </h2>
        <table className={styles.factureTable}>
          <thead>
            <tr>
              <th>Poste</th>
              <th>Base de calcul</th>
              <th>Montant (DA)</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, index) => (
              <tr key={index}>
                <td>{ligne.poste}</td>
                <td>{ligne.baseCalcul}</td>
                <td>{ligne.montant.toLocaleString()} DA</td>
              </tr>
            ))}
            <tr className={styles.totalRow}>
              <td colSpan={2}>Total à payer</td>
              <td>{total.toLocaleString()} DA</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Message d'information */}
      <div className={styles.alertBox}>
        <Info className={styles.alertIcon} size={20} />
        <p className={styles.alertText}>
          Ce récapitulatif est fourni à titre indicatif. Les montants définitifs seront confirmés 
          après validation de votre dossier par l'administration. En confirmant, vous acceptez de 
          procéder au paiement de ces frais.
        </p>
      </div>

      {/* Boutons d'action */}
      <div className={styles.actions}>
        <div className={styles.leftActions}>
          <button className={styles.btnSecondary} onClick={onBack}>
            <ArrowLeft size={18} />
            Retour
          </button>
          <button className={styles.btnDownload} onClick={handleDownloadPDF}>
            <Download size={18} />
            Télécharger la facture
          </button>
        </div>
        <div className={styles.rightActions}>
          <button className={styles.btnCard} onClick={handlePayerParCarte}>
            <CreditCard size={18} />
            Payer par carte Adahabia
          </button>
          <button className={styles.btnPrimary} onClick={onNext}>
            Confirmer et passer au paiement
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
