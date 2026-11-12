export const VEHICLE_ICONS=['generic','transit','box','suv'] as const;
export type VehicleIconType=typeof VEHICLE_ICONS[number];
export const VEHICLE_ICON_LABELS:Record<VehicleIconType,string>={generic:'General vehicle',transit:'Transit van',box:'Box ambulance',suv:'Response SUV'};
