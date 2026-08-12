declare class TelemetryDataDto {
    lat: number;
    lng: number;
    gps_speed_knots: number;
    mpu_speed_kmh: number;
    heading_deg: number;
    timestamp: string;
}
export declare class TelemetryBatchDto {
    route_id: string;
    data: TelemetryDataDto[];
}
export {};
