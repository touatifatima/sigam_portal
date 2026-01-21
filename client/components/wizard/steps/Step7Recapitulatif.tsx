import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Building2, FileText, MapPin, Users, Upload, CreditCard, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DemandeFormData } from "@/pages/investisseur/nv_demande";

interface Step7RecapitulatifProps {
  data: DemandeFormData;
}

export const Step7Recapitulatif = ({ data }: Step7RecapitulatifProps) => {
  const [certifie, setCertifie] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Identification */}
      {data.identification && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Identification</h3>
            </div>
            <div className="space-y-2">
              <p className="font-medium">{data.identification.nomEntreprise}</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Forme Juridique: {data.identification.formeJuridique}</p>
                <p>RC: {data.identification.registreCommerce}</p>
                <p>NIF: {data.identification.nif}</p>
                <p>Représentant: {data.identification.representantNom} {data.identification.representantPrenom}</p>
                <p>Email: {data.identification.representantEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Type de permis */}
      {data.typePermis && (
        <Card className="border-l-4 border-l-secondary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-secondary" />
              <h3 className="font-semibold">Type de permis</h3>
            </div>
            <div className="space-y-2">
              <p className="font-medium">{data.typePermis.lib_type}</p>
              <div className="flex gap-2">
                <Badge variant="outline">{data.typePermis.code_type}</Badge>
                <Badge variant="outline">{data.typePermis.regime}</Badge>
                <Badge variant="outline">{data.typePermis.duree_initiale} ans</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Localisation */}
      {data.localisation && (
        <Card className="border-l-4 border-l-mining-teal">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-mining-teal" />
              <h3 className="font-semibold">Localisation</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Wilaya</p>
                <p className="font-medium">Wilaya sélectionnée</p>
              </div>
              <div>
                <p className="text-muted-foreground">Commune</p>
                <p className="font-medium">Commune sélectionnée</p>
              </div>
              <div>
                <p className="text-muted-foreground">Lieu-dit</p>
                <p className="font-medium">{data.localisation.lieuDitFR}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Superficie</p>
                <p className="font-medium">{data.localisation.superficie} ha</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capacités */}
      {data.capacites && (
        <Card className="border-l-4 border-l-mining-earth">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-mining-earth" />
              <h3 className="font-semibold">Capacités</h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Capital Social</p>
                  <p className="font-medium">{data.capacites.capitalSocial} DZD</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nombre d'employés</p>
                  <p className="font-medium">{data.capacites.nombreEmployes}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Localisation & Substances */}
      {data.localisationSubstances && (
        <Card className="border-l-4 border-l-accent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-accent" />
              <h3 className="font-semibold">Localisation & Substances</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Substance principale</p>
                <Badge variant="default" className="mt-1">{data.localisationSubstances.substancePrincipale}</Badge>
              </div>
              {data.localisationSubstances.substancesSecondaires?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Substances secondaires</p>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {data.localisationSubstances.substancesSecondaires.map((s: string) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Documents */}
      {data.documents && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Documents</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {data.documents.filter((d: any) => d.status === "present").length} documents téléversés
            </p>
          </CardContent>
        </Card>
      )}

      {/* Paiement */}
      {data.paiement && (
        <Card className="border-l-4 border-l-mining-teal">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-mining-teal" />
              <h3 className="font-semibold">Paiement</h3>
            </div>
            <div className="space-y-2">
              <p className="font-medium">{data.paiement.montant?.toLocaleString()} DZD</p>
              <Badge className="bg-mining-teal">
                {data.paiement.effectue ? "Paiement confirmé" : "En attente"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certification */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="certifie"
              checked={certifie}
              onCheckedChange={(checked: boolean) => setCertifie(checked as boolean)}
            />
            <Label htmlFor="certifie" className="text-sm cursor-pointer">
              Je certifie l'exactitude des informations fournies et je m'engage à respecter
              les conditions d'obtention du permis minier demandé.
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Download PDF */}
      <div className="flex justify-center">
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Télécharger le récapitulatif PDF
        </Button>
      </div>
    </div>
  );
};
