import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2 } from 'lucide-react';

export interface Parcel {
  id: string;
  coordinates: LatLngExpression[][];
  address: string;
  status: 'none' | 'light-green' | 'forest-green';
  hasCompost: boolean;
}

interface ParcelMapProps {
  parcels: Parcel[];
  center?: LatLngExpression;
  zoom?: number;
}

export default function ParcelMap({ parcels, center = [42.2808, -83.7430], zoom = 16 }: ParcelMapProps) {
  const getParcelColor = (status: string) => {
    switch (status) {
      case 'light-green':
        return '#9ed89e';
      case 'forest-green':
        return '#2d7a4f';
      default:
        return '#94a3b8';
    }
  };

  return (
    <div className="relative w-full h-full" data-testid="map-container">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {parcels.map((parcel) => (
          <Polygon
            key={parcel.id}
            positions={parcel.coordinates}
            pathOptions={{
              color: getParcelColor(parcel.status),
              fillColor: getParcelColor(parcel.status),
              fillOpacity: 0.5,
              weight: 2,
            }}
          >
            <Popup>
              <div className="p-2" data-testid={`popup-parcel-${parcel.id}`}>
                <p className="font-semibold">{parcel.address}</p>
                <p className="text-sm text-muted-foreground">
                  Status: {parcel.status === 'none' ? 'No response' : parcel.status === 'light-green' ? 'Q1 Support' : 'Full Support'}
                </p>
                {parcel.hasCompost && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-primary">
                    <Trash2 className="h-4 w-4" />
                    <span>Compost bin available</span>
                  </div>
                )}
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>

      <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur-sm border rounded-md p-4 z-[1000]" data-testid="map-legend">
        <h3 className="font-semibold text-sm mb-2">Legend</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#94a3b8' }} />
            <span>No Response</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#9ed89e' }} />
            <span>Q1 Support</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#2d7a4f' }} />
            <span>Full Support</span>
          </div>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-primary" />
            <span>Compost Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}
