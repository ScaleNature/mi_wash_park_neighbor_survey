import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Edit, RefreshCw, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

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
}

export default function AdminTable({ parcels }: AdminTableProps) {
  const { toast } = useToast();
  const [editingParcel, setEditingParcel] = useState<ParcelAdmin | null>(null);
  const [editAddress, setEditAddress] = useState('');
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

  const updateAddressMutation = useMutation({
    mutationFn: async ({ id, address }: { id: string; address: string }) => {
      return await apiRequest("PATCH", `/api/admin/parcels/${id}`, { address });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parcels"] });
      setEditingParcel(null);
      toast({
        title: "Address updated",
        description: "Parcel address has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update address",
        variant: "destructive",
      });
    },
  });

  const regeneratePhraseMutation = useMutation({
    mutationFn: async (id: string) => {
      setRegeneratingId(id);
      return await apiRequest("POST", `/api/admin/parcels/${id}/regenerate-phrase`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parcels"] });
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

  const handleEditClick = (parcel: ParcelAdmin) => {
    setEditingParcel(parcel);
    setEditAddress(parcel.address || '');
  };

  const handleSaveAddress = () => {
    if (editingParcel) {
      updateAddressMutation.mutate({ id: editingParcel.id, address: editAddress });
    }
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyLoginLink(parcel)}
                      data-testid={`button-copy-login-${parcel.id}`}
                      title="Copy login link"
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditClick(parcel)}
                      data-testid={`button-edit-${parcel.id}`}
                      title="Edit address"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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

      <Dialog open={!!editingParcel} onOpenChange={(open) => !open && setEditingParcel(null)}>
        <DialogContent data-testid="dialog-edit-address">
          <DialogHeader>
            <DialogTitle>Edit Parcel Address</DialogTitle>
            <DialogDescription>
              Update the street address for parcel {editingParcel?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-address">Street Address</Label>
              <Input
                id="edit-address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="e.g., 123 Oak Street"
                className="mt-2"
                data-testid="input-edit-address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingParcel(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAddress}
              disabled={updateAddressMutation.isPending}
              data-testid="button-save-address"
            >
              {updateAddressMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
