import AdminTable, { ParcelAdmin } from "@/components/AdminTable";
import AdminLogin from "@/components/AdminLogin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Save, LogOut, Download, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [appName, setAppName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [centerLat, setCenterLat] = useState('');
  const [centerLng, setCenterLng] = useState('');
  const [zoom, setZoom] = useState('');
  const [areaMode, setAreaMode] = useState<'center' | 'bbox'>('center');
  const [radiusMeters, setRadiusMeters] = useState('');
  const [bboxTopLeft, setBboxTopLeft] = useState('');
  const [bboxBottomRight, setBboxBottomRight] = useState('');
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
    areaMode?: string;
    radiusMeters?: number;
    boundingBoxTopLeft?: string;
    boundingBoxBottomRight?: string;
  }>({
    queryKey: ["/api/settings"],
    enabled: !!session?.isAdmin,
  });

  // Get parcels
  const { data: parcels = [] } = useQuery<ParcelAdmin[]>({
    queryKey: ["/api/parcels"],
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
      setAreaMode((settings.areaMode as 'center' | 'bbox') || 'center');
      setRadiusMeters(settings.radiusMeters?.toString() || '');
      setBboxTopLeft(settings.boundingBoxTopLeft || '');
      setBboxBottomRight(settings.boundingBoxBottomRight || '');
    }
  }, [settings]);

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
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
      return await apiRequest("PATCH", "/api/admin/settings", data);
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

  const filteredParcels = parcels.filter(
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
      areaMode,
    };

    // Only include password if it's been changed
    if (adminPassword) {
      settingsData.adminPassword = adminPassword;
    }

    // Include area-specific fields based on mode
    if (areaMode === 'center') {
      const radiusValue = radiusMeters ? parseFloat(radiusMeters) : null;
      settingsData.radiusMeters = radiusValue && !isNaN(radiusValue) ? radiusValue : null;
      settingsData.boundingBoxTopLeft = null;
      settingsData.boundingBoxBottomRight = null;
    } else {
      settingsData.radiusMeters = null;
      settingsData.boundingBoxTopLeft = bboxTopLeft || null;
      settingsData.boundingBoxBottomRight = bboxBottomRight || null;
    }

    updateSettingsMutation.mutate(settingsData);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Load parcels mutation
  const loadParcelsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/load-parcels");
    },
    onSuccess: (data: any) => {
      const count = data?.count ?? 0;
      toast({
        title: count > 0 ? "Parcels loaded successfully" : "No parcels found",
        description: count > 0 
          ? `Loaded ${count} parcels from Washtenaw County GIS`
          : "No parcels found in the specified area. Try adjusting the area settings.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/parcels"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to load parcels",
        description: error.message,
      });
    },
  });

  // Upload parcels mutation
  const uploadParcelsMutation = useMutation({
    mutationFn: async (features: any[]) => {
      return await apiRequest("POST", "/api/admin/upload-parcels", { features });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parcels"] });
      toast({
        title: "Parcels uploaded successfully",
        description: data.message || `Loaded ${data.count} parcels from file`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to upload parcels",
        description: error.message,
      });
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let data;

      // Try to parse as JSON/GeoJSON
      try {
        data = JSON.parse(text);
      } catch {
        toast({
          variant: "destructive",
          title: "Invalid file format",
          description: "Please upload a valid GeoJSON or JSON file",
        });
        return;
      }

      // Extract features array
      let features;
      if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        features = data.features;
      } else if (Array.isArray(data)) {
        features = data;
      } else if (data.features && Array.isArray(data.features)) {
        features = data.features;
      } else {
        toast({
          variant: "destructive",
          title: "Invalid file structure",
          description: "Expected GeoJSON FeatureCollection or features array",
        });
        return;
      }

      uploadParcelsMutation.mutate(features);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error reading file",
        description: error.message,
      });
    }

    // Reset file input
    event.target.value = '';
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

            <div className="space-y-4">
              <div>
                <Label className="text-base">Area Definition (click map to copy coordinates)</Label>
                <p className="text-sm text-muted-foreground mb-3">Define the geographic area for parcel identification</p>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="center"
                      checked={areaMode === 'center'}
                      onChange={(e) => setAreaMode(e.target.value as 'center' | 'bbox')}
                      className="w-4 h-4"
                      data-testid="radio-area-center"
                    />
                    <span>Center + Radius</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="bbox"
                      checked={areaMode === 'bbox'}
                      onChange={(e) => setAreaMode(e.target.value as 'center' | 'bbox')}
                      className="w-4 h-4"
                      data-testid="radio-area-bbox"
                    />
                    <span>Bounding Box</span>
                  </label>
                </div>
              </div>

              {areaMode === 'center' ? (
                <div>
                  <Label htmlFor="radius">Radius (meters)</Label>
                  <Input
                    id="radius"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(e.target.value)}
                    className="mt-2"
                    placeholder="500"
                    data-testid="input-radius"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Distance from center point in meters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bbox-top-left">Top-Left Corner (lat, lng)</Label>
                    <Input
                      id="bbox-top-left"
                      value={bboxTopLeft}
                      onChange={(e) => setBboxTopLeft(e.target.value)}
                      className="mt-2"
                      placeholder="42.2820, -83.7440"
                      data-testid="input-bbox-top-left"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bbox-bottom-right">Bottom-Right Corner (lat, lng)</Label>
                    <Input
                      id="bbox-bottom-right"
                      value={bboxBottomRight}
                      onChange={(e) => setBboxBottomRight(e.target.value)}
                      className="mt-2"
                      placeholder="42.2800, -83.7420"
                      data-testid="input-bbox-bottom-right"
                    />
                  </div>
                </div>
              )}
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
            <div className="space-y-3">
              <div className="flex gap-3 items-center">
                <Button
                  onClick={() => loadParcelsMutation.mutate()}
                  disabled={loadParcelsMutation.isPending || !settings}
                  variant="default"
                  data-testid="button-load-parcels"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {loadParcelsMutation.isPending ? "Loading..." : "Load Parcels from GIS"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Fetch parcels from Washtenaw County based on area settings
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <label htmlFor="file-upload">
                  <Button
                    variant="outline"
                    disabled={uploadParcelsMutation.isPending}
                    asChild
                    data-testid="button-upload-parcels"
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadParcelsMutation.isPending ? "Uploading..." : "Upload Parcel File"}
                    </span>
                  </Button>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".json,.geojson"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-upload-file"
                />
                <p className="text-sm text-muted-foreground">
                  Upload your local GeoJSON parcel data file
                </p>
              </div>
            </div>
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
