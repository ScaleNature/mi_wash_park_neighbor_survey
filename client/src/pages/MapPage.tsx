import ParcelMap, { Parcel, ParcelMapRef } from "@/components/ParcelMap";
import { useQuery } from "@tanstack/react-query";
import { LatLngExpression } from 'leaflet';
import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from 'wouter';

type ParcelStatus = 'none' | 'light-green' | 'forest-green';

interface ParcelData {
  id: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  address?: string | null;
  shortCode?: string | null;
  codePhrase?: string | null;
  q1Response?: boolean | null;
  q1Comment?: string | null;
  q2Response?: boolean | null;
  q2Comment?: string | null;
  q3Response?: boolean | null;
  q3Comment?: string | null;
  responseDate?: string | null;
}

interface Area {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  displayRadiusMeters: number;
}

function calculateStatus(q1?: boolean | null, q2?: boolean | null): ParcelStatus {
  if (!q1) return 'none';
  if (q1 && !q2) return 'light-green';
  return 'forest-green';
}

export default function MapPage() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<ParcelMapRef>(null);
  
  // Check if user is logged in as admin
  const { data: session } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/session"],
  });

  const { data: areas } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const { data: parcelsData, isLoading } = useQuery<ParcelData[]>({
    queryKey: ["/api/survey/parcels"],
  });

  // Load saved position from localStorage on initial mount, or use default center
  const [savedMapPosition] = useState<{center: [number, number], zoom: number} | null>(() => {
    try {
      const saved = localStorage.getItem('mapPosition');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const center: [number, number] = savedMapPosition
    ? savedMapPosition.center
    : [42.2808, -83.7430];
  
  const zoom = savedMapPosition ? savedMapPosition.zoom : 16;

  // Jump to area when selected from dropdown
  const handleJumpToArea = (value: string) => {
    if (!mapRef.current) return;
    
    if (value === "all") {
      // Fit bounds to show all parcels
      if (parcelsData && parcelsData.length > 0) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        
        parcelsData.forEach(parcel => {
          const coords = parcel.geometry.coordinates;
          coords.forEach(polygon => {
            polygon.forEach(coord => {
              const [lng, lat] = coord as [number, number];
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
              minLng = Math.min(minLng, lng);
              maxLng = Math.max(maxLng, lng);
            });
          });
        });
        
        if (minLat !== Infinity && maxLat !== -Infinity) {
          mapRef.current.fitBounds([[minLat, minLng], [maxLat, maxLng]], 50);
        }
      }
    } else {
      // Jump to specific area
      const area = areas?.find(a => a.id === value);
      if (area) {
        mapRef.current.flyTo([area.centerLat, area.centerLng], area.defaultZoom);
      }
    }
  };

  // Create a map of parcelId to area names
  const parcelToAreasMap = new Map<string, string[]>();
  if (areas) {
    areas.forEach(area => {
      // We'll need to get parcel IDs for each area from the backend
      // For now, we can only show area names for admin users who can see the area assignments
    });
  }

  const parcels: Parcel[] = parcelsData?.map(p => ({
    id: p.id,
    coordinates: p.geometry.coordinates as LatLngExpression[][],
    address: p.address || undefined,
    shortCode: p.shortCode || undefined,
    codePhrase: p.codePhrase || undefined,
    status: calculateStatus(p.q1Response, p.q2Response),
    hasCompost: p.q3Response || false,
    q1Response: p.q1Response,
    q1Comment: p.q1Comment || undefined,
    q2Response: p.q2Response,
    q2Comment: p.q2Comment || undefined,
    q3Response: p.q3Response,
    q3Comment: p.q3Comment || undefined,
    responseDate: p.responseDate || undefined,
    areaNames: parcelToAreasMap.get(p.id) || [],
  })) || [];


  const handleParcelClick = (parcelId: string) => {
    setLocation(`/survey?parcelId=${encodeURIComponent(parcelId)}`);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      {areas && areas.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000]">
          <Select onValueChange={handleJumpToArea}>
            <SelectTrigger 
              className="w-64 bg-card shadow-md"
              data-testid="select-area"
            >
              <SelectValue placeholder="Jump To..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem 
                value="all"
                data-testid="select-area-all"
              >
                Show All Areas
              </SelectItem>
              {[...areas].sort((a, b) => a.name.localeCompare(b.name)).map(area => (
                <SelectItem 
                  key={area.id} 
                  value={area.id}
                  data-testid={`select-area-${area.id}`}
                >
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* PUBLIC MAP VIEW: Always shows colored parcels based on survey status (green = support, gray = no response).
          When an admin is logged in, the colors remain but popup content gains admin controls (edit, copy link).
          This is NOT the admin dashboard - that's at /admin with uniform gray parcels for area management. */}
      <ParcelMap 
        ref={mapRef}
        parcels={parcels} 
        center={center} 
        zoom={zoom}
        adminMode={session?.isAdmin || false}
        onParcelClick={session?.isAdmin ? handleParcelClick : undefined}
      />
    </div>
  );
}
