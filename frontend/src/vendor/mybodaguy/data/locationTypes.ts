export interface Location {
  id: string;
  name: string;
  area: string;
  fullAddress: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}
