import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, User, Phone, Mail, FileText, Users, Plus, X, AlertCircle } from "lucide-react";

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
  const [identification, setIdentification] = useState({
    // Informations entreprise
    nomSocieteFr: data?.nomSocieteFr || "",
    nomSocieteAr: data?.nomSocieteAr || "",
    statutJuridique: data?.statutJuridique || "",
    pays: data?.pays || "",
    telephone: data?.telephone || "",
    email: data?.email || "",
    numeroFax: data?.numeroFax || "",
    adresseComplete: data?.adresseComplete || "",
    nationalite: data?.nationalite || "",
    
    // Représentant légal
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

  useEffect(() => {
    onUpdate({ identification: { ...identification, actionnaires } });
  }, [identification, actionnaires]);

  const handleChange = (field: string, value: string) => {
    setIdentification(prev => ({ ...prev, [field]: value }));
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
    setActionnaires(actionnaires.filter(a => a.id !== id));
  };

  const handleActionnaireChange = (id: string, field: keyof Actionnaire, value: string) => {
    setActionnaires(actionnaires.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    ));
  };

  const pays = ["Algérie", "France", "Maroc", "Tunisie", "Égypte", "Arabie Saoudite", "Canada", "États-Unis"];
  const nationalites = ["Algérienne", "Française", "Marocaine", "Tunisienne", "Égyptienne", "Saoudienne", "Canadienne", "Américaine"];
  const statutsJuridiques = ["SPA", "SARL", "EURL", "SNC", "SCS"];
  const qualitesRepresentant = ["Gérant", "Directeur Général", "Président Directeur Général", "Directeur"];

  // Calcul du total des taux de participation
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
    <div className="space-y-6">
      {/* Informations Entreprise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Informations sur l'Entreprise
          </CardTitle>
          <CardDescription>
            Renseignements généraux de la société
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomSocieteFr">Nom société (FR) *</Label>
              <Input
                id="nomSocieteFr"
                value={identification.nomSocieteFr}
                onChange={(e) => handleChange("nomSocieteFr", e.target.value)}
                placeholder="Nom de la société en français"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomSocieteAr">Nom société (AR)</Label>
              <Input
                id="nomSocieteAr"
                value={identification.nomSocieteAr}
                onChange={(e) => handleChange("nomSocieteAr", e.target.value)}
                placeholder="اسم الشركة بالعربية"
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="statutJuridique">Statut juridique *</Label>
              <Select value={identification.statutJuridique} onValueChange={(value) => handleChange("statutJuridique", value)}>
                <SelectTrigger id="statutJuridique">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {statutsJuridiques.map(statut => (
                    <SelectItem key={statut} value={statut}>{statut}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pays">Pays *</Label>
              <Select value={identification.pays} onValueChange={(value) => handleChange("pays", value)}>
                <SelectTrigger id="pays">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {pays.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone *</Label>
              <Input
                id="telephone"
                type="tel"
                value={identification.telephone}
                onChange={(e) => handleChange("telephone", e.target.value)}
                placeholder="+213 XXX XX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={identification.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="contact@entreprise.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroFax">Numéro de fax</Label>
              <Input
                id="numeroFax"
                value={identification.numeroFax}
                onChange={(e) => handleChange("numeroFax", e.target.value)}
                placeholder="+213 XXX XX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationalite">Nationalité *</Label>
              <Select value={identification.nationalite} onValueChange={(value) => handleChange("nationalite", value)}>
                <SelectTrigger id="nationalite">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {nationalites.map(nat => (
                    <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="adresseComplete">Adresse complète *</Label>
              <Input
                id="adresseComplete"
                value={identification.adresseComplete}
                onChange={(e) => handleChange("adresseComplete", e.target.value)}
                placeholder="Adresse complète de l'entreprise"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Représentant Légal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Représentant Légal
          </CardTitle>
          <CardDescription>
            Personne habilitée à représenter l'entreprise
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="representantNomFr">Nom (FR) *</Label>
              <Input
                id="representantNomFr"
                value={identification.representantNomFr}
                onChange={(e) => handleChange("representantNomFr", e.target.value)}
                placeholder="Nom en français"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantPrenomFr">Prénom (FR) *</Label>
              <Input
                id="representantPrenomFr"
                value={identification.representantPrenomFr}
                onChange={(e) => handleChange("representantPrenomFr", e.target.value)}
                placeholder="Prénom en français"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantNomAr">Nom (AR)</Label>
              <Input
                id="representantNomAr"
                value={identification.representantNomAr}
                onChange={(e) => handleChange("representantNomAr", e.target.value)}
                placeholder="الاسم بالعربية"
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantPrenomAr">Prénom (AR)</Label>
              <Input
                id="representantPrenomAr"
                value={identification.representantPrenomAr}
                onChange={(e) => handleChange("representantPrenomAr", e.target.value)}
                placeholder="اللقب بالعربية"
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantTelephone">Téléphone *</Label>
              <Input
                id="representantTelephone"
                type="tel"
                value={identification.representantTelephone}
                onChange={(e) => handleChange("representantTelephone", e.target.value)}
                placeholder="+213 XXX XX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantEmail">Email *</Label>
              <Input
                id="representantEmail"
                type="email"
                value={identification.representantEmail}
                onChange={(e) => handleChange("representantEmail", e.target.value)}
                placeholder="representant@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantFax">Numéro de fax</Label>
              <Input
                id="representantFax"
                value={identification.representantFax}
                onChange={(e) => handleChange("representantFax", e.target.value)}
                placeholder="+213 XXX XX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantQualite">Qualité de représentant *</Label>
              <Select value={identification.representantQualite} onValueChange={(value) => handleChange("representantQualite", value)}>
                <SelectTrigger id="representantQualite">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {qualitesRepresentant.map(q => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantNationalite">Nationalité *</Label>
              <Select value={identification.representantNationalite} onValueChange={(value) => handleChange("representantNationalite", value)}>
                <SelectTrigger id="representantNationalite">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {nationalites.map(nat => (
                    <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantPays">Pays *</Label>
              <Select value={identification.representantPays} onValueChange={(value) => handleChange("representantPays", value)}>
                <SelectTrigger id="representantPays">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {pays.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantNIN">Numéro NIN *</Label>
              <Input
                id="representantNIN"
                value={identification.representantNIN}
                onChange={(e) => handleChange("representantNIN", e.target.value)}
                placeholder="Numéro d'identification nationale"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representantTauxParticipation">Taux de participation (%)</Label>
              <Input
                id="representantTauxParticipation"
                type="number"
                min="0"
                max="100"
                value={identification.representantTauxParticipation}
                onChange={(e) => handleChange("representantTauxParticipation", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Détails du Registre de Commerce */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Détails du Registre de Commerce
          </CardTitle>
          <CardDescription>
            Informations légales et fiscales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numeroRC">Numéro RC *</Label>
              <Input
                id="numeroRC"
                value={identification.numeroRC}
                onChange={(e) => handleChange("numeroRC", e.target.value)}
                placeholder="Ex: 00B123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateEnregistrement">Date d'enregistrement *</Label>
              <Input
                id="dateEnregistrement"
                type="date"
                value={identification.dateEnregistrement}
                onChange={(e) => handleChange("dateEnregistrement", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capitalSocial">Capital social (DA) *</Label>
              <Input
                id="capitalSocial"
                type="number"
                value={identification.capitalSocial}
                onChange={(e) => handleChange("capitalSocial", e.target.value)}
                placeholder="Ex: 1000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroNIS">Numéro NIS *</Label>
              <Input
                id="numeroNIS"
                value={identification.numeroNIS}
                onChange={(e) => handleChange("numeroNIS", e.target.value)}
                placeholder="Numéro d'identification statistique"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroNIF">Numéro NIF *</Label>
              <Input
                id="numeroNIF"
                value={identification.numeroNIF}
                onChange={(e) => handleChange("numeroNIF", e.target.value)}
                placeholder="Numéro d'identification fiscale"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="adresseSiege">Adresse du siège *</Label>
              <Input
                id="adresseSiege"
                value={identification.adresseSiege}
                onChange={(e) => handleChange("adresseSiege", e.target.value)}
                placeholder="Adresse complète du siège social"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actionnaires */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Actionnaires
              </CardTitle>
              <CardDescription>
                Liste des actionnaires de la société
              </CardDescription>
            </div>
            <Button onClick={handleAddActionnaire} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {actionnaires.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun actionnaire ajouté. Cliquez sur "Ajouter" pour en ajouter un.
            </p>
          ) : (
            actionnaires.map((actionnaire, index) => (
              <div key={actionnaire.id} className="p-4 border rounded-lg space-y-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Actionnaire {index + 1}</h4>
                  <Button
                    onClick={() => handleRemoveActionnaire(actionnaire.id)}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      value={actionnaire.nom}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "nom", e.target.value)}
                      placeholder="Nom"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      value={actionnaire.prenom}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "prenom", e.target.value)}
                      placeholder="Prénom"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Lieu de naissance *</Label>
                    <Input
                      value={actionnaire.lieuNaissance}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "lieuNaissance", e.target.value)}
                      placeholder="Lieu de naissance"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nationalité *</Label>
                    <Select 
                      value={actionnaire.nationalite} 
                      onValueChange={(value) => handleActionnaireChange(actionnaire.id, "nationalite", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {nationalites.map(nat => (
                          <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Qualification</Label>
                    <Input
                      value={actionnaire.qualification}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "qualification", e.target.value)}
                      placeholder="Qualification"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Numéro d'identité *</Label>
                    <Input
                      value={actionnaire.numeroIdentite}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "numeroIdentite", e.target.value)}
                      placeholder="Numéro d'identité"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Taux de participation (%) *</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={actionnaire.tauxParticipation}
                      onChange={(e) => handleActionnaireChange(actionnaire.id, "tauxParticipation", e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pays *</Label>
                    <Select 
                      value={actionnaire.pays} 
                      onValueChange={(value) => handleActionnaireChange(actionnaire.id, "pays", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {pays.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
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

      {/* Validation des taux de participation */}
      {(identification.representantTauxParticipation || actionnaires.length > 0) && (
        <Alert variant={isParticipationValid ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isParticipationValid ? (
              <span className="text-green-600 dark:text-green-400">
                ✓ Le total des taux de participation est correct (100%)
              </span>
            ) : (
              <span>
                <strong>Attention !</strong> Le total des taux de participation du représentant + les taux de participations des actionnaires doit être exactement 100%.
                <br />
                <span className="text-sm">Total actuel : {totalParticipation.toFixed(2)}%</span>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
