import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Edit, RefreshCw, Link as LinkIcon, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";

export interface ParcelAdmin {
  id: string;
  shortCode?: string | null;
  address: string | null;
  codePhrase: string;
  status: 'none' | 'light-green' | 'forest-green';
  responseDate?: string;
  q1Response?: boolean | null;
  q2Response?: boolean | null;
  q3Response?: boolean | null;
}

interface AdminTableProps {
  parcels: ParcelAdmin[];
  onLocateParcel?: (parcelId: string) => void;
}

export default function AdminTable({ parcels, onLocateParcel }: AdminTableProps) {
  const { toast } = useToast();
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Code phrase copied to clipboard",
    });
  };

  const copyLoginLink = (parcel: ParcelAdmin) => {
    const baseUrl = window.location.origin;
    const loginUrl = `${baseUrl}/survey?code=${encodeURIComponent(parcel.shortCode || '')}&phrase=${encodeURIComponent(parcel.codePhrase)}`;
    navigator.clipboard.writeText(loginUrl);
    toast({
      title: "Login link copied!",
      description: "Share this link with the parcel owner",
    });
  };

  const regeneratePhraseMutation = useMutation({
    mutationFn: async (id: string) => {
      setRegeneratingId(id);
      return await apiRequest("POST", `/api/admin/parcels/${id}/regenerate-phrase`);
    },
    onSuccess: () => {
      // Invalidate all admin area queries to refresh the table
      queryClient.invalidateQueries({ queryKey: ["/api/admin/areas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setRegeneratingId(null);
      toast({
        title: "Nature phrase regenerated",
        description: "A new nature phrase has been generated for this parcel",
      });
    },
    onError: (error: any) => {
      setRegeneratingId(null);
      toast({
        title: "Regeneration failed",
        description: error.message || "Failed to regenerate phrase",
        variant: "destructive",
      });
    },
  });

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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Nature Phrase</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Q1</TableHead>
              <TableHead>Q2</TableHead>
              <TableHead>Q3</TableHead>
              <TableHead>Response Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcels.map((parcel) => (
              <TableRow key={parcel.id} data-testid={`row-parcel-${parcel.id}`}>
                <TableCell className="font-bold text-lg">{parcel.shortCode || '-'}</TableCell>
                <TableCell>{parcel.address || <span className="text-muted-foreground">-</span>}</TableCell>
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
                <TableCell className="text-sm text-center">
                  {parcel.q1Response == null ? '-' : parcel.q1Response ? '✓' : '✗'}
                </TableCell>
                <TableCell className="text-sm text-center">
                  {parcel.q2Response == null ? '-' : parcel.q2Response ? '✓' : '✗'}
                </TableCell>
                <TableCell className="text-sm text-center">
                  {parcel.q3Response == null ? '-' : parcel.q3Response ? '✓' : '✗'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {parcel.responseDate || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {onLocateParcel && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onLocateParcel(parcel.id)}
                        data-testid={`button-locate-${parcel.id}`}
                        title="Locate on map"
                      >
                        <MapPin className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyLoginLink(parcel)}
                      data-testid={`button-copy-login-${parcel.id}`}
                      title="Copy login link"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Link href={`/survey?parcelId=${encodeURIComponent(parcel.id)}`}>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-edit-${parcel.id}`}
                        title="View/edit survey"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => regeneratePhraseMutation.mutate(parcel.id)}
                      data-testid={`button-regenerate-${parcel.id}`}
                      disabled={regeneratingId === parcel.id}
                      title="Regenerate nature phrase"
                    >
                      <RefreshCw className={`h-4 w-4 ${regeneratingId === parcel.id ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
