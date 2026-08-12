import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { DbLoggerService } from '../../health/db-logger.service';
export declare class GlobalExceptionFilter implements ExceptionFilter {
    private logger?;
    constructor(logger?: DbLoggerService | undefined);
    catch(exception: unknown, host: ArgumentsHost): void;
}
