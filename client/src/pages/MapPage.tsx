import ParcelMap, { Parcel } from "@/components/ParcelMap";
import { useQuery } from "@tanstack/react-query";
import { LatLngExpression } from 'leaflet';

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

function calculateStatus(q1?: boolean | null, q2?: boolean | null): ParcelStatus {
  if (!q1) return 'none';
  if (q1 && !q2) return 'light-green';
  return 'forest-green';
}

export default function MapPage() {
  const { data: settings } = useQuery<{
    centerLat: number;
    centerLng: number;
    defaultZoom: number;
  }>({
    queryKey: ["/api/settings"],
  });

  const { data: parcelsData, isLoading } = useQuery<ParcelData[]>({
    queryKey: ["/api/survey/parcels"],
  });

  const center: [number, number] = [
    settings?.centerLat ?? 42.2808,
    settings?.centerLng ?? -83.7430
  ];
  const zoom = settings?.defaultZoom ?? 16;

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
    <div className="h-[calc(100vh-4rem)]">
      <ParcelMap parcels={parcels} center={center} zoom={zoom} />
    </div>
  );
}
