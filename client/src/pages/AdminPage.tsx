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
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [areaCenterLat, setAreaCenterLat] = useState('');
  const [areaCenterLng, setAreaCenterLng] = useState('');
  const [areaZoom, setAreaZoom] = useState('');
  const [areaSelectionRadius, setAreaSelectionRadius] = useState('');
  const [areaDisplayRadius, setAreaDisplayRadius] = useState('');
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
    }
  }, [settings]);

  // Auto-select first area when areas load
  useEffect(() => {
    if (areas.length > 0 && !selectedAreaId) {
      setSelectedAreaId(areas[0].id);
    }
  }, [areas, selectedAreaId]);

  // Load area settings when selected area changes
  useEffect(() => {
    const selectedArea = areas.find(a => a.id === selectedAreaId);
    if (selectedArea) {
      setAreaCenterLat(selectedArea.centerLat.toString());
      setAreaCenterLng(selectedArea.centerLng.toString());
      setAreaZoom(selectedArea.defaultZoom.toString());
      setAreaSelectionRadius(selectedArea.selectionRadiusMeters.toString());
      setAreaDisplayRadius(selectedArea.displayRadiusMeters.toString());
    }
  }, [selectedAreaId, areas]);

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

  // Update area settings mutation
  const updateAreaMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedAreaId) throw new Error("No area selected");
      return await apiRequest("PATCH", `/api/admin/areas/${selectedAreaId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      toast({
        title: "Area settings saved",
        description: "Area settings have been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save area settings",
        variant: "destructive",
      });
    },
  });

  const handleSaveAreaSettings = () => {
    const areaData = {
      centerLat: parseFloat(areaCenterLat),
      centerLng: parseFloat(areaCenterLng),
      defaultZoom: parseFloat(areaZoom),
      selectionRadiusMeters: parseFloat(areaSelectionRadius),
      displayRadiusMeters: parseFloat(areaDisplayRadius),
    };
    updateAreaMutation.mutate(areaData);
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

  // Toggle parcel in/out of area mutation
  const toggleParcelMutation = useMutation({
    mutationFn: async (parcelId: string) => {
      if (!molinArea) throw new Error("No area selected");
      return await apiRequest("POST", `/api/admin/areas/${molinArea.id}/parcels/${parcelId}/toggle`);
    },
    onSuccess: (data: any, parcelId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas", molinArea?.id, "parcels"] });
      toast({
        title: data.inArea ? "Parcel added to area" : "Parcel removed from area",
        description: `Parcel ${parcelId} ${data.inArea ? 'is now' : 'is no longer'} in the Molin Nature Area`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to toggle parcel",
        description: error.message,
      });
    }
  });

  const handleParcelClick = (parcelId: string) => {
    toggleParcelMutation.mutate(parcelId);
  };

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
            <CardDescription>Configure the application name and admin credentials</CardDescription>
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

        {areas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Area Management</CardTitle>
              <CardDescription>Select and configure nature area settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="area-select">Select Area</Label>
                <select
                  id="area-select"
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2"
                  data-testid="select-area"
                >
                  {areas.map(area => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>

              {selectedAreaId && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="area-center-lat">Center Latitude</Label>
                      <Input
                        id="area-center-lat"
                        type="number"
                        step="0.000001"
                        value={areaCenterLat}
                        onChange={(e) => setAreaCenterLat(e.target.value)}
                        className="mt-2"
                        data-testid="input-area-center-lat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="area-center-lng">Center Longitude</Label>
                      <Input
                        id="area-center-lng"
                        type="number"
                        step="0.000001"
                        value={areaCenterLng}
                        onChange={(e) => setAreaCenterLng(e.target.value)}
                        className="mt-2"
                        data-testid="input-area-center-lng"
                      />
                    </div>
                    <div>
                      <Label htmlFor="area-zoom">Default Zoom Level</Label>
                      <Input
                        id="area-zoom"
                        type="number"
                        value={areaZoom}
                        onChange={(e) => setAreaZoom(e.target.value)}
                        className="mt-2"
                        placeholder="16"
                        data-testid="input-area-zoom"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="selection-radius">Selection Radius (meters)</Label>
                      <Input
                        id="selection-radius"
                        type="number"
                        value={areaSelectionRadius}
                        onChange={(e) => setAreaSelectionRadius(e.target.value)}
                        className="mt-2"
                        data-testid="input-selection-radius"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Parcels within this distance are auto-selected</p>
                    </div>
                    <div>
                      <Label htmlFor="display-radius">Display Radius (meters)</Label>
                      <Input
                        id="display-radius"
                        type="number"
                        value={areaDisplayRadius}
                        onChange={(e) => setAreaDisplayRadius(e.target.value)}
                        className="mt-2"
                        data-testid="input-display-radius"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Parcels within this distance are shown on map</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveAreaSettings}
                    disabled={updateAreaMutation.isPending}
                    data-testid="button-save-area-settings"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateAreaMutation.isPending ? "Saving..." : "Save Area Settings"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

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
                  <li>Create an area centered at Molin Nature Area (42.248002, -83.715407)</li>
                  <li>Auto-select parcels within 200m of the center</li>
                  <li>Display all parcels within 5km for admin review</li>
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
                    onParcelClick={handleParcelClick}
                    adminMode={true}
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
