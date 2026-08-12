"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const db_logger_service_1 = require("../../health/db-logger.service");
let GlobalExceptionFilter = class GlobalExceptionFilter {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let detail = null;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            }
            else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                message = exceptionResponse.message || message;
                detail = exceptionResponse.error || exceptionResponse.detail || null;
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
        }
        if (this.logger) {
            this.logger.error(`[${request.method}] ${request.url} - Error ${status}: ${message}`, exception instanceof Error ? exception.stack : undefined, 'GlobalExceptionFilter');
        }
        else {
            console.error(`[${request.method}] ${request.url} - Error ${status}: ${message}`);
            if (status === common_1.HttpStatus.INTERNAL_SERVER_ERROR) {
                console.error(exception);
            }
        }
        response.status(status).json({
            status: 'error',
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            detail: Array.isArray(message) ? message[0] : message,
        });
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [db_logger_service_1.DbLoggerService])
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map