import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, User, Users } from "lucide-react";

interface Step4RepresentantsProps {
  data?: any;
  onUpdate: (data: any) => void;
}

interface Actionnaire {
  id: string;
  nom: string;
  prenom: string;
  nationalite: string;
  tauxParticipation: number;
}

export const Step4Representants = ({ data, onUpdate }: Step4RepresentantsProps) => {
  const [representant, setRepresentant] = useState(data?.representant || "");
  const [actionnaires, setActionnaires] = useState<Actionnaire[]>(data?.actionnaires || []);
  const [newActionnaire, setNewActionnaire] = useState({
    nom: "",
    prenom: "",
    nationalite: "",
    tauxParticipation: 0,
  });

  const totalTaux = actionnaires.reduce((sum, a) => sum + a.tauxParticipation, 0);

  const handleAddActionnaire = () => {
    if (newActionnaire.nom && newActionnaire.prenom && newActionnaire.tauxParticipation > 0) {
      const actionnaire: Actionnaire = {
        id: Date.now().toString(),
        ...newActionnaire,
      };
      const updatedActionnaires = [...actionnaires, actionnaire];
      setActionnaires(updatedActionnaires);
      onUpdate({ representants: { representant, actionnaires: updatedActionnaires } });
      setNewActionnaire({ nom: "", prenom: "", nationalite: "", tauxParticipation: 0 });
    }
  };

  const handleRemoveActionnaire = (id: string) => {
    const updatedActionnaires = actionnaires.filter(a => a.id !== id);
    setActionnaires(updatedActionnaires);
    onUpdate({ representants: { representant, actionnaires: updatedActionnaires } });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Représentant légal */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Représentant légal</h3>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="representant">Nom complet du représentant *</Label>
            <Input
              id="representant"
              value={representant}
              onChange={(e) => {
                setRepresentant(e.target.value);
                onUpdate({ representants: { representant: e.target.value, actionnaires } });
              }}
              placeholder="Ex: Ahmed Benali"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actionnaires */}
      <Card className="border-l-4 border-l-secondary">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-secondary" />
            <h3 className="font-semibold">Actionnaires</h3>
          </div>

          {/* Form to add actionnaire */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <Input
              placeholder="Nom"
              value={newActionnaire.nom}
              onChange={(e) => setNewActionnaire(prev => ({ ...prev, nom: e.target.value }))}
            />
            <Input
              placeholder="Prénom"
              value={newActionnaire.prenom}
              onChange={(e) => setNewActionnaire(prev => ({ ...prev, prenom: e.target.value }))}
            />
            <Input
              placeholder="Nationalité"
              value={newActionnaire.nationalite}
              onChange={(e) => setNewActionnaire(prev => ({ ...prev, nationalite: e.target.value }))}
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Taux %"
                value={newActionnaire.tauxParticipation || ""}
                onChange={(e) => setNewActionnaire(prev => ({ ...prev, tauxParticipation: parseFloat(e.target.value) || 0 }))}
                min="0"
                max="100"
              />
              <Button onClick={handleAddActionnaire} size="icon" className="flex-shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* List of actionnaires */}
          {actionnaires.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Nationalité</TableHead>
                    <TableHead>Participation</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionnaires.map(actionnaire => (
                    <TableRow key={actionnaire.id}>
                      <TableCell className="font-medium">{actionnaire.nom}</TableCell>
                      <TableCell>{actionnaire.prenom}</TableCell>
                      <TableCell>{actionnaire.nationalite}</TableCell>
                      <TableCell>{actionnaire.tauxParticipation}%</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveActionnaire(actionnaire.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className={`p-3 rounded-lg ${totalTaux === 100 ? 'bg-mining-teal/10 text-mining-teal' : 'bg-destructive/10 text-destructive'}`}>
                <p className="font-semibold">
                  Total: {totalTaux}% {totalTaux === 100 ? '✓' : '(doit être égal à 100%)'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
