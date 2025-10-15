import AdminTable, { ParcelAdmin } from "@/components/AdminTable";
import AdminLogin from "@/components/AdminLogin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Save, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [appName, setAppName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [centerLat, setCenterLat] = useState('');
  const [centerLng, setCenterLng] = useState('');
  const [zoom, setZoom] = useState('');
  const { toast } = useToast();

  // Check admin session
  const { data: session, isLoading: sessionLoading, refetch: refetchSession } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/session"],
  });

  // Get settings
  const { data: settings, isLoading: settingsLoading } = useQuery<{
    appName: string;
    adminEmail: string;
    centerLat: number;
    centerLng: number;
    defaultZoom: number;
  }>({
    queryKey: ["/api/settings"],
    enabled: !!session?.isAdmin,
  });

  // Load settings into form when fetched
  useEffect(() => {
    if (settings) {
      setAppName(settings.appName || '');
      setAdminEmail(settings.adminEmail || '');
      setCenterLat(settings.centerLat?.toString() || '');
      setCenterLng(settings.centerLng?.toString() || '');
      setZoom(settings.defaultZoom?.toString() || '');
    }
  }, [settings]);

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/admin/logout", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/settings", "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Application settings have been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const filteredParcels = mockParcels.filter(
    (parcel) =>
      parcel.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.codePhrase.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveSettings = () => {
    const settingsData: any = {
      appName,
      adminEmail,
      centerLat: parseFloat(centerLat),
      centerLng: parseFloat(centerLng),
      defaultZoom: parseFloat(zoom),
    };

    // Only include password if it's been changed
    if (adminPassword) {
      settingsData.adminPassword = adminPassword;
    }

    updateSettingsMutation.mutate(settingsData);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (sessionLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session?.isAdmin) {
    return <AdminLogin onLoginSuccess={() => refetchSession()} />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-3">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Configure settings and manage parcel information.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>Configure the application name, admin credentials, and default map view</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="app-name">Application Name</Label>
                <Input
                  id="app-name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="mt-2"
                  data-testid="input-app-name"
                />
              </div>
              <div>
                <Label htmlFor="admin-email">Admin Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="mt-2"
                  data-testid="input-admin-email-setting"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="admin-password">Admin Password (leave empty to keep current)</Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="mt-2"
                placeholder="Enter new password to change"
                data-testid="input-admin-password-setting"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="center-lat">Default Center Latitude</Label>
                <Input
                  id="center-lat"
                  value={centerLat}
                  onChange={(e) => setCenterLat(e.target.value)}
                  className="mt-2"
                  placeholder="42.2808"
                  data-testid="input-center-lat"
                />
              </div>
              <div>
                <Label htmlFor="center-lng">Default Center Longitude</Label>
                <Input
                  id="center-lng"
                  value={centerLng}
                  onChange={(e) => setCenterLng(e.target.value)}
                  className="mt-2"
                  placeholder="-83.7430"
                  data-testid="input-center-lng"
                />
              </div>
              <div>
                <Label htmlFor="zoom">Default Zoom Level</Label>
                <Input
                  id="zoom"
                  value={zoom}
                  onChange={(e) => setZoom(e.target.value)}
                  className="mt-2"
                  placeholder="16"
                  data-testid="input-zoom"
                />
              </div>
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending || settingsLoading}
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parcel Management</CardTitle>
            <CardDescription>Search and view parcel information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by address, nature phrase, or parcel ID..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <AdminTable parcels={filteredParcels} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
