export type DemandeFormData = {
  identification?: {
    nomEntreprise?: string;
    nomSocieteFr?: string;
    formeJuridique?: string;
    registreCommerce?: string;
    nif?: string;
    representantNom?: string;
    representantPrenom?: string;
    representantEmail?: string;
  };
  typePermis?: {
    lib_type?: string;
    code_type?: string;
    regime?: string;
    duree_initiale?: number;
    selectedType?: string;
  };
  localisation?: {
    lieuDitFR?: string;
    superficie?: number;
  };
  capacites?: {
    capitalSocial?: number;
    nombreEmployes?: number;
  };
  localisationSubstances?: {
    substancePrincipale?: string;
    substancesSecondaires?: string[];
    substances?: string[];
    societe?: string;
  };
  coordonneesCadastrales?: {
    superficie?: number;
  };
  documents?: Array<{
    status?: string;
  }>;
  paiement?: {
    montant?: number;
    effectue?: boolean;
  };
};
