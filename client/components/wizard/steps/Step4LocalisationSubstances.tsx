import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, FileText, Navigation, Gem } from "lucide-react";

interface Step4LocalisationSubstancesProps {
  data?: any;
  onUpdate: (data: any) => void;
}

// Données mock pour les listes déroulantes
const wilayas = [
  { id: "16", name: "Alger" },
  { id: "31", name: "Oran" },
  { id: "06", name: "Béjaïa" },
  { id: "10", name: "Bouira" },
  { id: "15", name: "Tizi Ouzou" },
];

const dairas = [
  { id: "1", name: "Alger Centre", wilayaId: "16" },
  { id: "2", name: "Bab El Oued", wilayaId: "16" },
  { id: "3", name: "Oran Centre", wilayaId: "31" },
  { id: "4", name: "Béjaïa Centre", wilayaId: "06" },
];

const communes = [
  { id: "1", name: "Sidi M'Hamed", dairaId: "1" },
  { id: "2", name: "El Madania", dairaId: "1" },
  { id: "3", name: "Bab El Oued", dairaId: "2" },
  { id: "4", name: "Oran", dairaId: "3" },
];

const statutsJuridiques = [
  { id: "domaine_etat", label: "Domaine de l'État" },
  { id: "propriete_privee", label: "Propriété privée" },
  { id: "terre_arch", label: "Terre arch" },
  { id: "domaine_forestier", label: "Domaine forestier" },
  { id: "autre", label: "Autre" },
];

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
];

const zonesUTM = [
  { id: "31", label: "Zone 31N" },
  { id: "32", label: "Zone 32N" },
];

const hemispheres = [
  { id: "nord", label: "Nord" },
  { id: "sud", label: "Sud" },
];

export const Step4LocalisationSubstances = ({ data, onUpdate }: Step4LocalisationSubstancesProps) => {
  const [formData, setFormData] = useState({
    // Localisation Administrative
    wilaya: data?.wilaya || "",
    daira: data?.daira || "",
    commune: data?.commune || "",
    lieuDitFR: data?.lieuDitFR || "",
    lieuDitAR: data?.lieuDitAR || "",
    
    // Statut Juridique du Terrain
    statutJuridique: data?.statutJuridique || "",
    occupantLegal: data?.occupantLegal || "",
    superficieDeclaree: data?.superficieDeclaree || "",
    
    // Coordonnées GPS
    systemeCoordonnees: data?.systemeCoordonnees || "UTM",
    easting: data?.easting || "",
    northing: data?.northing || "",
    altitude: data?.altitude || "",
    zoneUTM: data?.zoneUTM || "31",
    hemisphere: data?.hemisphere || "nord",
    
    // Substances Minérales
    substancePrincipale: data?.substancePrincipale || "",
    substancesSecondaires: data?.substancesSecondaires || [],
  });

  useEffect(() => {
    onUpdate({ localisationSubstances: formData });
  }, [formData]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubstanceSecondaireToggle = (substanceId: string) => {
    setFormData(prev => {
      const substancesSecondaires = prev.substancesSecondaires.includes(substanceId)
        ? prev.substancesSecondaires.filter((id: string) => id !== substanceId)
        : [...prev.substancesSecondaires, substanceId];
      return { ...prev, substancesSecondaires };
    });
  };

  const filteredDairas = dairas.filter(d => d.wilayaId === formData.wilaya);
  const filteredCommunes = communes.filter(c => c.dairaId === formData.daira);

  return (
    <div className="space-y-6">
      {/* Localisation Administrative */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Localisation Administrative
          </CardTitle>
          <CardDescription>
            Sélectionnez la localisation administrative du site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wilaya">Wilaya *</Label>
              <Select
                value={formData.wilaya}
                onValueChange={(value) => handleChange("wilaya", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une wilaya" />
                </SelectTrigger>
                <SelectContent>
                  {wilayas.map((wilaya) => (
                    <SelectItem key={wilaya.id} value={wilaya.id}>
                      {wilaya.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daira">Daïra *</Label>
              <Select
                value={formData.daira}
                onValueChange={(value) => handleChange("daira", value)}
                disabled={!formData.wilaya}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une daïra" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDairas.map((daira) => (
                    <SelectItem key={daira.id} value={daira.id}>
                      {daira.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commune">Commune *</Label>
              <Select
                value={formData.commune}
                onValueChange={(value) => handleChange("commune", value)}
                disabled={!formData.daira}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une commune" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCommunes.map((commune) => (
                    <SelectItem key={commune.id} value={commune.id}>
                      {commune.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lieuDitFR">Lieu Dit (FR) *</Label>
              <Input
                id="lieuDitFR"
                value={formData.lieuDitFR}
                onChange={(e) => handleChange("lieuDitFR", e.target.value)}
                placeholder="Ex: Ain El Hajar"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lieuDitAR">Lieu Dit (AR) *</Label>
              <Input
                id="lieuDitAR"
                value={formData.lieuDitAR}
                onChange={(e) => handleChange("lieuDitAR", e.target.value)}
                placeholder="مثال: عين الحجر"
                dir="rtl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statut Juridique du Terrain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Statut Juridique du Terrain
          </CardTitle>
          <CardDescription>
            Informations sur le statut juridique du terrain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statutJuridique">Statut Juridique *</Label>
              <Select
                value={formData.statutJuridique}
                onValueChange={(value) => handleChange("statutJuridique", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  {statutsJuridiques.map((statut) => (
                    <SelectItem key={statut.id} value={statut.id}>
                      {statut.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupantLegal">Occupant Légal *</Label>
              <Input
                id="occupantLegal"
                value={formData.occupantLegal}
                onChange={(e) => handleChange("occupantLegal", e.target.value)}
                placeholder="Nom de l'occupant légal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="superficieDeclaree">Superficie déclarée (Ha) *</Label>
              <Input
                id="superficieDeclaree"
                type="number"
                value={formData.superficieDeclaree}
                onChange={(e) => handleChange("superficieDeclaree", e.target.value)}
                placeholder="Ex: 250"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coordonnées GPS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            Coordonnées GPS
          </CardTitle>
          <CardDescription>
            Système: UTM (Zone 31N)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button type="button" variant="outline">
              Importer
            </Button>
            <Button type="button" variant="outline">
              Convertir
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="easting">Easting (m) *</Label>
              <Input
                id="easting"
                type="number"
                value={formData.easting}
                onChange={(e) => handleChange("easting", e.target.value)}
                placeholder="Ex: 500000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="northing">Northing (m) *</Label>
              <Input
                id="northing"
                type="number"
                value={formData.northing}
                onChange={(e) => handleChange("northing", e.target.value)}
                placeholder="Ex: 4000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="altitude">Altitude (m) *</Label>
              <Input
                id="altitude"
                type="number"
                value={formData.altitude}
                onChange={(e) => handleChange("altitude", e.target.value)}
                placeholder="Ex: 850"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zoneUTM">Zone UTM *</Label>
              <Select
                value={formData.zoneUTM}
                onValueChange={(value) => handleChange("zoneUTM", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une zone" />
                </SelectTrigger>
                <SelectContent>
                  {zonesUTM.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hemisphere">Hémisphère *</Label>
              <Select
                value={formData.hemisphere}
                onValueChange={(value) => handleChange("hemisphere", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un hémisphère" />
                </SelectTrigger>
                <SelectContent>
                  {hemispheres.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Substances Minérales Visées */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-primary" />
            Substances Minérales Visées
          </CardTitle>
          <CardDescription>
            Sélectionnez une substance principale et des substances secondaires
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Substance Principale */}
          <div className="space-y-3">
            <Label>Substance Principale *</Label>
            <RadioGroup
              value={formData.substancePrincipale}
              onValueChange={(value: string) => handleChange("substancePrincipale", value)}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            >
              {substancesDisponibles.map((substance) => (
                <div key={substance.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={substance.id} id={`principal-${substance.id}`} />
                  <Label
                    htmlFor={`principal-${substance.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {substance.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Substances Secondaires */}
          <div className="space-y-3">
            <Label>Substances Secondaires (optionnel)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {substancesDisponibles
                .filter(s => s.id !== formData.substancePrincipale)
                .map((substance) => (
                  <div key={substance.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`secondaire-${substance.id}`}
                      checked={formData.substancesSecondaires.includes(substance.id)}
                      onChange={() => handleSubstanceSecondaireToggle(substance.id)}
                      className="rounded border-border"
                    />
                    <Label
                      htmlFor={`secondaire-${substance.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {substance.label}
                    </Label>
                  </div>
                ))}
            </div>
          </div>

          {formData.substancePrincipale && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Sélection actuelle:</p>
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary text-primary-foreground">
                  {substancesDisponibles.find(s => s.id === formData.substancePrincipale)?.label} (Principale)
                </span>
                {formData.substancesSecondaires.map((id: string) => (
                  <span key={id} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary text-secondary-foreground">
                    {substancesDisponibles.find(s => s.id === id)?.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
