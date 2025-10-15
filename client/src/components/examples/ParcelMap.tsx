import ParcelMap, { Parcel } from '../ParcelMap';

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
];

export default function ParcelMapExample() {
  return (
    <div className="h-screen w-full">
      <ParcelMap parcels={mockParcels} />
    </div>
  );
}
