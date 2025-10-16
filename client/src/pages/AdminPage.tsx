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
  const [areaCenterLocation, setAreaCenterLocation] = useState('');
  const [areaZoom, setAreaZoom] = useState('');
  const [areaDisplayRadius, setAreaDisplayRadius] = useState('');
  
  // New area form state
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaCenterLocation, setNewAreaCenterLocation] = useState('');
  const [newAreaZoom, setNewAreaZoom] = useState('16');
  const [newAreaDisplayRadius, setNewAreaDisplayRadius] = useState('5000');
  
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

  // Get parcels within display radius of selected area (server-side filtered)
  const { data: parcels = [] } = useQuery<Parcel[]>({
    queryKey: ["/api/admin/areas", selectedAreaId, "map-parcels"],
    enabled: !!session?.isAdmin && !!selectedAreaId,
  });

  // Get the selected area
  const selectedArea = areas.find(a => a.id === selectedAreaId) || null;
  const { data: selectedParcelIds = [] } = useQuery<string[]>({
    queryKey: ["/api/areas", selectedAreaId, "parcels"],
    enabled: !!session?.isAdmin && !!selectedAreaId,
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
      setAreaCenterLocation(`${selectedArea.centerLat},${selectedArea.centerLng}`);
      setAreaZoom(selectedArea.defaultZoom.toString());
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
    const [lat, lng] = areaCenterLocation.split(',').map(s => s.trim());
    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    
    if (isNaN(centerLat) || isNaN(centerLng)) {
      toast({
        title: "Invalid coordinates",
        description: "Please enter coordinates in 'lat,lng' format (e.g., 42.248002,-83.715407)",
        variant: "destructive",
      });
      return;
    }
    
    const areaData = {
      centerLat,
      centerLng,
      defaultZoom: parseFloat(areaZoom),
      displayRadiusMeters: parseFloat(areaDisplayRadius),
    };
    updateAreaMutation.mutate(areaData);
  };

  // Create new area mutation
  const createAreaMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/areas", data);
      return await res.json();
    },
    onSuccess: (newArea: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setSelectedAreaId(newArea.id);
      setNewAreaName('');
      setNewAreaCenterLocation('');
      setNewAreaZoom('16');
      setNewAreaDisplayRadius('5000');
      toast({
        title: "Area created",
        description: `${newArea.name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create area",
        description: error.message || "Failed to create area",
        variant: "destructive",
      });
    },
  });

  const handleCreateArea = () => {
    const [lat, lng] = newAreaCenterLocation.split(',').map(s => s.trim());
    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    
    if (isNaN(centerLat) || isNaN(centerLng)) {
      toast({
        title: "Invalid coordinates",
        description: "Please enter coordinates in 'lat,lng' format (e.g., 42.248002,-83.715407)",
        variant: "destructive",
      });
      return;
    }
    
    const areaData = {
      name: newAreaName,
      centerLat,
      centerLng,
      defaultZoom: parseFloat(newAreaZoom),
      displayRadiusMeters: parseFloat(newAreaDisplayRadius),
    };
    createAreaMutation.mutate(areaData);
  };


  // Toggle parcel in/out of area mutation
  const toggleParcelMutation = useMutation({
    mutationFn: async (parcelId: string) => {
      if (!selectedAreaId) throw new Error("No area selected");
      const res = await apiRequest("POST", `/api/admin/areas/${selectedAreaId}/parcels/${parcelId}/toggle`);
      return await res.json();
    },
    onSuccess: (data: any, parcelId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas", selectedAreaId, "parcels"] });
      toast({
        title: data.inArea ? "Parcel added to area" : "Parcel removed from area",
        description: `Parcel ${parcelId} ${data.inArea ? 'is now' : 'is no longer'} in the area`,
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

  // Parcels are already filtered server-side, just convert them for map display
  // In admin mode, all parcels are gray, but selected ones get a leaf marker
  const mapParcels = parcels.map(parcel => ({
    id: parcel.id,
    coordinates: (parcel.geometry as any)?.coordinates || [],
    address: parcel.address || undefined,
    status: 'none' as 'none' | 'light-green' | 'forest-green',
    hasCompost: false,
    selected: selectedParcelIds.includes(parcel.id),
  }));

  // Convert full Parcels to ParcelAdmin for the table
  // Only show parcels that are in the selected area
  const parcelsToShow = selectedAreaId 
    ? parcels.filter(p => selectedParcelIds.includes(p.id))
    : [];
    
  const adminParcels: ParcelAdmin[] = parcelsToShow.map(parcel => {
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

        <Card>
          <CardHeader>
            <CardTitle>Area Management</CardTitle>
            <CardDescription>
              {areas.length > 0 ? "Select an area to manage or create a new one" : "Create your first nature area"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {areas.length > 0 && (
              <div>
                <Label htmlFor="area-select">Select Existing Area</Label>
                <select
                  id="area-select"
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2"
                  data-testid="select-area"
                >
                  <option value="">-- No area selected --</option>
                  {areas.map(area => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedAreaId && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">Edit Selected Area</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="area-center-location">Center Location (lat,lng)</Label>
                    <Input
                      id="area-center-location"
                      type="text"
                      value={areaCenterLocation}
                      onChange={(e) => setAreaCenterLocation(e.target.value)}
                      className="mt-2"
                      placeholder="42.248002,-83.715407"
                      data-testid="input-area-center-location"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Right-click map to copy coordinates</p>
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

                <Button
                  onClick={handleSaveAreaSettings}
                  disabled={updateAreaMutation.isPending}
                  data-testid="button-save-area-settings"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateAreaMutation.isPending ? "Saving..." : "Save Area Settings"}
                </Button>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Create New Area</h3>
              <div>
                <Label htmlFor="new-area-name">Area Name</Label>
                <Input
                  id="new-area-name"
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="mt-2"
                  placeholder="e.g., Molin Nature Area"
                  data-testid="input-new-area-name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-area-center-location">Center Location (lat,lng)</Label>
                  <Input
                    id="new-area-center-location"
                    type="text"
                    value={newAreaCenterLocation}
                    onChange={(e) => setNewAreaCenterLocation(e.target.value)}
                    className="mt-2"
                    placeholder="42.248002,-83.715407"
                    data-testid="input-new-area-center-location"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Right-click map to copy coordinates</p>
                </div>
                <div>
                  <Label htmlFor="new-area-zoom">Default Zoom Level</Label>
                  <Input
                    id="new-area-zoom"
                    type="number"
                    value={newAreaZoom}
                    onChange={(e) => setNewAreaZoom(e.target.value)}
                    className="mt-2"
                    placeholder="16"
                    data-testid="input-new-area-zoom"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="new-display-radius">Display Radius (meters)</Label>
                <Input
                  id="new-display-radius"
                  type="number"
                  value={newAreaDisplayRadius}
                  onChange={(e) => setNewAreaDisplayRadius(e.target.value)}
                  className="mt-2"
                  placeholder="5000"
                  data-testid="input-new-display-radius"
                />
                <p className="text-xs text-muted-foreground mt-1">Parcels within this distance will be shown on map</p>
              </div>

              <Button
                onClick={handleCreateArea}
                disabled={
                  createAreaMutation.isPending || 
                  !newAreaName || 
                  !newAreaCenterLocation ||
                  isNaN(parseFloat(newAreaZoom)) ||
                  isNaN(parseFloat(newAreaDisplayRadius))
                }
                data-testid="button-create-area"
              >
                <Save className="h-4 w-4 mr-2" />
                {createAreaMutation.isPending ? "Creating..." : "Create Area"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Map View</CardTitle>
            <CardDescription>
              {selectedAreaId && selectedArea ? (
                `Showing ${parcels.length} parcels within ${selectedArea.displayRadiusMeters}m display radius, ${selectedParcelIds.length} parcels selected in area`
              ) : (
                "Select an area to view parcels on the map"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[500px] rounded-md overflow-hidden border">
              <ParcelMap 
                parcels={selectedAreaId ? mapParcels : []}
                center={selectedArea ? [selectedArea.centerLat, selectedArea.centerLng] : undefined}
                zoom={selectedArea?.defaultZoom || 15}
                onParcelClick={handleParcelClick}
                adminMode={true}
              />
            </div>
            {selectedAreaId && (
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
            )}
          </CardContent>
        </Card>

        {selectedAreaId && (
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
        )}
      </div>
    </div>
  );
}
