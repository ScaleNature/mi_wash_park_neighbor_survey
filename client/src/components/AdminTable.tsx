import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface ParcelAdmin {
  id: string;
  address: string;
  codePhrase: string;
  status: 'none' | 'light-green' | 'forest-green';
  responseDate?: string;
}

interface AdminTableProps {
  parcels: ParcelAdmin[];
}

export default function AdminTable({ parcels }: AdminTableProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Code phrase copied to clipboard",
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parcel ID</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Code Phrase</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Response Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parcels.map((parcel) => (
            <TableRow key={parcel.id} data-testid={`row-parcel-${parcel.id}`}>
              <TableCell className="font-mono text-sm">{parcel.id}</TableCell>
              <TableCell>{parcel.address}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-sm">
                    {parcel.codePhrase}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(parcel.codePhrase)}
                    data-testid={`button-copy-${parcel.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColors[parcel.status]}>
                  {statusLabels[parcel.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {parcel.responseDate || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
