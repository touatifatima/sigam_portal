import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, CheckCircle2, AlertCircle } from "lucide-react";

interface Step5DocumentsProps {
  data?: any[];
  onUpdate: (data: any) => void;
}

interface Document {
  id: string;
  nom: string;
  description: string;
  obligatoire: boolean;
  format: string;
  tailleMax: string;
  status: "present" | "manquant" | "uploading";
  file?: File;
  progress?: number;
}

export const Step5Documents = ({ data, onUpdate }: Step5DocumentsProps) => {
  const [documents, setDocuments] = useState<Document[]>(
    data || [
      {
        id: "1",
        nom: "Registre de commerce",
        description: "Copie certifiée conforme du registre de commerce",
        obligatoire: true,
        format: ".pdf",
        tailleMax: "5 MB",
        status: "manquant",
      },
      {
        id: "2",
        nom: "Statuts de la société",
        description: "Statuts légalisés de l'entreprise",
        obligatoire: true,
        format: ".pdf",
        tailleMax: "10 MB",
        status: "manquant",
      },
      {
        id: "3",
        nom: "Pièce d'identité du représentant",
        description: "Carte nationale d'identité ou passeport",
        obligatoire: true,
        format: ".pdf, .jpg",
        tailleMax: "2 MB",
        status: "manquant",
      },
      {
        id: "4",
        nom: "Étude géologique préliminaire",
        description: "Rapport géologique de la zone",
        obligatoire: false,
        format: ".pdf",
        tailleMax: "20 MB",
        status: "manquant",
      },
      {
        id: "5",
        nom: "Plan de situation",
        description: "Plan cadastral de la zone",
        obligatoire: true,
        format: ".pdf, .jpg",
        tailleMax: "5 MB",
        status: "manquant",
      },
    ]
  );

  const handleFileUpload = (docId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Simuler l'upload avec progression
      const updatedDocs = documents.map(doc => {
        if (doc.id === docId) {
          return { ...doc, status: "uploading" as const, file, progress: 0 };
        }
        return doc;
      });
      setDocuments(updatedDocs);

      // Simuler la progression
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === docId ? { ...doc, progress } : doc
          )
        );

        if (progress >= 100) {
          clearInterval(interval);
          setDocuments(prev =>
            prev.map(doc =>
              doc.id === docId ? { ...doc, status: "present" as const } : doc
            )
          );
          onUpdate({ documents: updatedDocs });
        }
      }, 200);
    }
  };

  const documentsPresents = documents.filter(d => d.status === "present").length;
  const documentsObligatoires = documents.filter(d => d.obligatoire).length;
  const obligatoiresPresents = documents.filter(d => d.obligatoire && d.status === "present").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Progress Summary */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Documents téléversés</span>
              <span className="text-sm text-muted-foreground">
                {documentsPresents} / {documents.length}
              </span>
            </div>
            <Progress value={(documentsPresents / documents.length) * 100} />
            
            <p className="text-sm text-muted-foreground">
              Documents obligatoires: {obligatoiresPresents} / {documentsObligatoires}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <div className="space-y-4">
        {documents.map(doc => (
          <Card key={doc.id} className="animate-scale-in">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {doc.status === "present" ? (
                    <CheckCircle2 className="w-6 h-6 text-mining-teal" />
                  ) : doc.obligatoire ? (
                    <AlertCircle className="w-6 h-6 text-primary" />
                  ) : (
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        {doc.nom}
                        {doc.obligatoire && (
                          <Badge variant="outline" className="text-xs">Obligatoire</Badge>
                        )}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: {doc.format} • Max: {doc.tailleMax}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      {doc.status === "present" ? (
                        <Badge className="bg-mining-teal">Téléversé</Badge>
                      ) : (
                        <label htmlFor={`file-${doc.id}`}>
                          <Button variant="outline" size="sm" className="gap-2" asChild>
                            <span>
                              <Upload className="w-4 h-4" />
                              Téléverser
                            </span>
                          </Button>
                          <input
                            id={`file-${doc.id}`}
                            type="file"
                            className="hidden"
                            accept={doc.format}
                            onChange={(e) => handleFileUpload(doc.id, e)}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {doc.status === "uploading" && (
                    <Progress value={doc.progress} className="h-1" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
