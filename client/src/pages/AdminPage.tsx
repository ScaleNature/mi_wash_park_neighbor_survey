import AdminTable, { ParcelAdmin } from "@/components/AdminTable";
import AdminLogin from "@/components/AdminLogin";
import ParcelMap from "@/components/ParcelMap";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Save, LogOut, Leaf, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Area, Parcel } from "@shared/schema";

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

  // Get areas
  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
    enabled: !!session?.isAdmin,
  });

  // Get parcels with full geometry
  const { data: parcels = [] } = useQuery<Parcel[]>({
    queryKey: ["/api/parcels"],
    enabled: !!session?.isAdmin,
  });

  // Get parcels in the first area (if it exists)
  const molinArea = areas.length > 0 ? areas[0] : null;
  const { data: selectedParcelIds = [] } = useQuery<string[]>({
    queryKey: ["/api/areas", molinArea?.id, "parcels"],
    enabled: !!session?.isAdmin && !!molinArea,
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

  // Initialize Molin Area mutation
  const initializeMolinAreaMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/initialize-molin-area");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parcels"] });
      toast({
        title: "Molin Nature Area initialized",
        description: `Loaded ${data.parcelCount} parcels, ${data.selectedCount} within 200m selection area`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to initialize Molin Area",
        description: error.message,
      });
    }
  });

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Helper to get parcel centroid
  const getParcelCentroid = (geometry: any): { lat: number; lng: number } | null => {
    if (!geometry || !geometry.coordinates) return null;
    
    const ring = Array.isArray(geometry.coordinates[0]) ? geometry.coordinates[0] : geometry.coordinates;
    
    if (!ring || ring.length === 0) return null;
    
    let sumLat = 0, sumLng = 0;
    ring.forEach((point: number[]) => {
      if (Array.isArray(point) && point.length >= 2) {
        sumLng += point[0];
        sumLat += point[1];
      }
    });
    
    return {
      lat: sumLat / ring.length,
      lng: sumLng / ring.length
    };
  };

  // Filter parcels within display radius
  const parcelsInDisplayRadius = molinArea ? parcels.filter(parcel => {
    const centroid = getParcelCentroid(parcel.geometry);
    if (!centroid) return false;
    
    const distance = calculateDistance(
      molinArea.centerLat,
      molinArea.centerLng,
      centroid.lat,
      centroid.lng
    );
    
    return distance <= molinArea.displayRadiusMeters;
  }) : [];

  // Convert parcels for map display
  const mapParcels = parcelsInDisplayRadius.map(parcel => ({
    id: parcel.id,
    coordinates: (parcel.geometry as any)?.coordinates || [],
    address: parcel.address || undefined,
    status: (selectedParcelIds.includes(parcel.id) ? 'forest-green' : 'none') as 'none' | 'light-green' | 'forest-green',
    hasCompost: false,
  }));

  // Convert full Parcels to ParcelAdmin for the table
  const adminParcels: ParcelAdmin[] = parcels.map(parcel => {
    const hasQ1 = parcel.q1Response === true;
    const hasQ2 = parcel.q2Response === true;
    
    let status: 'none' | 'light-green' | 'forest-green' = 'none';
    if (hasQ1 && hasQ2) {
      status = 'forest-green';
    } else if (hasQ1) {
      status = 'light-green';
    }
    
    return {
      id: parcel.id,
      address: parcel.address,
      codePhrase: parcel.codePhrase,
      status,
      responseDate: parcel.responseDate?.toString(),
    };
  });

  const filteredParcels = adminParcels.filter(
    (parcel) =>
      (parcel.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.codePhrase.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {areas.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Initialize Molin Nature Area</CardTitle>
              <CardDescription>Set up the Molin Nature Area with parcels and selection boundaries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm mb-3">
                  The Molin Nature Area initialization will:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Load parcels from the pre-prepared GeoJSON file</li>
                  <li>Create an area centered at Molin Nature Area (42.247891, -83.715445)</li>
                  <li>Auto-select parcels within 200m of the center</li>
                  <li>Display all parcels within 1km for admin review</li>
                </ul>
              </div>
              <Button
                onClick={() => initializeMolinAreaMutation.mutate()}
                disabled={initializeMolinAreaMutation.isPending}
                variant="default"
                size="lg"
                data-testid="button-initialize-molin-area"
              >
                <Leaf className="h-5 w-5 mr-2" />
                {initializeMolinAreaMutation.isPending ? "Initializing..." : "Initialize Molin Area"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Area: {molinArea?.name}</CardTitle>
                <CardDescription>
                  Showing {parcelsInDisplayRadius.length} parcels within {molinArea?.displayRadiusMeters}m display radius, 
                  {selectedParcelIds.length} parcels selected within {molinArea?.selectionRadiusMeters}m
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[500px] rounded-md overflow-hidden border">
                  <ParcelMap 
                    parcels={mapParcels}
                    center={molinArea ? [molinArea.centerLat, molinArea.centerLng] : undefined}
                    zoom={15}
                  />
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-primary" />
                    <span>Leaf markers indicate parcels selected in the area</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Regular polygons show nearby parcels</span>
                  </div>
                </div>
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
          </>
        )}
      </div>
    </div>
  );
}
