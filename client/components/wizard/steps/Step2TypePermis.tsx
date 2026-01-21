import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Clock, Maximize2 } from "lucide-react";


interface Step2TypePermisProps {
  data?: any;
  onUpdate: (data: any) => void;
}

export const Step2TypePermis = ({ data, onUpdate }: Step2TypePermisProps) => {
  const [selectedType, setSelectedType] = useState(data?.id || "");
  
  const typesPermis = [
    {
      id: "1",
      lib_type: "Permis de prospection",
      code_type: "PPM",
      regime: "Mines",
      duree_initiale: 2,
      superficie_max: 5000,
      description: "Permet la recherche de substances minérales sur une zone définie",
    },
    {
      id: "2",
      lib_type: "Permis d'exploration",
      code_type: "PEM",
      regime: "Mines",
      duree_initiale: 3,
      superficie_max: 500,
      description: "Permet d'effectuer des travaux d'exploration détaillés",
    },
    {
      id: "3",
      lib_type: "Permis d'exploitation",
      code_type: "PXM",
      regime: "Mines",
      duree_initiale: 25,
      superficie_max: 100,
      description: "Autorise l'extraction et l'exploitation de substances minérales",
    },
    {
      id: "4",
      lib_type: "Permis d'exploitation de carrière",
      code_type: "PXC",
      regime: "Carrières",
      duree_initiale: 10,
      superficie_max: 50,
      description: "Permet l'exploitation de matériaux de carrière",
    },
  ];

  const typePermis = typesPermis.find(t => t.id === selectedType);

  useEffect(() => {
    if (selectedType) {
      onUpdate({ typePermis: typesPermis.find(t => t.id === selectedType) });
    }
  }, [selectedType]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Label htmlFor="typePermis">Type de permis demandé *</Label>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger id="typePermis">
            <SelectValue placeholder="Choisir un type de permis" />
          </SelectTrigger>
          <SelectContent>
            {typesPermis.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.lib_type} ({t.code_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {typePermis && (
        <Card className="border-l-4 border-l-secondary animate-scale-in">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-secondary/10 rounded-lg">
              <Info className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-secondary mb-1">À propos de ce permis</p>
                <p className="text-sm text-muted-foreground">{typePermis.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Durée initiale
                </p>
                <p className="text-2xl font-bold text-foreground">{typePermis.duree_initiale} ans</p>
              </div>
              
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Maximize2 className="w-4 h-4" />
                  Superficie max
                </p>
                <p className="text-2xl font-bold text-foreground">{typePermis.superficie_max} ha</p>
              </div>
              
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Régime juridique</p>
                <p className="text-2xl font-bold text-foreground">{typePermis.regime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
