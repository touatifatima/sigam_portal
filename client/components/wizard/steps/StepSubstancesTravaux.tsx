import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Gem, Pickaxe, FileText } from "lucide-react";

interface StepSubstancesTravauxProps {
  data?: any;
  onUpdate: (data: any) => void;
}

const substancesDisponibles = [
  { id: "or", label: "Or" },
  { id: "argent", label: "Argent" },
  { id: "cuivre", label: "Cuivre" },
  { id: "zinc", label: "Zinc" },
  { id: "plomb", label: "Plomb" },
  { id: "fer", label: "Fer" },
  { id: "phosphate", label: "Phosphate" },
  { id: "barytine", label: "Barytine" },
  { id: "bentonite", label: "Bentonite" },
  { id: "gypse", label: "Gypse" },
  { id: "marbre", label: "Marbre" },
  { id: "granite", label: "Granite" },
  { id: "autre", label: "Autre" },
];

export const StepSubstancesTravaux = ({ data, onUpdate }: StepSubstancesTravauxProps) => {
  const [substancesTravaux, setSubstancesTravaux] = useState({
    substancesVisees: data?.substancesVisees || [],
    autresSubstances: data?.autresSubstances || "",
    programmeTravaux: data?.programmeTravaux || "",
    methodesProspection: data?.methodesProspection || "",
    dureeEstimee: data?.dureeEstimee || "",
    budgetEstime: data?.budgetEstime || "",
    impactEnvironnemental: data?.impactEnvironnemental || "",
  });

  useEffect(() => {
    onUpdate({ substancesTravaux });
  }, [substancesTravaux]);

  const handleSubstanceToggle = (substanceId: string) => {
    setSubstancesTravaux(prev => {
      const substancesVisees = prev.substancesVisees.includes(substanceId)
        ? prev.substancesVisees.filter((id: string) => id !== substanceId)
        : [...prev.substancesVisees, substanceId];
      return { ...prev, substancesVisees };
    });
  };

  const handleChange = (field: string, value: string) => {
    setSubstancesTravaux(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Substances Visées */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-primary" />
            Substances Minérales Visées
          </CardTitle>
          <CardDescription>
            Sélectionnez les substances que vous souhaitez exploiter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {substancesDisponibles.map((substance) => (
              <div key={substance.id} className="flex items-center space-x-2">
                <Checkbox
                  id={substance.id}
                  checked={substancesTravaux.substancesVisees.includes(substance.id)}
                  onCheckedChange={() => handleSubstanceToggle(substance.id)}
                />
                <Label
                  htmlFor={substance.id}
                  className="text-sm font-normal cursor-pointer"
                >
                  {substance.label}
                </Label>
              </div>
            ))}
          </div>

          {substancesTravaux.substancesVisees.includes("autre") && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="autresSubstances">Précisez les autres substances</Label>
              <Textarea
                id="autresSubstances"
                value={substancesTravaux.autresSubstances}
                onChange={(e) => handleChange("autresSubstances", e.target.value)}
                placeholder="Listez les autres substances minérales visées"
                rows={2}
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap pt-2">
            {substancesTravaux.substancesVisees.map((id: string) => {
              const substance = substancesDisponibles.find(s => s.id === id);
              return substance ? (
                <Badge key={id} variant="secondary">
                  {substance.label}
                </Badge>
              ) : null;
            })}
          </div>
        </CardContent>
      </Card>

      {/* Programme de Travaux */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pickaxe className="w-5 h-5 text-primary" />
            Programme de Travaux
          </CardTitle>
          <CardDescription>
            Détails des opérations de prospection/exploration prévues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="programmeTravaux">
              Description du Programme de Travaux
            </Label>
            <Textarea
              id="programmeTravaux"
              value={substancesTravaux.programmeTravaux}
              onChange={(e) => handleChange("programmeTravaux", e.target.value)}
              placeholder="Décrivez les travaux de prospection ou d'exploration prévus: levés géologiques, géophysiques, sondages, etc."
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="methodesProspection">
              Méthodes et Techniques
            </Label>
            <Textarea
              id="methodesProspection"
              value={substancesTravaux.methodesProspection}
              onChange={(e) => handleChange("methodesProspection", e.target.value)}
              placeholder="Détaillez les méthodes: géochimie, géophysique aéroportée, sondages carottés, etc."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dureeEstimee">Durée Estimée (mois)</Label>
              <Textarea
                id="dureeEstimee"
                value={substancesTravaux.dureeEstimee}
                onChange={(e) => handleChange("dureeEstimee", e.target.value)}
                placeholder="Ex: 18 mois"
                rows={1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budgetEstime">Budget Estimé (DZD)</Label>
              <Textarea
                id="budgetEstime"
                value={substancesTravaux.budgetEstime}
                onChange={(e) => handleChange("budgetEstime", e.target.value)}
                placeholder="Ex: 500,000,000 DZD"
                rows={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Impact Environnemental */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Considérations Environnementales
          </CardTitle>
          <CardDescription>
            Mesures de protection de l'environnement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="impactEnvironnemental">
              Évaluation de l'Impact Environnemental
            </Label>
            <Textarea
              id="impactEnvironnemental"
              value={substancesTravaux.impactEnvironnemental}
              onChange={(e) => handleChange("impactEnvironnemental", e.target.value)}
              placeholder="Décrivez les mesures de protection environnementale: gestion des déchets, restauration des sites, protection des eaux, etc."
              rows={5}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
        <Badge variant="outline" className="mt-0.5">
          Important
        </Badge>
        <p className="text-sm text-muted-foreground">
          Le programme de travaux doit être conforme aux normes techniques et environnementales 
          en vigueur. Une étude d'impact environnemental peut être requise selon l'ampleur du projet.
        </p>
      </div>
    </div>
  );
};
