export declare enum LogLevel {
    INFO = "log",
    WARN = "warn",
    ERROR = "error",
    DEBUG = "debug",
    VERBOSE = "verbose",
    FATAL = "fatal"
}
export declare class SystemLog {
    id: string;
    level: LogLevel;
    message: string;
    context: string;
    meta: any;
    createdAt: Date;
}
