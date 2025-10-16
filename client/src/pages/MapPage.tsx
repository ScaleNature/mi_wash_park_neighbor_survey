import ParcelMap, { Parcel } from "@/components/ParcelMap";
import { useQuery } from "@tanstack/react-query";
import { LatLngExpression } from 'leaflet';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from 'lucide-react';

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
  const { data: areas } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState<number>(0);

  const { data: parcelsData, isLoading } = useQuery<ParcelData[]>({
    queryKey: ["/api/survey/parcels"],
  });

  // Use selected area if available, otherwise use first area
  const currentArea = selectedAreaId 
    ? areas?.find(a => a.id === selectedAreaId)
    : areas?.[0];

  const center: [number, number] = [
    currentArea?.centerLat ?? 42.2808,
    currentArea?.centerLng ?? -83.7430
  ];
  const zoom = currentArea?.defaultZoom ?? 16;

  const handleResetView = () => {
    // Force map re-render with current center/zoom
    setMapKey(prev => prev + 1);
  };

  const parcels: Parcel[] = parcelsData?.map(p => ({
    id: p.id,
    coordinates: p.geometry.coordinates as LatLngExpression[][],
    address: p.address || undefined,
    status: calculateStatus(p.q1Response, p.q2Response),
    hasCompost: p.q3Response || false,
  })) || [];

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
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
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
              {areas.map(area => (
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
          <ResetViewButton center={center} zoom={zoom} onReset={handleResetView} />
        </div>
      )}
      <ParcelMap key={mapKey} parcels={parcels} center={center} zoom={zoom} />
    </div>
  );
}

function ResetViewButton({ center, zoom, onReset }: { center: [number, number]; zoom: number; onReset: () => void }) {
  return (
    <Button
      onClick={onReset}
      variant="secondary"
      size="sm"
      className="shadow-md"
      data-testid="button-reset-view"
    >
      <RotateCcw className="h-4 w-4 mr-2" />
      Reset View
    </Button>
  );
}
