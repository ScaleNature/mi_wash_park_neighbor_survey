import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Marker, useMap, useMapEvents, WMSTileLayer } from 'react-leaflet';
import { LatLngExpression, Map as LeafletMap, divIcon, LatLngBounds, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, ExternalLink, Leaf, Copy, Edit, PlusCircle, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { renderToStaticMarkup } from 'react-dom/server';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

export interface Parcel {
  id: string;
  coordinates: LatLngExpression[][];
  address?: string;
  shortCode?: string | null;
  codePhrase?: string;
  status: 'none' | 'light-green' | 'forest-green';
  hasCompost: boolean;
  selected?: boolean;
  q1Response?: boolean | null;
  q1Comment?: string | null;
  q2Response?: boolean | null;
  q2Comment?: string | null;
  q3Response?: boolean | null;
  q3Comment?: string | null;
  responseDate?: string | null;
  areaNames?: string[];
}

interface ParcelMapProps {
  parcels: Parcel[];
  center?: LatLngExpression;
  zoom?: number;
  onParcelClick?: (parcelId: string) => void;
  onToggleArea?: (parcelId: string) => void;
  adminMode?: boolean;
  isAdminMap?: boolean;
  fitBounds?: boolean;
}

export interface ParcelMapRef {
  flyTo: (center: LatLngExpression, zoom: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]], padding?: number) => void;
  getCenter: () => { lat: number; lng: number } | undefined;
  getZoom: () => number | undefined;
}

// Utility: Calculate meters per pixel at given zoom level and latitude
function getMetersPerPixel(map: LeafletMap): number {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  // Formula for EPSG:3857 (Web Mercator)
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}

// Utility: Convert meters to pixels
function metersToPixels(meters: number, map: LeafletMap): number {
  const metersPerPixel = getMetersPerPixel(map);
  return meters / metersPerPixel;
}

// Utility: Extract house number from address
function extractHouseNumber(address?: string): string | null {
  if (!address) return null;
  // Match leading digits in address
  const match = address.match(/^\d+/);
  return match ? match[0] : null;
}

// Utility: Offset a position by meters north/south
function offsetPosition(position: LatLngExpression, metersNorth: number): LatLngExpression {
  const [lat, lng] = position as [number, number];
  // ~111,111 meters per degree latitude
  const latOffset = metersNorth / 111111;
  return [lat + latOffset, lng];
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

function MapPositionSaver() {
  const map = useMap();
  
  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const position = {
        center: [center.lat, center.lng] as [number, number],
        zoom: zoom
      };
      localStorage.setItem('mapPosition', JSON.stringify(position));
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

// Component to handle dynamic markers and labels that scale with zoom
function DynamicMarkers({ 
  parcels, 
  adminMode, 
  getParcelCenter 
}: { 
  parcels: Parcel[], 
  adminMode: boolean,
  getParcelCenter: (coords: LatLngExpression[][]) => LatLngExpression
}) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  
  // Listen to zoom changes
  useMapEvents({
    zoomend: () => {
      setCurrentZoom(map.getZoom());
    },
  });
  
  // Icon physical sizes in meters
  const ICON_SIZE_METERS = 6; // ~20 feet
  const TEXT_HEIGHT_METERS = 3; // ~10 feet
  const VERTICAL_OFFSET_METERS = 6; // ~20 feet separation
  
  // Calculate pixel sizes
  const iconSizePixels = metersToPixels(ICON_SIZE_METERS, map);
  const textHeightPixels = metersToPixels(TEXT_HEIGHT_METERS, map);
  
  // Only show address labels at zoom 17+
  const showAddressLabels = currentZoom >= 17;
  
  return (
    <>
      {/* Leaf markers for assigned parcels in admin mode */}
      {adminMode && parcels.filter(p => p.selected).map((parcel) => {
        const center = getParcelCenter(parcel.coordinates);
        const iconPosition = offsetPosition(center, -VERTICAL_OFFSET_METERS);
        
        const leafIcon = divIcon({
          html: renderToStaticMarkup(
            <div 
              className="flex items-center justify-center bg-green-600 rounded-full shadow-lg"
              style={{
                width: `${iconSizePixels}px`,
                height: `${iconSizePixels}px`
              }}
            >
              <Leaf 
                className="text-white" 
                style={{ 
                  width: `${iconSizePixels * 0.6}px`,
                  height: `${iconSizePixels * 0.6}px`
                }}
              />
            </div>
          ),
          className: 'dynamic-leaf-marker',
          iconSize: [iconSizePixels, iconSizePixels],
          iconAnchor: [iconSizePixels / 2, iconSizePixels / 2],
        });
        
        return (
          <Marker
            key={`leaf-${parcel.id}`}
            position={iconPosition}
            icon={leafIcon}
          >
            <Popup>
              <div className="p-1.5 space-y-1" data-testid={`popup-admin-leaf-${parcel.id}`}>
                <div>
                  {parcel.address && <p className="font-semibold text-sm leading-tight">{parcel.address}</p>}
                  <p className="text-xs font-mono text-muted-foreground leading-tight">
                    ID: {parcel.id}
                  </p>
                </div>
                <div className="text-sm space-y-0.5">
                  <p className="leading-tight"><strong>Q1 (Removal Permission):</strong> {parcel.q1Response == null ? 'No response' : parcel.q1Response ? 'Yes' : 'No'}</p>
                  <p className="leading-tight"><strong>Q2 (Assistance Interest):</strong> {parcel.q2Response == null ? 'No response' : parcel.q2Response ? 'Yes' : 'No'}</p>
                  <p className="leading-tight"><strong>Q3 (Compost Sharing):</strong> {parcel.q3Response == null ? 'No response' : parcel.q3Response ? 'Yes' : 'No'}</p>
                </div>
                <Link href={`/survey?parcelId=${encodeURIComponent(parcel.id)}`}>
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="w-full mt-0.5"
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
      
      {/* Compost bin markers */}
      {parcels.filter(p => p.hasCompost).map((parcel) => {
        const center = getParcelCenter(parcel.coordinates);
        const iconPosition = offsetPosition(center, -VERTICAL_OFFSET_METERS);
        
        const compostIcon = divIcon({
          html: renderToStaticMarkup(
            <div 
              className="flex items-center justify-center bg-primary rounded-full shadow-md"
              style={{
                width: `${iconSizePixels}px`,
                height: `${iconSizePixels}px`
              }}
            >
              <Trash2 
                className="text-primary-foreground" 
                style={{ 
                  width: `${iconSizePixels * 0.5}px`,
                  height: `${iconSizePixels * 0.5}px`
                }}
              />
            </div>
          ),
          className: 'dynamic-compost-marker',
          iconSize: [iconSizePixels, iconSizePixels],
          iconAnchor: [iconSizePixels / 2, iconSizePixels / 2],
        });
        
        return (
          <Marker
            key={`compost-${parcel.id}`}
            position={iconPosition}
            icon={compostIcon}
          />
        );
      })}
      
      {/* Address number labels at zoom 17+ */}
      {showAddressLabels && parcels.map((parcel) => {
        const houseNumber = extractHouseNumber(parcel.address);
        if (!houseNumber) return null;
        
        const center = getParcelCenter(parcel.coordinates);
        const labelPosition = offsetPosition(center, VERTICAL_OFFSET_METERS);
        
        const addressIcon = divIcon({
          html: renderToStaticMarkup(
            <div 
              className="flex items-center justify-center font-semibold text-slate-600"
              style={{
                fontSize: `${textHeightPixels}px`,
                lineHeight: '1',
                textShadow: '0 0 2px white, 0 0 4px white',
                opacity: 0.8
              }}
            >
              {houseNumber}
            </div>
          ),
          className: 'address-label',
          iconSize: [textHeightPixels * 3, textHeightPixels],
          iconAnchor: [textHeightPixels * 1.5, textHeightPixels / 2],
        });
        
        return (
          <Marker
            key={`address-${parcel.id}`}
            position={labelPosition}
            icon={addressIcon}
            interactive={false}
          />
        );
      })}
    </>
  );
}

// Component to render popup content based on context
function ParcelPopupContent({ 
  parcel, 
  adminMode, 
  isAdminMap,
  onToggleArea 
}: { 
  parcel: Parcel, 
  adminMode: boolean,
  isAdminMap: boolean,
  onToggleArea?: (parcelId: string) => void
}) {
  const { toast } = useToast();

  const copySurveyLink = () => {
    const baseUrl = window.location.origin;
    const loginUrl = `${baseUrl}/survey?code=${encodeURIComponent(parcel.shortCode || '')}&phrase=${encodeURIComponent(parcel.codePhrase || '')}`;
    navigator.clipboard.writeText(loginUrl);
    toast({
      title: "Survey link copied!",
      description: "Share this link with the property owner",
    });
  };

  const statusLabels = {
    'none': 'No Response',
    'light-green': 'Q1 Support',
    'forest-green': 'Full Support',
  };

  const statusColors = {
    'none': 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
    'light-green': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'forest-green': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  // Standard user mode (not admin)
  if (!adminMode) {
    const hasResponses = parcel.q1Response !== null || parcel.q2Response !== null || parcel.q3Response !== null;
    
    return (
      <div className="p-1.5 min-w-[220px]" data-testid={`popup-user-${parcel.id}`}>
        {parcel.address && <p className="font-semibold text-sm leading-none mb-1">{parcel.address}</p>}
        
        {hasResponses && (
          <div className="text-sm">
            <p className="leading-none mb-0.5"><strong>Q1: Border Care Permission -</strong> {parcel.q1Response === null ? 'No response' : parcel.q1Response ? 'Yes' : 'No'}</p>
            
            <p className="leading-none mb-0.5"><strong>Q2: Property Assistance -</strong> {parcel.q2Response === null ? 'No response' : parcel.q2Response ? 'Yes' : 'No'}</p>
            
            <p className="leading-none mb-0.5"><strong>Q3: Compost Bin Sharing -</strong> {parcel.q3Response === null ? 'No response' : parcel.q3Response ? 'Yes' : 'No'}</p>
            
            {parcel.responseDate && (
              <p className="text-xs text-muted-foreground leading-none mt-1">
                Completed: {new Date(parcel.responseDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
        
        <Link href="/survey">
          <Button 
            size="sm" 
            variant="default" 
            className="w-full mt-1"
            data-testid={`button-participate-${parcel.id}`}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Participate in Survey
          </Button>
        </Link>
      </div>
    );
  }

  // Admin mode - main map or admin map
  return (
    <div className="p-1.5 min-w-[250px]" data-testid={`popup-admin-${parcel.id}`}>
      <div className="mb-1">
        {parcel.address && <p className="font-semibold text-sm leading-none">{parcel.address}</p>}
        <p className="text-xs font-mono text-muted-foreground leading-none">
          ID: {parcel.id}
        </p>
        {parcel.shortCode && (
          <p className="text-xs text-muted-foreground leading-none">
            Code: {parcel.shortCode}
          </p>
        )}
      </div>
      
      {parcel.areaNames && parcel.areaNames.length > 0 && (
        <div className="border-t pt-1 mb-1">
          <p className="text-xs font-semibold text-muted-foreground mb-0.5 leading-none">Area Assignment:</p>
          <div className="flex flex-wrap gap-1">
            {parcel.areaNames.map((areaName, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {areaName}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Only show status badge if not "No Response" in admin map context */}
      {!(isAdminMap && parcel.status === 'none') && (
        <Badge variant="outline" className={`${statusColors[parcel.status]} mb-1`}>
          {statusLabels[parcel.status]}
        </Badge>
      )}

      <div className="text-sm mb-1">
        <p className="leading-none mb-0.5"><strong>Q1: Border Care Permission -</strong> {parcel.q1Response === null ? 'No response' : parcel.q1Response ? 'Yes' : 'No'}</p>
        {parcel.q1Comment && <p className="text-xs text-muted-foreground italic leading-none mb-0.5">"{parcel.q1Comment}"</p>}
        
        <p className="leading-none mb-0.5"><strong>Q2: Property Assistance -</strong> {parcel.q2Response === null ? 'No response' : parcel.q2Response ? 'Yes' : 'No'}</p>
        {parcel.q2Comment && <p className="text-xs text-muted-foreground italic leading-none mb-0.5">"{parcel.q2Comment}"</p>}
        
        <p className="leading-none mb-0.5"><strong>Q3: Compost Bin Sharing -</strong> {parcel.q3Response === null ? 'No response' : parcel.q3Response ? 'Yes' : 'No'}</p>
        {parcel.q3Comment && <p className="text-xs text-muted-foreground italic leading-none mb-0.5">"{parcel.q3Comment}"</p>}
      </div>

      <div className="space-y-1 border-t pt-1">
        {isAdminMap && onToggleArea && (
          <Button
            size="sm"
            variant={parcel.selected ? "destructive" : "default"}
            className="w-full"
            onClick={() => onToggleArea(parcel.id)}
            data-testid={`button-toggle-area-${parcel.id}`}
          >
            {parcel.selected ? (
              <>
                <MinusCircle className="h-3 w-3 mr-1" />
                Remove from Area
              </>
            ) : (
              <>
                <PlusCircle className="h-3 w-3 mr-1" />
                Add to Area
              </>
            )}
          </Button>
        )}
        
        {parcel.shortCode && parcel.codePhrase && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={copySurveyLink}
            data-testid={`button-copy-link-${parcel.id}`}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy Survey Link
          </Button>
        )}
        
        <Link href={`/survey?parcelId=${encodeURIComponent(parcel.id)}`}>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            data-testid={`button-edit-survey-${parcel.id}`}
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit Survey Response
          </Button>
        </Link>
      </div>

      {parcel.responseDate && (
        <p className="text-xs text-muted-foreground border-t pt-1 leading-tight">
          Response date: {new Date(parcel.responseDate).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

const ParcelMap = forwardRef<ParcelMapRef, ParcelMapProps>(({ parcels, center = [42.2808, -83.7430], zoom = 16, onParcelClick, onToggleArea, adminMode = false, isAdminMap = false, fitBounds = false }, ref) => {
  const mapRef = useRef<LeafletMap>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (center: LatLngExpression, zoom: number) => {
      if (mapRef.current) {
        mapRef.current.flyTo(center, zoom, { duration: 0.5 });
      }
    },
    fitBounds: (bounds: [[number, number], [number, number]], padding: number = 50) => {
      if (mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: [padding, padding], duration: 0.5 });
      }
    },
    getCenter: () => mapRef.current?.getCenter(),
    getZoom: () => mapRef.current?.getZoom()
  }));

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
        <MapPositionSaver />
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
              eventHandlers={isAdminMap && onParcelClick ? {
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  onParcelClick(parcel.id);
                }
              } : undefined}
            >
              <Popup>
                <ParcelPopupContent 
                  parcel={parcel}
                  adminMode={adminMode}
                  isAdminMap={isAdminMap}
                  onToggleArea={onToggleArea}
                />
              </Popup>
            </Polygon>
          );
        }
        )}
        <DynamicMarkers 
          parcels={parcels.map(p => ({ ...p, coordinates: swapCoordinates(p.coordinates) }))}
          adminMode={adminMode}
          getParcelCenter={getParcelCenter}
        />
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
});

ParcelMap.displayName = 'ParcelMap';

export default ParcelMap;
