import { useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Marker, useMap, useMapEvents, WMSTileLayer } from 'react-leaflet';
import { LatLngExpression, Map as LeafletMap, Icon, divIcon, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, RotateCcw, Layers, ExternalLink, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderToStaticMarkup } from 'react-dom/server';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

export interface Parcel {
  id: string;
  coordinates: LatLngExpression[][];
  address?: string;
  status: 'none' | 'light-green' | 'forest-green';
  hasCompost: boolean;
}

interface ParcelMapProps {
  parcels: Parcel[];
  center?: LatLngExpression;
  zoom?: number;
  onParcelClick?: (parcelId: string) => void;
  adminMode?: boolean;
}

function ResetViewButton({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  
  const handleReset = () => {
    map.setView(center, zoom);
  };

  return (
    <div className="absolute top-4 left-4 z-[1000]">
      <Button
        onClick={handleReset}
        variant="secondary"
        size="sm"
        className="shadow-md"
        data-testid="button-reset-view"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset View
      </Button>
    </div>
  );
}

function MapClickHandler() {
  const { toast } = useToast();
  
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      const coordsText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      navigator.clipboard.writeText(coordsText).then(() => {
        toast({
          title: "Coordinates copied!",
          description: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
        });
      }).catch(() => {
        toast({
          title: "Copy failed",
          description: "Could not copy coordinates to clipboard",
          variant: "destructive",
        });
      });
    },
  });
  
  return null;
}

function FitBoundsToParcel({ parcels, swapCoordinates }: { parcels: Parcel[], swapCoordinates: (coords: LatLngExpression[][]) => LatLngExpression[][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (parcels.length > 0) {
      const bounds = new LatLngBounds([]);
      
      parcels.forEach((parcel) => {
        const leafletCoords = swapCoordinates(parcel.coordinates);
        leafletCoords[0].forEach((coord) => {
          bounds.extend(coord as [number, number]);
        });
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [parcels, map, swapCoordinates]);
  
  return null;
}

export default function ParcelMap({ parcels, center = [42.2808, -83.7430], zoom = 16, onParcelClick, adminMode = false }: ParcelMapProps) {
  const mapRef = useRef<LeafletMap>(null);
  const [showParcelLayer, setShowParcelLayer] = useState(true);

  const getParcelColor = (status: string) => {
    switch (status) {
      case 'light-green':
        return '#9ed89e';
      case 'forest-green':
        return '#2d7a4f';
      default:
        return '#94a3b8';
    }
  };

  // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
  const swapCoordinates = (coords: LatLngExpression[][]): LatLngExpression[][] => {
    return coords.map(ring => 
      (ring as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number])
    );
  };

  const getParcelCenter = (coordinates: LatLngExpression[][]): LatLngExpression => {
    // Coordinates are already in Leaflet format [lat, lng] at this point
    const coords = coordinates[0] as [number, number][];
    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2
    ];
  };

  const compostIcon = divIcon({
    html: renderToStaticMarkup(
      <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-full shadow-md">
        <Trash2 className="h-4 w-4 text-primary-foreground" />
      </div>
    ),
    className: 'compost-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const leafIcon = divIcon({
    html: renderToStaticMarkup(
      <div className="flex items-center justify-center w-8 h-8 bg-green-600 rounded-full shadow-lg">
        <Leaf className="h-5 w-5 text-white" />
      </div>
    ),
    className: 'leaf-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  return (
    <div className="relative w-full h-full" data-testid="map-container">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <ResetViewButton center={center} zoom={zoom} />
        <MapClickHandler />
        <FitBoundsToParcel parcels={parcels} swapCoordinates={swapCoordinates} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showParcelLayer && (
          <WMSTileLayer
            url="https://services3.arcgis.com/mRwarx73j5FhfOkR/arcgis/services/Parcels/MapServer/WMSServer"
            layers="0"
            format="image/png"
            transparent={true}
            attribution='&copy; <a href="https://www.washtenaw.org">Washtenaw County GIS</a>'
          />
        )}
        {parcels.map((parcel) => {
          const leafletCoords = swapCoordinates(parcel.coordinates);
          return (
            <Polygon
              key={parcel.id}
              positions={leafletCoords}
              pathOptions={{
                color: getParcelColor(parcel.status),
                fillColor: getParcelColor(parcel.status),
                fillOpacity: 0.5,
                weight: 2,
                className: adminMode ? 'cursor-pointer' : ''
              }}
              eventHandlers={adminMode && onParcelClick ? {
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  onParcelClick(parcel.id);
                }
              } : undefined}
            >
            <Popup>
              <div className="p-2 space-y-2" data-testid={`popup-parcel-${parcel.id}`}>
                <div>
                  {parcel.address && <p className="font-semibold">{parcel.address}</p>}
                  <p className="text-xs font-mono text-muted-foreground" data-testid={`text-parcel-id-${parcel.id}`}>
                    ID: {parcel.id}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Status: {parcel.status === 'none' ? 'No response' : parcel.status === 'light-green' ? 'Q1 Support' : 'Full Support'}
                </p>
                {parcel.hasCompost && (
                  <div className="flex items-center gap-1 text-sm text-primary">
                    <Trash2 className="h-4 w-4" />
                    <span>Compost bin available</span>
                  </div>
                )}
                <Link href="/survey">
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="w-full mt-1"
                    data-testid={`button-survey-link-${parcel.id}`}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Go to Survey
                  </Button>
                </Link>
              </div>
            </Popup>
          </Polygon>
          );
        }
        )}
        {parcels.filter(p => p.status === 'forest-green').map((parcel) => {
          const leafletCoords = swapCoordinates(parcel.coordinates);
          return (
            <Marker
              key={`leaf-${parcel.id}`}
              position={getParcelCenter(leafletCoords)}
              icon={leafIcon}
            />
          );
        })}
        {parcels.filter(p => p.hasCompost).map((parcel) => {
          const leafletCoords = swapCoordinates(parcel.coordinates);
          return (
            <Marker
              key={`compost-${parcel.id}`}
              position={getParcelCenter(leafletCoords)}
              icon={compostIcon}
            />
          );
        })}
      </MapContainer>

      <div className="absolute top-4 right-4 z-[1000]">
        <Button
          onClick={() => setShowParcelLayer(!showParcelLayer)}
          variant={showParcelLayer ? "default" : "outline"}
          size="sm"
          className="shadow-md"
          data-testid="button-toggle-parcels"
        >
          <Layers className="h-4 w-4 mr-2" />
          {showParcelLayer ? "Hide" : "Show"} Parcels
        </Button>
      </div>

      <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur-sm border rounded-md p-4 z-[1000]" data-testid="map-legend">
        <h3 className="font-semibold text-sm mb-2">Legend</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#94a3b8' }} />
            <span>No Response</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#9ed89e' }} />
            <span>Q1 Support</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#2d7a4f' }} />
            <span>Full Support</span>
          </div>
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-green-600" />
            <span>Selected in Area</span>
          </div>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-primary" />
            <span>Compost Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}
