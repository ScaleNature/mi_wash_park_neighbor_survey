import AdminTable, { ParcelAdmin } from '../AdminTable';

const mockParcels: ParcelAdmin[] = [
  {
    id: 'P-001',
    address: '123 Oak Street',
    codePhrase: 'Woodland Trillium Bloom',
    status: 'forest-green',
    responseDate: '2024-03-15',
  },
  {
    id: 'P-002',
    address: '125 Oak Street',
    codePhrase: 'Prairie Blazing Star',
    status: 'light-green',
    responseDate: '2024-03-14',
  },
  {
    id: 'P-003',
    address: '127 Oak Street',
    codePhrase: 'Savanna White Oak',
    status: 'none',
  },
];

export default function AdminTableExample() {
  return (
    <div className="p-6">
      <AdminTable parcels={mockParcels} />
    </div>
  );
}
