import AdminTable, { ParcelAdmin } from "@/components/AdminTable";
import AdminLogin from "@/components/AdminLogin";
import ParcelMap, { ParcelMapRef } from "@/components/ParcelMap";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Save, LogOut, Leaf, MapPin, RefreshCw, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
  const [areaName, setAreaName] = useState('');
  const [areaCenterLocation, setAreaCenterLocation] = useState('');
  const [areaZoom, setAreaZoom] = useState('');
  const [areaDisplayRadius, setAreaDisplayRadius] = useState('');
  
  // New area form state
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaCenterLocation, setNewAreaCenterLocation] = useState('');
  const [newAreaZoom, setNewAreaZoom] = useState('16');
  const [newAreaDisplayRadius, setNewAreaDisplayRadius] = useState('500');
  
  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Map ref for locate parcel feature
  const mapRef = useRef<ParcelMapRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
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

  // Get the selected area
  const selectedArea = areas.find(a => a.id === selectedAreaId) || null;
  
  // Get list of assigned parcel IDs (Step 1 data)
  const { data: selectedParcelIds = [], isLoading: selectedIdsLoading } = useQuery<string[]>({
    queryKey: ["/api/areas", selectedAreaId, "parcels"],
    enabled: !!session?.isAdmin && !!selectedAreaId,
  });

  // Get area statistics
  const { data: areaStatistics, isLoading: statisticsLoading } = useQuery<{
    totalParcels: number;
    q1YesCount: number;
    q1Percentage: number;
    q2YesCount: number;
    q2Percentage: number;
    q3YesCount: number;
    q3Percentage: number;
  }>({
    queryKey: ["/api/areas", selectedAreaId, "statistics"],
    enabled: !!session?.isAdmin && !!selectedAreaId,
  });

  // Fetch all parcels (assigned + optional) from the server in one call
  const { data: allMapParcels = [], isLoading: allParcelsLoading, isFetching: allParcelsFetching } = useQuery<Parcel[]>({
    queryKey: ["/api/admin/areas", selectedAreaId, "map-parcels"],
    enabled: !!session?.isAdmin && !!selectedAreaId,
    staleTime: 0,
    gcTime: 0,
  });

  // Step 1: Extract assigned parcels (only after selectedParcelIds is loaded)
  const assignedParcels = selectedIdsLoading ? [] : allMapParcels.filter(p => selectedParcelIds.includes(p.id));
  const assignedLoading = selectedIdsLoading || allParcelsLoading;

  // Step 2: Extract optional parcels (only after selectedParcelIds is loaded)
  const optionalParcels = selectedIdsLoading ? [] : allMapParcels.filter(p => !selectedParcelIds.includes(p.id));
  const optionalLoading = selectedIdsLoading || allParcelsLoading;

  // Combine for map display (only show parcels after selectedParcelIds is loaded to prevent incorrect styling)
  const parcels = selectedIdsLoading ? [] : allMapParcels;
  const parcelsLoading = selectedIdsLoading || allParcelsLoading;
  const parcelsFetching = allParcelsFetching;

  // Load settings into form when fetched
  useEffect(() => {
    if (settings) {
      setAppName(settings.appName || '');
      setAdminEmail(settings.adminEmail || '');
    }
  }, [settings]);


  // Load area settings when selected area changes
  useEffect(() => {
    const selectedArea = areas.find(a => a.id === selectedAreaId);
    if (selectedArea) {
      setAreaName(selectedArea.name);
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
      // Invalidate map parcels query to reload with new display radius
      queryClient.invalidateQueries({ queryKey: ["/api/admin/areas", selectedAreaId, "map-parcels"] });
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
    if (!areaName.trim()) {
      toast({
        title: "Invalid name",
        description: "Area name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
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
      name: areaName,
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
      setNewAreaDisplayRadius('500');
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

  // Delete area mutation
  const deleteAreaMutation = useMutation({
    mutationFn: async (areaId: string) => {
      await apiRequest("DELETE", `/api/admin/areas/${areaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setSelectedAreaId('');
      setShowDeleteDialog(false);
      toast({
        title: "Area deleted",
        description: "The area has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete area",
        description: error.message || "Failed to delete area",
        variant: "destructive",
      });
    },
  });

  const handleDeleteArea = () => {
    if (selectedAreaId) {
      deleteAreaMutation.mutate(selectedAreaId);
    }
  };

  // Toggle parcel in/out of area mutation
  const toggleParcelMutation = useMutation({
    mutationFn: async (parcelId: string) => {
      if (!selectedAreaId) throw new Error("No area selected");
      const res = await apiRequest("POST", `/api/admin/areas/${selectedAreaId}/parcels/${parcelId}/toggle`);
      return await res.json();
    },
    onSuccess: (data: any, parcelId: string) => {
      // Invalidate all parcel-related queries to refresh the map
      queryClient.invalidateQueries({ queryKey: ["/api/areas", selectedAreaId, "parcels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/areas", selectedAreaId, "map-parcels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/survey/parcels"] });
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

  const handleLocateParcel = (parcelId: string) => {
    // Find the parcel in the data
    const parcel = allMapParcels.find(p => p.id === parcelId);
    if (!parcel || !parcel.geometry) {
      toast({
        variant: "destructive",
        title: "Parcel not found",
        description: "Unable to locate parcel on map",
      });
      return;
    }

    // Calculate centroid from parcel geometry
    const coordinates = (parcel.geometry as any)?.coordinates || [];
    if (coordinates.length === 0 || coordinates[0].length === 0) {
      toast({
        variant: "destructive",
        title: "Invalid coordinates",
        description: "Parcel has no valid coordinates",
      });
      return;
    }

    // Get the first ring of the polygon
    const ring = coordinates[0];
    
    // Calculate bounding box from parcel coordinates
    // GeoJSON format is [longitude, latitude]
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    for (const point of ring) {
      const lng = point[0];
      const lat = point[1];
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }

    // Scroll to map first
    if (mapContainerRef.current) {
      mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Then fit bounds to parcel after a brief delay to ensure scroll completes
    setTimeout(() => {
      mapRef.current?.fitBounds([[minLat, minLng], [maxLat, maxLng]], 80);
    }, 500);

    toast({
      title: "Parcel located",
      description: `Centered map on parcel ${parcel.address || parcelId}`,
    });
  };

  // Refresh map data - completely re-request assigned and optional parcels
  const handleRefreshMap = () => {
    if (!selectedAreaId) return;
    
    // Invalidate both queries to force complete re-fetch
    queryClient.invalidateQueries({ queryKey: ["/api/areas", selectedAreaId, "parcels"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/areas", selectedAreaId, "map-parcels"] });
    
    toast({
      title: "Refreshing map",
      description: "Re-loading all parcel data...",
    });
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
    shortCode: parcel.shortCode || undefined,
    codePhrase: parcel.codePhrase || undefined,
    status: 'none' as 'none' | 'light-green' | 'forest-green',
    hasCompost: false,
    selected: selectedParcelIds.includes(parcel.id),
    q1Response: parcel.q1Response,
    q1Comment: parcel.q1Comment || undefined,
    q2Response: parcel.q2Response,
    q2Comment: parcel.q2Comment || undefined,
    q3Response: parcel.q3Response,
    q3Comment: parcel.q3Comment || undefined,
    responseDate: parcel.responseDate || undefined,
    areaNames: selectedArea ? [selectedArea.name] : [],
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
      shortCode: parcel.shortCode,
      address: parcel.address,
      codePhrase: parcel.codePhrase,
      status,
      responseDate: parcel.responseDate?.toString(),
      q1Response: parcel.q1Response,
      q2Response: parcel.q2Response,
      q3Response: parcel.q3Response,
    };
  });

  const filteredParcels = adminParcels.filter(
    (parcel) =>
      (parcel.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.codePhrase.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (parcel.shortCode || '').toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="area-select">Current Selected Area</Label>
                <div className="flex gap-2 mt-2">
                  <select
                    id="area-select"
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2"
                    data-testid="select-area"
                  >
                    <option value="">-- No area selected --</option>
                    {[...areas].sort((a, b) => a.name.localeCompare(b.name)).map(area => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                  {selectedAreaId && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={deleteAreaMutation.isPending}
                      data-testid="button-delete-area"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {selectedAreaId && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">Edit Selected Area</h3>
                <div>
                  <Label htmlFor="area-name">Area Name</Label>
                  <Input
                    id="area-name"
                    type="text"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    className="mt-2"
                    placeholder="e.g., Molin Nature Area"
                    data-testid="input-area-name"
                  />
                </div>
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
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle>Map View</CardTitle>
              </div>
              {selectedAreaId && (
                <Button
                  onClick={handleRefreshMap}
                  variant="outline"
                  size="sm"
                  disabled={parcelsLoading}
                  data-testid="button-refresh-map"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${parcelsLoading ? 'animate-spin' : ''}`} />
                  Refresh Map
                </Button>
              )}
            </div>
            <CardDescription>
              {selectedAreaId && selectedArea ? (
                <div className="space-y-1">
                  <div>
                    {assignedLoading ? (
                      <span className="text-muted-foreground">Loading assigned parcels...</span>
                    ) : (
                      <span>
                        <span className="font-semibold text-foreground">Step 1:</span> Showing {assignedParcels.length} assigned parcels
                      </span>
                    )}
                  </div>
                  <div>
                    {!assignedLoading && optionalLoading ? (
                      <span className="text-muted-foreground">Loading optional parcels within {selectedArea.displayRadiusMeters}m...</span>
                    ) : !assignedLoading ? (
                      <span>
                        <span className="font-semibold text-foreground">Step 2:</span> Showing {optionalParcels.length} optional parcels within {selectedArea.displayRadiusMeters}m radius
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                "Select an area to view parcels on the map"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div ref={mapContainerRef} className="h-[500px] rounded-md overflow-hidden border relative">
              {parcelsFetching && (
                <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
                  <div className="bg-card p-4 rounded-md shadow-lg">
                    <p className="text-sm font-medium">Reloading parcels...</p>
                  </div>
                </div>
              )}
              <ParcelMap 
                ref={mapRef}
                parcels={selectedAreaId ? mapParcels : []}
                center={selectedArea ? [selectedArea.centerLat, selectedArea.centerLng] : undefined}
                zoom={selectedArea?.defaultZoom || 15}
                onToggleArea={handleParcelClick}
                adminMode={true}
                isAdminMap={true}
              />
            </div>
            {selectedAreaId && (
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-green-600" />
                    <span>Green leaf markers = assigned parcels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-slate-400 bg-slate-400/50 rounded-sm"></div>
                    <span>Solid border = assigned parcels</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-dashed border-slate-400 bg-slate-400/50 rounded-sm"></div>
                  <span>Dashed border = optional parcels (within display radius, not assigned)</span>
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
              <AdminTable parcels={filteredParcels} onLocateParcel={handleLocateParcel} />
            </CardContent>
          </Card>
        )}

        {selectedAreaId && areaStatistics && (
          <Card>
            <CardHeader>
              <CardTitle>Area Statistics for {selectedArea?.name}</CardTitle>
              <CardDescription>Survey response summary for this area</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statisticsLoading ? (
                <div className="text-muted-foreground">Loading statistics...</div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-sm mb-1">
                      Question 1: Permission for invasive species removal on property border
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ✓ {areaStatistics.q1Percentage}% support ({areaStatistics.q1YesCount} yes / {areaStatistics.totalParcels} total parcels)
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-sm mb-1">
                      Question 2: Interest in assistance for invasive species removal on own property
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ✓ {areaStatistics.q2Percentage}% interested ({areaStatistics.q2YesCount} yes / {areaStatistics.totalParcels} total parcels)
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-sm mb-1">
                      Question 3: Willingness to share a compost bin with park stewards
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ✓ {areaStatistics.q3Percentage}% willing ({areaStatistics.q3YesCount} yes / {areaStatistics.totalParcels} total parcels)
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Area?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedArea?.name}"? This will remove the area but will NOT delete any survey responses. Survey data on parcels remains intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArea}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Area
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
