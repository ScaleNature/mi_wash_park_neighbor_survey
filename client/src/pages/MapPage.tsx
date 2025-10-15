import ParcelMap, { Parcel } from "@/components/ParcelMap";
import { useQuery } from "@tanstack/react-query";

const mockParcels: Parcel[] = [
  {
    id: '1',
    coordinates: [[[42.2815, -83.7435], [42.2815, -83.7425], [42.2810, -83.7425], [42.2810, -83.7435]]],
    address: '123 Oak Street',
    status: 'forest-green',
    hasCompost: true,
  },
  {
    id: '2',
    coordinates: [[[42.2810, -83.7435], [42.2810, -83.7425], [42.2805, -83.7425], [42.2805, -83.7435]]],
    address: '125 Oak Street',
    status: 'light-green',
    hasCompost: false,
  },
  {
    id: '3',
    coordinates: [[[42.2805, -83.7435], [42.2805, -83.7425], [42.2800, -83.7425], [42.2800, -83.7435]]],
    address: '127 Oak Street',
    status: 'none',
    hasCompost: false,
  },
  {
    id: '4',
    coordinates: [[[42.2815, -83.7445], [42.2815, -83.7435], [42.2810, -83.7435], [42.2810, -83.7445]]],
    address: '124 Oak Street',
    status: 'forest-green',
    hasCompost: false,
  },
  {
    id: '5',
    coordinates: [[[42.2810, -83.7445], [42.2810, -83.7435], [42.2805, -83.7435], [42.2805, -83.7445]]],
    address: '126 Oak Street',
    status: 'light-green',
    hasCompost: true,
  },
];

export default function MapPage() {
  const { data: settings } = useQuery<{
    centerLat: number;
    centerLng: number;
    defaultZoom: number;
  }>({
    queryKey: ["/api/settings"],
  });

  const center: [number, number] = [
    settings?.centerLat ?? 42.2808,
    settings?.centerLng ?? -83.7430
  ];
  const zoom = settings?.defaultZoom ?? 16;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ParcelMap parcels={mockParcels} center={center} zoom={zoom} />
    </div>
  );
}
