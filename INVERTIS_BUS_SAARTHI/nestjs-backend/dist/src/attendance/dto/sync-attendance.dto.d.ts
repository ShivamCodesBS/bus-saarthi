declare class AttendanceRecordDto {
    passenger_id: string;
    name?: string;
    fee_status?: string;
    confidence?: number;
    timestamp?: string;
}
export declare class SyncAttendanceDto {
    route_id: string;
    records: AttendanceRecordDto[];
}
export {};
