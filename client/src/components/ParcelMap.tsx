import { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Marker, useMap, useMapEvents, WMSTileLayer } from 'react-leaflet';
import { LatLngExpression, Map as LeafletMap, divIcon, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, ExternalLink, Leaf } from 'lucide-react';
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
  selected?: boolean;
  q1Response?: boolean | null;
  q2Response?: boolean | null;
  q3Response?: boolean | null;
}

interface ParcelMapProps {
  parcels: Parcel[];
  center?: LatLngExpression;
  zoom?: number;
  onParcelClick?: (parcelId: string) => void;
  adminMode?: boolean;
  fitBounds?: boolean;
}

function MapClickHandler() {
  const { toast } = useToast();
  
  useMapEvents({
    contextmenu: (e) => {
      const { lat, lng } = e.latlng;
      const coordsText = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      
      navigator.clipboard.writeText(coordsText).then(() => {
        toast({
          title: "Coordinates copied!",
          description: coordsText,
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

function UpdateMapCenter({ center, zoom }: { center?: LatLngExpression, zoom: number }) {
  const map = useMap();
  const prevCenterRef = useRef<string | null>(null);
  const prevZoomRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (center) {
      // Check if the actual values have changed (not just array reference)
      const centerStr = JSON.stringify(center);
      const valuesChanged = prevCenterRef.current !== centerStr || prevZoomRef.current !== zoom;
      
      // Only update map if values actually changed
      if (valuesChanged) {
        map.setView(center, zoom);
        // Update refs to track current values
        prevCenterRef.current = centerStr;
        prevZoomRef.current = zoom;
      }
    }
  }, [center, zoom, map]);
  
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

export default function ParcelMap({ parcels, center = [42.2808, -83.7430], zoom = 16, onParcelClick, adminMode = false, fitBounds = false }: ParcelMapProps) {
  const mapRef = useRef<LeafletMap>(null);

  const getParcelColor = (status: string, adminMode: boolean = false, isSelected: boolean = false) => {
    if (adminMode) {
      // In admin mode: use same gray for both assigned and optional parcels
      return '#94a3b8';
    }
    switch (status) {
      case 'light-green':
        return '#9ed89e';
      case 'forest-green':
        return '#2d7a4f';
      default:
        return '#94a3b8';
    }
  };

  const getParcelBorderColor = (status: string, adminMode: boolean = false, isSelected: boolean = false) => {
    if (adminMode) {
      return '#94a3b8';
    }
    // Both Q1 support and full support get dark green borders
    if (status === 'light-green' || status === 'forest-green') {
      return '#2d7a4f';
    }
    return '#94a3b8';
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
        maxZoom={22}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <MapClickHandler />
        {fitBounds ? (
          <FitBoundsToParcel parcels={parcels} swapCoordinates={swapCoordinates} />
        ) : (
          <UpdateMapCenter center={center} zoom={zoom} />
        )}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={22}
        />
        <WMSTileLayer
          url="https://services3.arcgis.com/mRwarx73j5FhfOkR/arcgis/services/Parcels/MapServer/WMSServer"
          layers="0"
          format="image/png"
          transparent={true}
          attribution='&copy; <a href="https://www.washtenaw.org">Washtenaw County GIS</a>'
        />
        {parcels.map((parcel) => {
          const leafletCoords = swapCoordinates(parcel.coordinates);
          const isSelected = parcel.selected || false;
          const borderOpacity = adminMode ? (isSelected ? 0.5 : 0.3) : 1.0;
          return (
            <Polygon
              key={parcel.id}
              positions={leafletCoords}
              pathOptions={{
                color: getParcelBorderColor(parcel.status, adminMode, isSelected),
                fillColor: getParcelColor(parcel.status, adminMode, isSelected),
                fillOpacity: adminMode ? 0.35 : 0.5,
                opacity: borderOpacity,
                weight: 2,
                dashArray: adminMode && !isSelected ? '5, 5' : undefined,
                className: onParcelClick ? 'cursor-pointer' : ''
              }}
              eventHandlers={onParcelClick ? {
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  onParcelClick(parcel.id);
                }
              } : undefined}
            >
            {!adminMode && !onParcelClick && (
              <Popup>
                <div className="p-2 space-y-2" data-testid={`popup-parcel-${parcel.id}`}>
                  <div>
                    {parcel.address && <p className="font-semibold">{parcel.address}</p>}
                    <p className="text-xs font-mono text-muted-foreground" data-testid={`text-parcel-id-${parcel.id}`}>
                      ID: {parcel.id}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {parcel.q1Response == null && parcel.q2Response == null && parcel.q3Response == null && (
                      <p>No Response</p>
                    )}
                    {parcel.q1Response === true && (
                      <p>Supports Park Border Care</p>
                    )}
                    {parcel.q2Response === true && (
                      <p>Appreciates Parcel Help</p>
                    )}
                    {parcel.q3Response === true && (
                      <p>Compost Bin Usage Allowed</p>
                    )}
                  </div>
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
            )}
          </Polygon>
          );
        }
        )}
        {adminMode && parcels.filter(p => p.selected).map((parcel) => {
          const leafletCoords = swapCoordinates(parcel.coordinates);
          return (
            <Marker
              key={`leaf-${parcel.id}`}
              position={getParcelCenter(leafletCoords)}
              icon={leafIcon}
            >
              <Popup>
                <div className="p-2 space-y-2" data-testid={`popup-admin-leaf-${parcel.id}`}>
                  <div>
                    {parcel.address && <p className="font-semibold">{parcel.address}</p>}
                    <p className="text-xs font-mono text-muted-foreground">
                      ID: {parcel.id}
                    </p>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><strong>Q1 (Removal Permission):</strong> {parcel.q1Response == null ? 'No response' : parcel.q1Response ? 'Yes' : 'No'}</p>
                    <p><strong>Q2 (Assistance Interest):</strong> {parcel.q2Response == null ? 'No response' : parcel.q2Response ? 'Yes' : 'No'}</p>
                    <p><strong>Q3 (Compost Sharing):</strong> {parcel.q3Response == null ? 'No response' : parcel.q3Response ? 'Yes' : 'No'}</p>
                  </div>
                  <Link href={`/survey?parcelId=${encodeURIComponent(parcel.id)}`}>
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="w-full mt-1"
                      data-testid={`button-edit-survey-${parcel.id}`}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Edit Survey Response
                    </Button>
                  </Link>
                </div>
              </Popup>
            </Marker>
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

      {!adminMode && (
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
              <Trash2 className="h-4 w-4 text-primary" />
              <span>Compost Available</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
