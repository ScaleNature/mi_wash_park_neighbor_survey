import ParcelMap, { Parcel } from "@/components/ParcelMap";
import { useQuery } from "@tanstack/react-query";
import { LatLngExpression } from 'leaflet';
import { useState } from 'react';
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
  q1Response?: boolean | null;
  q2Response?: boolean | null;
  q3Response?: boolean | null;
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
  
  const { data: areas } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>("all");

  const { data: parcelsData, isLoading } = useQuery<ParcelData[]>({
    queryKey: ["/api/survey/parcels"],
  });

  // "all" means show all areas, otherwise use selected area or first area
  const showAllAreas = selectedAreaId === "all";
  const currentArea = showAllAreas 
    ? null
    : (selectedAreaId 
        ? areas?.find(a => a.id === selectedAreaId)
        : areas?.[0]);

  const center: [number, number] = [
    currentArea?.centerLat ?? 42.2808,
    currentArea?.centerLng ?? -83.7430
  ];
  const zoom = currentArea?.defaultZoom ?? 16;

  const parcels: Parcel[] = parcelsData?.map(p => ({
    id: p.id,
    coordinates: p.geometry.coordinates as LatLngExpression[][],
    address: p.address || undefined,
    status: calculateStatus(p.q1Response, p.q2Response),
    hasCompost: p.q3Response || false,
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
          <Select 
            value={selectedAreaId || areas[0]?.id} 
            onValueChange={setSelectedAreaId}
          >
            <SelectTrigger 
              className="w-64 bg-card shadow-md"
              data-testid="select-area"
            >
              <SelectValue placeholder="Select an area" />
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
      <ParcelMap 
        parcels={parcels} 
        center={center} 
        zoom={zoom}
        fitBounds={showAllAreas}
        onParcelClick={handleParcelClick}
      />
    </div>
  );
}
