import { useEffect, useState } from "react";  //uuutilisablee
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, User, FileText, Users, Plus, X, AlertCircle } from "lucide-react";
import styles from "./StepIdentification.module.css";

type StatutJuridique = {
  id_statutJuridique: number;
  code_statut: string;
  statut_fr: string;
  statut_ar: string;
};

type Pays = {
  id_pays: number;
  nom_pays: string;
  nationalite: string;
};

type Nationalite = {
  id_nationalite: number;
  libelle: string;
};

interface Actionnaire {
  id: string;
  nom: string;
  prenom: string;
  lieuNaissance: string;
  nationalite: string;
  qualification: string;
  numeroIdentite: string;
  tauxParticipation: string;
  pays: string;
}

interface StepIdentificationProps {
  data?: any;
  onUpdate: (data: any) => void;
}

export const StepIdentification = ({ data, onUpdate }: StepIdentificationProps) => {
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [identification, setIdentification] = useState({
    // Informations entreprise
    nomSocieteFr: data?.nomSocieteFr || "",
    nomSocieteAr: data?.nomSocieteAr || "",
    statutJuridique: data?.statutJuridique || "",
    pays: data?.pays || "",
    telephone: data?.telephone || "",
    email: data?.email || "",
    siteWeb: data?.siteWeb || data?.site_web || "",
    numeroFax: data?.numeroFax || "",
    adresseComplete: data?.adresseComplete || "",
    nationalite: data?.nationalite || "",
    dateConstitution: data?.dateConstitution || data?.date_constitution || "",

    // Representant legal
    representantNomFr: data?.representantNomFr || "",
    representantPrenomFr: data?.representantPrenomFr || "",
    representantNomAr: data?.representantNomAr || "",
    representantPrenomAr: data?.representantPrenomAr || "",
    representantTelephone: data?.representantTelephone || "",
    representantEmail: data?.representantEmail || "",
    representantFax: data?.representantFax || "",
    representantQualite: data?.representantQualite || "",
    representantNationalite: data?.representantNationalite || "",
    representantPays: data?.representantPays || "",
    representantNIN: data?.representantNIN || "",
    representantTauxParticipation: data?.representantTauxParticipation || "",

    // Registre de Commerce
    numeroRC: data?.numeroRC || "",
    dateEnregistrement: data?.dateEnregistrement || "",
    capitalSocial: data?.capitalSocial || "",
    numeroNIS: data?.numeroNIS || "",
    adresseSiege: data?.adresseSiege || "",
    numeroNIF: data?.numeroNIF || "",
  });

  const [actionnaires, setActionnaires] = useState<Actionnaire[]>(data?.actionnaires || []);
  const [statutsJuridiques, setStatutsJuridiques] = useState<StatutJuridique[]>([]);
  const [paysOptions, setPaysOptions] = useState<Pays[]>([]);
  const [nationalitesOptions, setNationalitesOptions] = useState<Nationalite[]>([]);

  useEffect(() => {
    onUpdate({ identification: { ...identification, actionnaires } });
  }, [identification, actionnaires, onUpdate]);

  useEffect(() => {
    if (!apiURL) return;
    let mounted = true;

    const fetchOptions = async () => {
      try {
        const [paysRes, statutsRes, natRes] = await Promise.all([
          axios.get<Pays[]>(`${apiURL}/statuts-juridiques/pays`),
          axios.get<StatutJuridique[]>(`${apiURL}/api/statuts-juridiques`),
          axios.get<Nationalite[]>(`${apiURL}/statuts-juridiques/nationalites`),
        ]);

        if (!mounted) return;
        setPaysOptions(paysRes.data || []);
        setStatutsJuridiques(statutsRes.data || []);
        setNationalitesOptions(natRes.data || []);
      } catch (error) {
        console.error("Erreur chargement options identification:", error);
      }
    };

    fetchOptions();
    return () => {
      mounted = false;
    };
  }, [apiURL]);

  const handleChange = (field: string, value: string) => {
    setIdentification((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddActionnaire = () => {
    const newActionnaire: Actionnaire = {
      id: Date.now().toString(),
      nom: "",
      prenom: "",
      lieuNaissance: "",
      nationalite: "",
      qualification: "",
      numeroIdentite: "",
      tauxParticipation: "",
      pays: "",
    };
    setActionnaires([...actionnaires, newActionnaire]);
  };

  const handleRemoveActionnaire = (id: string) => {
    setActionnaires(actionnaires.filter((a) => a.id !== id));
  };

  const handleActionnaireChange = (id: string, field: keyof Actionnaire, value: string) => {
    setActionnaires(actionnaires.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const qualitesRepresentant = ["Gerant", "Directeur General", "President Directeur General", "Directeur"];

  const calculateTotalParticipation = () => {
    const representantTaux = parseFloat(identification.representantTauxParticipation) || 0;
    const actionnairesTaux = actionnaires.reduce((sum, actionnaire) => {
      return sum + (parseFloat(actionnaire.tauxParticipation) || 0);
    }, 0);
    return representantTaux + actionnairesTaux;
  };

  const totalParticipation = calculateTotalParticipation();
  const isParticipationValid = totalParticipation === 100;

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>
            <Building2 className={styles.cardIcon} />
            Informations sur l'Entreprise
          </CardTitle>
          <CardDescription className={styles.cardDescription}>
            Renseignements generaux de la societe
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <Label htmlFor="nomSocieteFr" className={styles.label}>Nom societe (FR) *</Label>
              <Input
                id="nomSocieteFr"
                value={identification.nomSocieteFr}
                onChange={(e) => handleChange("nomSocieteFr", e.target.value)}
                placeholder="Nom de la societe en francais"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="nomSocieteAr" className={styles.label}>Nom societe (AR)</Label>
              <Input
                id="nomSocieteAr"
                value={identification.nomSocieteAr}
                onChange={(e) => handleChange("nomSocieteAr", e.target.value)}
                placeholder="Nom societe en arabe"
                dir="rtl"
                className={`${styles.input} ${styles.inputRtl}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="statutJuridique" className={styles.label}>Statut juridique *</Label>
              <Select
                value={identification.statutJuridique || undefined}
                onValueChange={(value) => handleChange("statutJuridique", value)}
              >
                <SelectTrigger id="statutJuridique" className={styles.select}>
                  <SelectValue
                    className={styles.selectValue}
                    placeholder="Selectionner"
                  />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {statutsJuridiques.map((statut) => {
                    const value = statut.code_statut || statut.statut_fr;
                    const label = statut.code_statut
                      ? `${statut.code_statut} - ${statut.statut_fr}`
                      : statut.statut_fr;
                    return (
                      <SelectItem
                        key={statut.id_statutJuridique}
                        value={value}
                        className={styles.selectItem}
                      >
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="pays" className={styles.label}>Pays *</Label>
              <Select
                value={identification.pays || undefined}
                onValueChange={(value) => handleChange("pays", value)}
              >
                <SelectTrigger id="pays" className={styles.select}>
                  <SelectValue className={styles.selectValue} placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {paysOptions.map((p) => (
                    <SelectItem
                      key={p.id_pays}
                      value={p.nom_pays}
                      className={styles.selectItem}
                    >
                      {p.nom_pays}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="telephone" className={styles.label}>Telephone *</Label>
              <Input
                id="telephone"
                type="tel"
                value={identification.telephone}
                onChange={(e) => handleChange("telephone", e.target.value)}
                placeholder="+213 XXX XX XX XX"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="email" className={styles.label}>Email *</Label>
              <Input
                id="email"
                type="email"
                value={identification.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="contact@entreprise.com"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="siteWeb" className={styles.label}>Site web</Label>
              <Input
                id="siteWeb"
                type="url"
                value={identification.siteWeb}
                onChange={(e) => handleChange("siteWeb", e.target.value)}
                placeholder="www.entreprise.com"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="numeroFax" className={styles.label}>Numero de fax</Label>
              <Input
                id="numeroFax"
                value={identification.numeroFax}
                onChange={(e) => handleChange("numeroFax", e.target.value)}
                placeholder="+213 XXX XX XX XX"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="nationalite" className={styles.label}>Nationalite *</Label>
              <Select
                value={identification.nationalite || undefined}
                onValueChange={(value) => handleChange("nationalite", value)}
              >
                <SelectTrigger id="nationalite" className={styles.select}>
                  <SelectValue className={styles.selectValue} placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {nationalitesOptions.map((nat) => (
                    <SelectItem
                      key={nat.id_nationalite}
                      value={nat.libelle}
                      className={styles.selectItem}
                    >
                      {nat.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="dateConstitution" className={styles.label}>Date de constitution</Label>
              <Input
                id="dateConstitution"
                type="date"
                value={identification.dateConstitution}
                onChange={(e) => handleChange("dateConstitution", e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <Label htmlFor="adresseComplete" className={styles.label}>Adresse complete *</Label>
              <Input
                id="adresseComplete"
                value={identification.adresseComplete}
                onChange={(e) => handleChange("adresseComplete", e.target.value)}
                placeholder="Adresse complete de l'entreprise"
                className={styles.input}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>
            <User className={styles.cardIcon} />
            Representant Legal
          </CardTitle>
          <CardDescription className={styles.cardDescription}>
            Personne habilitee a representer l'entreprise
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <Label htmlFor="representantNomFr" className={styles.label}>Nom (FR) *</Label>
              <Input
                id="representantNomFr"
                value={identification.representantNomFr}
                onChange={(e) => handleChange("representantNomFr", e.target.value)}
                placeholder="Nom en francais"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantPrenomFr" className={styles.label}>Prenom (FR) *</Label>
              <Input
                id="representantPrenomFr"
                value={identification.representantPrenomFr}
                onChange={(e) => handleChange("representantPrenomFr", e.target.value)}
                placeholder="Prenom en francais"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantNomAr" className={styles.label}>Nom (AR)</Label>
              <Input
                id="representantNomAr"
                value={identification.representantNomAr}
                onChange={(e) => handleChange("representantNomAr", e.target.value)}
                placeholder="Nom en arabe"
                dir="rtl"
                className={`${styles.input} ${styles.inputRtl}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantPrenomAr" className={styles.label}>Prenom (AR)</Label>
              <Input
                id="representantPrenomAr"
                value={identification.representantPrenomAr}
                onChange={(e) => handleChange("representantPrenomAr", e.target.value)}
                placeholder="Prenom en arabe"
                dir="rtl"
                className={`${styles.input} ${styles.inputRtl}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantTelephone" className={styles.label}>Telephone *</Label>
              <Input
                id="representantTelephone"
                type="tel"
                value={identification.representantTelephone}
                onChange={(e) => handleChange("representantTelephone", e.target.value)}
                placeholder="+213 XXX XX XX XX"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantEmail" className={styles.label}>Email *</Label>
              <Input
                id="representantEmail"
                type="email"
                value={identification.representantEmail}
                onChange={(e) => handleChange("representantEmail", e.target.value)}
                placeholder="representant@email.com"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantFax" className={styles.label}>Numero de fax</Label>
              <Input
                id="representantFax"
                value={identification.representantFax}
                onChange={(e) => handleChange("representantFax", e.target.value)}
                placeholder="+213 XXX XX XX XX"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantQualite" className={styles.label}>Qualite de representant *</Label>
              <Select
                value={identification.representantQualite || undefined}
                onValueChange={(value) => handleChange("representantQualite", value)}
              >
                <SelectTrigger id="representantQualite" className={styles.select}>
                  <SelectValue className={styles.selectValue} placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {qualitesRepresentant.map((qualite) => (
                    <SelectItem
                      key={qualite}
                      value={qualite}
                      className={styles.selectItem}
                    >
                      {qualite}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantNationalite" className={styles.label}>Nationalite *</Label>
              <Select
                value={identification.representantNationalite || undefined}
                onValueChange={(value) => handleChange("representantNationalite", value)}
              >
                <SelectTrigger id="representantNationalite" className={styles.select}>
                  <SelectValue className={styles.selectValue} placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {nationalitesOptions.map((nat) => (
                    <SelectItem
                      key={nat.id_nationalite}
                      value={nat.libelle}
                      className={styles.selectItem}
                    >
                      {nat.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantPays" className={styles.label}>Pays *</Label>
              <Select
                value={identification.representantPays || undefined}
                onValueChange={(value) => handleChange("representantPays", value)}
              >
                <SelectTrigger id="representantPays" className={styles.select}>
                  <SelectValue className={styles.selectValue} placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {paysOptions.map((p) => (
                    <SelectItem
                      key={p.id_pays}
                      value={p.nom_pays}
                      className={styles.selectItem}
                    >
                      {p.nom_pays}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantNIN" className={styles.label}>Numero NIN *</Label>
              <Input
                id="representantNIN"
                value={identification.representantNIN}
                onChange={(e) => handleChange("representantNIN", e.target.value)}
                placeholder="Numero d'identification nationale"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="representantTauxParticipation" className={styles.label}>Taux de participation (%)</Label>
              <Input
                id="representantTauxParticipation"
                type="number"
                min="0"
                max="100"
                value={identification.representantTauxParticipation}
                onChange={(e) => handleChange("representantTauxParticipation", e.target.value)}
                placeholder="0"
                className={styles.input}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle className={styles.cardTitle}>
            <FileText className={styles.cardIcon} />
            Details du Registre de Commerce
          </CardTitle>
          <CardDescription className={styles.cardDescription}>
            Informations legales et fiscales
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <Label htmlFor="numeroRC" className={styles.label}>Numero RC *</Label>
              <Input
                id="numeroRC"
                value={identification.numeroRC}
                onChange={(e) => handleChange("numeroRC", e.target.value)}
                placeholder="Ex: 00B123456789"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="dateEnregistrement" className={styles.label}>Date d'enregistrement *</Label>
              <Input
                id="dateEnregistrement"
                type="date"
                value={identification.dateEnregistrement}
                onChange={(e) => handleChange("dateEnregistrement", e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="capitalSocial" className={styles.label}>Capital social (DA) *</Label>
              <Input
                id="capitalSocial"
                type="number"
                value={identification.capitalSocial}
                onChange={(e) => handleChange("capitalSocial", e.target.value)}
                placeholder="Ex: 1000000"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="numeroNIS" className={styles.label}>Numero NIS *</Label>
              <Input
                id="numeroNIS"
                value={identification.numeroNIS}
                onChange={(e) => handleChange("numeroNIS", e.target.value)}
                placeholder="Numero d'identification statistique"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <Label htmlFor="numeroNIF" className={styles.label}>Numero NIF *</Label>
              <Input
                id="numeroNIF"
                value={identification.numeroNIF}
                onChange={(e) => handleChange("numeroNIF", e.target.value)}
                placeholder="Numero d'identification fiscale"
                className={styles.input}
              />
            </div>

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <Label htmlFor="adresseSiege" className={styles.label}>Adresse du siege *</Label>
              <Input
                id="adresseSiege"
                value={identification.adresseSiege}
                onChange={(e) => handleChange("adresseSiege", e.target.value)}
                placeholder="Adresse complete du siege social"
                className={styles.input}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <div className={styles.actionnairesHeader}>
            <div>
              <CardTitle className={styles.cardTitle}>
                <Users className={styles.cardIcon} />
                Actionnaires
              </CardTitle>
              <CardDescription className={styles.cardDescription}>
                Liste des actionnaires de la societe
              </CardDescription>
            </div>
            <button type="button" className={styles.btnAddActionnaire} onClick={handleAddActionnaire}>
              <Plus className={styles.btnAddIcon} />
              Ajouter
            </button>
          </div>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {actionnaires.length === 0 ? (
            <div className={styles.emptyState}>
              <Users className={styles.emptyIcon} />
              <p className={styles.emptyText}>Aucun actionnaire ajoute.</p>
              <p className={styles.emptyHint}>Cliquez sur "Ajouter" pour en ajouter un.</p>
            </div>
          ) : (
            actionnaires.map((actionnaire, index) => (
              <div key={actionnaire.id} className={styles.actionnaireCard}>
                <div className={styles.actionnaireHeader}>
                  <h4 className={styles.actionnaireNumber}>Actionnaire {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveActionnaire(actionnaire.id)}
                    className={styles.btnRemoveActionnaire}
                  >
                    <X className={styles.btnRemoveIcon} />
                  </button>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Nom *</Label>
                    <Input
                      value={actionnaire.nom}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "nom", e.target.value)}
                      placeholder="Nom"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Prenom *</Label>
                    <Input
                      value={actionnaire.prenom}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "prenom", e.target.value)}
                      placeholder="Prenom"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Lieu de naissance *</Label>
                    <Input
                      value={actionnaire.lieuNaissance}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "lieuNaissance", e.target.value)}
                      placeholder="Lieu de naissance"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Nationalite *</Label>
                    <Select
                      value={actionnaire.nationalite || undefined}
                      onValueChange={(value) =>
                        handleActionnaireChange(actionnaire.id, "nationalite", value)
                      }
                    >
                      <SelectTrigger className={styles.select}>
                        <SelectValue
                          className={styles.selectValue}
                          placeholder="Selectionner"
                        />
                      </SelectTrigger>
                      <SelectContent className={styles.selectContent}>
                        {nationalitesOptions.map((nat) => (
                          <SelectItem
                            key={nat.id_nationalite}
                            value={nat.libelle}
                            className={styles.selectItem}
                          >
                            {nat.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Qualification</Label>
                    <Input
                      value={actionnaire.qualification}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "qualification", e.target.value)}
                      placeholder="Qualification"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Numero d'identite *</Label>
                    <Input
                      value={actionnaire.numeroIdentite}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "numeroIdentite", e.target.value)}
                      placeholder="Numero d'identite"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Taux de participation (%) *</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={actionnaire.tauxParticipation}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "tauxParticipation", e.target.value)}
                      placeholder="0"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <Label className={styles.label}>Pays *</Label>
                    <Select
                      value={actionnaire.pays || undefined}
                      onValueChange={(value) =>
                        handleActionnaireChange(actionnaire.id, "pays", value)
                      }
                    >
                      <SelectTrigger className={styles.select}>
                        <SelectValue className={styles.selectValue} placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent className={styles.selectContent}>
                        {paysOptions.map((p) => (
                          <SelectItem
                            key={p.id_pays}
                            value={p.nom_pays}
                            className={styles.selectItem}
                          >
                            {p.nom_pays}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {(identification.representantTauxParticipation || actionnaires.length > 0) && (
        <div
          className={`${styles.participationAlert} ${
            isParticipationValid ? styles.success : styles.warning
          }`}
        >
          <AlertCircle className={styles.alertIcon} />
          <div className={styles.alertContent}>
            {isParticipationValid ? (
              <>
                <div className={styles.alertTitle}>
                  Le total des taux de participation est correct (100%).
                </div>
                <div className={styles.alertDescription}>Total actuel : {totalParticipation.toFixed(2)}%</div>
              </>
            ) : (
              <>
                <div className={styles.alertTitle}>Attention !</div>
                <div className={styles.alertDescription}>
                  Le total des taux de participation du representant et des actionnaires doit etre
                  exactement 100%.
                </div>
                <div className={styles.alertDescription}>Total actuel : {totalParticipation.toFixed(2)}%</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
