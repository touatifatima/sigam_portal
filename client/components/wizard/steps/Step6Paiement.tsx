import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Banknote, FileText, CheckCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Step6PaiementProps {
  data?: any;
  onUpdate: (data: any) => void;
}

export const Step6Paiement = ({ data, onUpdate }: Step6PaiementProps) => {
  const [modePaiement, setModePaiement] = useState(data?.mode || "enligne");
  const [paiementEffectue, setPaiementEffectue] = useState(data?.effectue || false);

  const montantFrais = 15000; // DA - à calculer selon le barème

  const handlePaiement = () => {
    // Simuler le paiement
    setPaiementEffectue(true);
    onUpdate({ paiement: { mode: modePaiement, effectue: true, montant: montantFrais } });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Montant */}
      <Card className="border-l-4 border-l-mining-earth">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg">Frais de dépôt</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Calculé selon le barème en vigueur
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-mining-earth">{montantFrais.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">DZD</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!paiementEffectue ? (
        <>
          {/* Mode de paiement */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Mode de paiement</h3>
              <RadioGroup value={modePaiement} onValueChange={setModePaiement}>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="enligne" id="enligne" />
                    <Label htmlFor="enligne" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">Paiement en ligne</p>
                        <p className="text-xs text-muted-foreground">Carte bancaire - Immédiat</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="differe" id="differe" />
                    <Label htmlFor="differe" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Banknote className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="font-medium">Paiement différé</p>
                        <p className="text-xs text-muted-foreground">
                          Avec justificatif de virement bancaire
                        </p>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Action button */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">
                    {modePaiement === "enligne" 
                      ? "Vous serez redirigé vers la plateforme de paiement sécurisée"
                      : "Vous pourrez télécharger un RIB pour effectuer le virement"
                    }
                  </span>
                </div>
                <Button onClick={handlePaiement} size="lg" className="gap-2">
                  {modePaiement === "enligne" ? "Payer maintenant" : "Continuer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-l-4 border-l-mining-teal bg-mining-teal/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-mining-teal flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-mining-teal">Paiement confirmé</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Le paiement de {montantFrais.toLocaleString()} DZD a été enregistré avec succès.
                </p>
                {modePaiement === "differe" && (
                  <Badge variant="outline" className="mt-2">
                    En attente de validation du justificatif
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
