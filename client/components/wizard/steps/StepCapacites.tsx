import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, TrendingUp, UserCheck } from "lucide-react";

interface StepCapacitesProps {
  data?: any;
  onUpdate: (data: any) => void;
}

// Liste d'experts prédéfinis
const expertsDisponibles = [
  {
    id: "expert1",
    nomComplet: "CHERIET Mohamed Faouzi",
    specialisation: "Géologue senior",
    numeroAgrement: "AGR-2024-001",
    etatAgrement: "valide",
    numeroEnregistrement: "ENR-2024-001",
    organisme: "Institut National de Géologie"
  },
  {
    id: "expert2",
    nomComplet: "BENALI Sarah",
    specialisation: "Ingénieur minier",
    numeroAgrement: "AGR-2024-002",
    etatAgrement: "valide",
    numeroEnregistrement: "ENR-2024-002",
    organisme: "Centre National des Mines"
  },
  {
    id: "expert3",
    nomComplet: "KADDOUR Rachid",
    specialisation: "Géophysicien",
    numeroAgrement: "AGR-2024-003",
    etatAgrement: "en_cours",
    numeroEnregistrement: "ENR-2024-003",
    organisme: "Bureau d'Études Minières"
  }
];

export const StepCapacites = ({ data, onUpdate }: StepCapacitesProps) => {
  const [capacites, setCapacites] = useState({
    // Capacités Techniques
    dureeEstimee: data?.dureeEstimee || "",
    capitalSocialDisponible: data?.capitalSocialDisponible || "",
    budgetPrevu: data?.budgetPrevu || "",
    dateDebutPrevue: data?.dateDebutPrevue || "",
    
    // Capacités Financières
    sourcesFinancement: data?.sourcesFinancement || "",
    chiffreAffaires: data?.chiffreAffaires || "",
    
    // Expert Minier
    expertSelectionne: data?.expertSelectionne || "",
    expertNomComplet: data?.expertNomComplet || "",
    expertSpecialisation: data?.expertSpecialisation || "",
    expertNumeroAgrement: data?.expertNumeroAgrement || "",
    expertNumeroEnregistrement: data?.expertNumeroEnregistrement || "",
    expertEtatAgrement: data?.expertEtatAgrement || "",
    expertOrganisme: data?.expertOrganisme || "",
  });

  useEffect(() => {
    onUpdate({ capacites });
  }, [capacites]);

  const handleChange = (field: string, value: string) => {
    setCapacites(prev => ({ ...prev, [field]: value }));
  };

  const handleExpertSelection = (expertId: string) => {
    const expert = expertsDisponibles.find(e => e.id === expertId);
    if (expert) {
      setCapacites(prev => ({
        ...prev,
        expertSelectionne: expertId,
        expertNomComplet: expert.nomComplet,
        expertSpecialisation: expert.specialisation,
        expertNumeroAgrement: expert.numeroAgrement,
        expertEtatAgrement: expert.etatAgrement,
        expertNumeroEnregistrement: expert.numeroEnregistrement,
        expertOrganisme: expert.organisme
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Capacités Techniques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Capacités Techniques
          </CardTitle>
          <CardDescription>
            Détails techniques du projet minier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dureeEstimee">Durée estimée des travaux (mois) *</Label>
              <Input
                id="dureeEstimee"
                type="number"
                value={capacites.dureeEstimee}
                onChange={(e) => handleChange("dureeEstimee", e.target.value)}
                placeholder="Ex: 24"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capitalSocialDisponible">Capital social disponible (DZD) *</Label>
              <Input
                id="capitalSocialDisponible"
                type="number"
                value={capacites.capitalSocialDisponible}
                onChange={(e) => handleChange("capitalSocialDisponible", e.target.value)}
                placeholder="Ex: 50000000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budgetPrevu">Budget prévu (DZD) *</Label>
              <Input
                id="budgetPrevu"
                type="number"
                value={capacites.budgetPrevu}
                onChange={(e) => handleChange("budgetPrevu", e.target.value)}
                placeholder="Ex: 100000000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateDebutPrevue">Date de Début Prévue *</Label>
              <Input
                id="dateDebutPrevue"
                type="date"
                value={capacites.dateDebutPrevue}
                onChange={(e) => handleChange("dateDebutPrevue", e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capacités Financières */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Capacités Financières
          </CardTitle>
          <CardDescription>
            Sources de financement et chiffre d'affaires
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sourcesFinancement">Sources de financement *</Label>
            <Textarea
              id="sourcesFinancement"
              value={capacites.sourcesFinancement}
              onChange={(e) => handleChange("sourcesFinancement", e.target.value)}
              placeholder="Décrivez les sources de financement du projet"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chiffreAffaires">Chiffre d'Affaires Annuel (DZD) *</Label>
            <Input
              id="chiffreAffaires"
              type="number"
              value={capacites.chiffreAffaires}
              onChange={(e) => handleChange("chiffreAffaires", e.target.value)}
              placeholder="Ex: 150000000"
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Expert Minier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Expert Minier
          </CardTitle>
          <CardDescription>
            Informations sur l'expert minier assigné au projet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expertSelectionne">Sélectionner un expert</Label>
            <Select
              value={capacites.expertSelectionne}
              onValueChange={handleExpertSelection}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un expert..." />
              </SelectTrigger>
              <SelectContent>
                {expertsDisponibles.map((expert) => (
                  <SelectItem key={expert.id} value={expert.id}>
                    {expert.nomComplet} - {expert.specialisation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expertNomComplet">Nom complet *</Label>
              <Input
                id="expertNomComplet"
                value={capacites.expertNomComplet}
                onChange={(e) => handleChange("expertNomComplet", e.target.value)}
                placeholder="ex: CHERIET Mohamed Faouzi"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expertSpecialisation">Spécialisation *</Label>
              <Input
                id="expertSpecialisation"
                value={capacites.expertSpecialisation}
                onChange={(e) => handleChange("expertSpecialisation", e.target.value)}
                placeholder="Ex: Géologue senior"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expertNumeroAgrement">Numéro d'agrément</Label>
              <Input
                id="expertNumeroAgrement"
                value={capacites.expertNumeroAgrement}
                onChange={(e) => handleChange("expertNumeroAgrement", e.target.value)}
                placeholder="Numéro d'agrément"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expertNumeroEnregistrement">Numéro d'enregistrement</Label>
              <Input
                id="expertNumeroEnregistrement"
                value={capacites.expertNumeroEnregistrement}
                onChange={(e) => handleChange("expertNumeroEnregistrement", e.target.value)}
                placeholder="Numéro d'enregistrement"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expertEtatAgrement">État d'agrément *</Label>
              <Select
                value={capacites.expertEtatAgrement}
                onValueChange={(value) => handleChange("expertEtatAgrement", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'état" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valide">Valide</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="expire">Expiré</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expertOrganisme">Organisme d'affiliation</Label>
              <Input
                id="expertOrganisme"
                value={capacites.expertOrganisme}
                onChange={(e) => handleChange("expertOrganisme", e.target.value)}
                placeholder="Organisme d'affiliation"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
