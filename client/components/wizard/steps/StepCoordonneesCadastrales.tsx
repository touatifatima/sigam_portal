import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Layers, AlertCircle, Save, Trash2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StepCoordonneesCadastralesProps {
  data?: any;
  onUpdate: (data: any) => void;
}

export const StepCoordonneesCadastrales = ({ data, onUpdate }: StepCoordonneesCadastralesProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [coordinates, setCoordinates] = useState<any[]>(data?.coordinates || []);
  const [superficie, setSuperficie] = useState(data?.superficie || 0);
  const [layers, setLayers] = useState({
    zonesOccupees: data?.layers?.zonesOccupees ?? true,
    mines: data?.layers?.mines ?? true,
    zonesInterdites: data?.layers?.zonesInterdites ?? true,
  });
  
  const [systemeCoordonnees, setSystemeCoordonnees] = useState({
    nordSaharaUTM: data?.systemeCoordonnees?.nordSaharaUTM ?? false,
    wgs84UTM: data?.systemeCoordonnees?.wgs84UTM ?? false,
  });
  
  const [manualPoints, setManualPoints] = useState<Array<{ x: string; y: string; fuseaux: string }>>(
    data?.manualPoints || [{ x: "", y: "", fuseaux: "" }]
  );
  
  const [natureJuridique, setNatureJuridique] = useState({
    domanial: data?.natureJuridique?.domanial ?? false,
    terrainPrive: data?.natureJuridique?.terrainPrive ?? false,
    autre: data?.natureJuridique?.autre ?? false,
    autreDetails: data?.natureJuridique?.autreDetails || "",
  });

  useEffect(() => {
    // Load ArcGIS API
    const script = document.createElement('script');
    script.src = 'https://js.arcgis.com/4.28/';
    script.onload = () => {
      setMapLoaded(true);
      initializeMap();
    };
    document.head.appendChild(script);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://js.arcgis.com/4.28/esri/themes/light/main.css';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(script);
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    onUpdate({
      coordonneesCadastrales: {
        coordinates,
        superficie,
        layers,
        systemeCoordonnees,
        manualPoints,
        natureJuridique,
      }
    });
  }, [coordinates, superficie, layers, systemeCoordonnees, manualPoints, natureJuridique, onUpdate]);

  const initializeMap = () => {
    // @ts-ignore - ArcGIS loaded dynamically
    const arcgisRequire = (window as any).require;
    arcgisRequire([
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/GraphicsLayer",
      "esri/Graphic",
      "esri/geometry/Polygon",
      "esri/widgets/Sketch",
      "esri/geometry/geometryEngine",
    ], (Map: any, MapView: any, GraphicsLayer: any, Graphic: any, Polygon: any, Sketch: any, geometryEngine: any) => {
      
      const graphicsLayer = new GraphicsLayer();
      const zonesOccupeesLayer = new GraphicsLayer({ title: "Zones Occupées" });
      const minesLayer = new GraphicsLayer({ title: "Mines Existantes" });
      const zonesInterditesLayer = new GraphicsLayer({ title: "Zones Interdites" });

      const map = new Map({
        basemap: "topo-vector",
        layers: [zonesOccupeesLayer, minesLayer, zonesInterditesLayer, graphicsLayer]
      });

      const view = new MapView({
        container: mapRef.current,
        map: map,
        center: [3.0588, 36.7538], // Algérie centrale
        zoom: 6
      });

      // Add sample zones occupées (red)
      addSampleZone(zonesOccupeesLayer, Graphic, Polygon, [
        [2.5, 36.5], [2.8, 36.5], [2.8, 36.8], [2.5, 36.8], [2.5, 36.5]
      ], [255, 0, 0, 0.3], "Zone Occupée");

      // Add sample mines (orange)
      addSampleZone(minesLayer, Graphic, Polygon, [
        [3.5, 35.5], [3.8, 35.5], [3.8, 35.8], [3.5, 35.8], [3.5, 35.5]
      ], [255, 165, 0, 0.3], "Mine Existante");

      // Add sample zones interdites (dark red)
      addSampleZone(zonesInterditesLayer, Graphic, Polygon, [
        [4.5, 37.5], [4.8, 37.5], [4.8, 37.8], [4.5, 37.8], [4.5, 37.5]
      ], [139, 0, 0, 0.4], "Zone Interdite");

      // Setup sketch widget for drawing
      const sketch = new Sketch({
        layer: graphicsLayer,
        view: view,
        creationMode: "update",
        availableCreateTools: ["polygon"],
      });

      view.ui.add(sketch, "top-right");

      // Listen for polygon creation
      sketch.on("create", (event: any) => {
        if (event.state === "complete") {
          const geometry = event.graphic.geometry;
          const area = geometryEngine.geodesicArea(geometry, "hectares");
          setSuperficie(Math.round(area * 100) / 100);
          
          const rings = geometry.rings[0];
          const coords = rings.map((ring: number[]) => ({
            longitude: ring[0],
            latitude: ring[1]
          }));
          setCoordinates(coords);
        }
      });

      // Update layer visibility
      zonesOccupeesLayer.visible = layers.zonesOccupees;
      minesLayer.visible = layers.mines;
      zonesInterditesLayer.visible = layers.zonesInterdites;
    });
  };

  const addSampleZone = (layer: any, Graphic: any, Polygon: any, rings: number[][], color: number[], title: string) => {
    const polygon = new Polygon({
      rings: [rings]
    });

    const symbol = {
      type: "simple-fill",
      color: color,
      outline: {
        color: [color[0], color[1], color[2], 1],
        width: 2
      }
    };

    const graphic = new Graphic({
      geometry: polygon,
      symbol: symbol,
      attributes: { title }
    });

    layer.add(graphic);
  };

  const handleLayerToggle = (layerName: keyof typeof layers) => {
    setLayers(prev => ({
      ...prev,
      [layerName]: !prev[layerName]
    }));
  };

  const handleClearPolygon = () => {
    setCoordinates([]);
    setSuperficie(0);
    if (mapLoaded) {
      window.location.reload(); // Simple way to reset the map
    }
  };

  const handleAddPoint = () => {
    setManualPoints([...manualPoints, { x: "", y: "", fuseaux: "" }]);
  };

  const handlePointChange = (index: number, field: 'x' | 'y' | 'fuseaux', value: string) => {
    const newPoints = [...manualPoints];
    newPoints[index][field] = value;
    setManualPoints(newPoints);
  };

  const handleRemovePoint = (index: number) => {
    if (manualPoints.length > 1) {
      setManualPoints(manualPoints.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Dessinez le périmètre de votre demande sur la carte ou saisissez les coordonnées manuellement dans le tableau ci-dessous.
          Les zones en rouge sont occupées, en orange sont des mines existantes, et en rouge foncé sont interdites.
        </AlertDescription>
      </Alert>

      {/* Système de Coordonnées */}
      <Card>
        <CardHeader>
          <CardTitle>Système de Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="nordSaharaUTM"
                checked={systemeCoordonnees.nordSaharaUTM}
                onCheckedChange={(checked) => 
                  setSystemeCoordonnees(prev => ({ ...prev, nordSaharaUTM: checked as boolean }))
                }
              />
              <Label htmlFor="nordSaharaUTM" className="cursor-pointer">
                Nord Sahara UTM
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="wgs84UTM"
                checked={systemeCoordonnees.wgs84UTM}
                onCheckedChange={(checked) => 
                  setSystemeCoordonnees(prev => ({ ...prev, wgs84UTM: checked as boolean }))
                }
              />
              <Label htmlFor="wgs84UTM" className="cursor-pointer">
                WGS84 UTM
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Points du Périmètre */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Points du Périmètre</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddPoint}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un point
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Point</TableHead>
                  <TableHead>Coordonnées</TableHead>
                  <TableHead className="w-32">Fuseaux</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualPoints.map((point, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Input
                          placeholder="X"
                          value={point.x}
                          onChange={(e) => handlePointChange(index, 'x', e.target.value)}
                          className="h-8"
                        />
                        <Input
                          placeholder="Y"
                          value={point.y}
                          onChange={(e) => handlePointChange(index, 'y', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Fuseaux"
                        value={point.fuseaux}
                        onChange={(e) => handlePointChange(index, 'fuseaux', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      {manualPoints.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePoint(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Superficie du périmètre */}
      <Card>
        <CardHeader>
          <CardTitle>Superficie du périmètre (ha)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            value={superficie}
            onChange={(e) => setSuperficie(parseFloat(e.target.value) || 0)}
            placeholder="Entrer la superficie en hectares"
          />
        </CardContent>
      </Card>

      {/* Nature Juridique du Terrain */}
      <Card>
        <CardHeader>
          <CardTitle>Nature Juridique du Terrain Sollicité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="domanial"
                checked={natureJuridique.domanial}
                onCheckedChange={(checked) => 
                  setNatureJuridique(prev => ({ ...prev, domanial: checked as boolean }))
                }
              />
              <Label htmlFor="domanial" className="cursor-pointer">
                Domanial
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="terrainPrive"
                checked={natureJuridique.terrainPrive}
                onCheckedChange={(checked) => 
                  setNatureJuridique(prev => ({ ...prev, terrainPrive: checked as boolean }))
                }
              />
              <Label htmlFor="terrainPrive" className="cursor-pointer">
                Terrain privé
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="autre"
                checked={natureJuridique.autre}
                onCheckedChange={(checked) => 
                  setNatureJuridique(prev => ({ ...prev, autre: checked as boolean }))
                }
              />
              <Label htmlFor="autre" className="cursor-pointer">
                Autre (préciser) :
              </Label>
            </div>
          </div>
          {natureJuridique.autre && (
            <Input
              value={natureJuridique.autreDetails}
              onChange={(e) => 
                setNatureJuridique(prev => ({ ...prev, autreDetails: e.target.value }))
              }
              placeholder="Préciser la nature juridique"
            />
          )}
        </CardContent>
      </Card>

      {/* Contrôles des couches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Couches de la carte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-500/30 border-2 border-red-500 rounded" />
              <Label htmlFor="zonesOccupees" className="cursor-pointer">
                Zones Occupées
              </Label>
            </div>
            <Checkbox
              id="zonesOccupees"
              checked={layers.zonesOccupees}
              onCheckedChange={() => handleLayerToggle('zonesOccupees')}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-orange-500/30 border-2 border-orange-500 rounded" />
              <Label htmlFor="mines" className="cursor-pointer">
                Mines Existantes
              </Label>
            </div>
            <Checkbox
              id="mines"
              checked={layers.mines}
              onCheckedChange={() => handleLayerToggle('mines')}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-900/40 border-2 border-red-900 rounded" />
              <Label htmlFor="zonesInterdites" className="cursor-pointer">
                Zones Interdites
              </Label>
            </div>
            <Checkbox
              id="zonesInterdites"
              checked={layers.zonesInterdites}
              onCheckedChange={() => handleLayerToggle('zonesInterdites')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Carte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte Interactive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={mapRef} className="w-full h-[600px] rounded-lg border" />
        </CardContent>
      </Card>

      {/* Informations sur le périmètre */}
      {coordinates.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Périmètre dessiné</h3>
                  <p className="text-sm text-muted-foreground">
                    {coordinates.length} points
                  </p>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  {superficie.toFixed(2)} Ha
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearPolygon}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Effacer
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  Sauvegarder
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
