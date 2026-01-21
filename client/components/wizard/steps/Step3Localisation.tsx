import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step3LocalisationProps {
  data?: any;
  onUpdate: (data: any) => void;
}

export const Step3Localisation = ({ data, onUpdate }: Step3LocalisationProps) => {
  const [formData, setFormData] = useState({
    wilaya: data?.wilaya || "",
    daira: data?.daira || "",
    commune: data?.commune || "",
    lieuDitFR: data?.lieuDitFR || "",
    lieuDitAR: data?.lieuDitAR || "",
    superficie: data?.superficie || "",
    coordX: data?.coordX || "",
    coordY: data?.coordY || "",
  });

  // Mock data
  const wilayas = [
    { id: "1", nom: "Tlemcen" },
    { id: "2", nom: "Oran" },
    { id: "3", nom: "Bechar" },
  ];

  const dairas = [
    { id: "1", nom: "Tlemcen", wilayaId: "1" },
    { id: "2", nom: "Maghnia", wilayaId: "1" },
    { id: "3", nom: "Oran", wilayaId: "2" },
  ];

  const communes = [
    { id: "1", nom: "Tlemcen", dairaId: "1" },
    { id: "2", nom: "Chetouane", dairaId: "1" },
    { id: "3", nom: "Maghnia", dairaId: "2" },
  ];

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    onUpdate({ localisation: formData });
  }, [formData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="wilaya">Wilaya *</Label>
          <Select value={formData.wilaya} onValueChange={(v) => handleChange("wilaya", v)}>
            <SelectTrigger id="wilaya">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {wilayas.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="daira">Daira *</Label>
          <Select value={formData.daira} onValueChange={(v) => handleChange("daira", v)} disabled={!formData.wilaya}>
            <SelectTrigger id="daira">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {dairas.filter(d => d.wilayaId === formData.wilaya).map(d => (
                <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="commune">Commune *</Label>
          <Select value={formData.commune} onValueChange={(v) => handleChange("commune", v)} disabled={!formData.daira}>
            <SelectTrigger id="commune">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              {communes.filter(c => c.dairaId === formData.daira).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lieuDitFR">Lieu-dit (FR) *</Label>
          <Input
            id="lieuDitFR"
            value={formData.lieuDitFR}
            onChange={(e) => handleChange("lieuDitFR", e.target.value)}
            placeholder="Ex: Oued Zitoun"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lieuDitAR">Lieu-dit (AR)</Label>
          <Input
            id="lieuDitAR"
            value={formData.lieuDitAR}
            onChange={(e) => handleChange("lieuDitAR", e.target.value)}
            placeholder="المكان"
            dir="rtl"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="superficie">Superficie déclarée (ha) *</Label>
        <Input
          id="superficie"
          type="number"
          value={formData.superficie}
          onChange={(e) => handleChange("superficie", e.target.value)}
          placeholder="Ex: 150"
        />
      </div>

      <Card className="border-l-4 border-l-mining-teal">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-mining-teal" />
            <h3 className="font-semibold">Coordonnées géographiques</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coordX">Coordonnée X (Longitude)</Label>
              <Input
                id="coordX"
                type="number"
                step="0.000001"
                value={formData.coordX}
                onChange={(e) => handleChange("coordX", e.target.value)}
                placeholder="Ex: -1.315"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coordY">Coordonnée Y (Latitude)</Label>
              <Input
                id="coordY"
                type="number"
                step="0.000001"
                value={formData.coordY}
                onChange={(e) => handleChange("coordY", e.target.value)}
                placeholder="Ex: 34.890"
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Vous pouvez également tracer la zone sur la carte
              </span>
            </div>
            <Button variant="outline" size="sm">
              Ouvrir la carte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
