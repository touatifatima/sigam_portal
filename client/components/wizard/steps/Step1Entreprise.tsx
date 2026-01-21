import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, FileText, Hash } from "lucide-react";

interface Step1EntrepriseProps {
  data?: any;
  onUpdate: (data: any) => void;
}

export const Step1Entreprise = ({ data, onUpdate }: Step1EntrepriseProps) => {
  const [selectedEntreprise, setSelectedEntreprise] = useState(data?.id || "");
  
  // Mock data - à remplacer par les vraies données
  const entreprises = [
    {
      id: "1",
      nom: "SARL Mines du Sud",
      rc: "RC-2023-0001",
      nif: "001234567890",
      representant: "Ahmed Benali",
    },
    {
      id: "2",
      nom: "SPA Carrières Algériennes",
      rc: "RC-2022-0156",
      nif: "001987654321",
      representant: "Fatima Zohra",
    },
  ];

  const entreprise = entreprises.find(e => e.id === selectedEntreprise);

  useEffect(() => {
    if (selectedEntreprise) {
      onUpdate({ entreprise: entreprises.find(e => e.id === selectedEntreprise) });
    }
  }, [selectedEntreprise]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Label htmlFor="entreprise">Sélectionnez votre entreprise *</Label>
        <Select value={selectedEntreprise} onValueChange={setSelectedEntreprise}>
          <SelectTrigger id="entreprise">
            <SelectValue placeholder="Choisir une entreprise" />
          </SelectTrigger>
          <SelectContent>
            {entreprises.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entreprise && (
        <Card className="border-l-4 border-l-primary animate-scale-in">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Informations de l'entreprise
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Registre de commerce
                </p>
                <p className="font-medium">{entreprise.rc}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  NIF
                </p>
                <p className="font-medium">{entreprise.nif}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Représentant légal</p>
                <p className="font-medium">{entreprise.representant}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
