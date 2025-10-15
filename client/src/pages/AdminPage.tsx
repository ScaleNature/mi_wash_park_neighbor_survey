import AdminTable, { ParcelAdmin } from "@/components/AdminTable";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

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
  {
    id: 'P-004',
    address: '124 Oak Street',
    codePhrase: 'Wetland Cattail Stand',
    status: 'forest-green',
    responseDate: '2024-03-16',
  },
  {
    id: 'P-005',
    address: '126 Oak Street',
    codePhrase: 'Mesic Forest Fern',
    status: 'light-green',
    responseDate: '2024-03-13',
  },
];

export default function AdminPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredParcels = mockParcels.filter(
    (parcel) =>
      parcel.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.codePhrase.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-serif font-bold mb-3">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            View and manage parcel code phrases and survey responses.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by address, code phrase, or parcel ID..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <AdminTable parcels={filteredParcels} />
      </div>
    </div>
  );
}
