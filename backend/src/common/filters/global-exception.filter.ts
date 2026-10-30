import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DbLoggerService } from '../../health/db-logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private logger?: DbLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let detail = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        message = (exceptionResponse as any).message || message;
        detail =
          (exceptionResponse as any).error ||
          (exceptionResponse as any).detail ||
          null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (this.logger) {
      this.logger.error(
        `[${request.method}] ${request.url} - Error ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter',
      );
    } else {
      console.error(
        `[${request.method}] ${request.url} - Error ${status}: ${message}`,
      );
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        console.error(exception);
      }
    }

    const origin = request.headers.origin;
    if (origin && typeof origin === 'string') {
      try {
        const host = new URL(origin).hostname;
        if (
          origin.startsWith('http://localhost') ||
          origin.startsWith('http://127.0.0.1') ||
          host.endsWith('.vercel.app') ||
          host.endsWith('.onrender.com') ||
          origin.startsWith('http://192.168.') ||
          origin.startsWith('http://10.')
        ) {
          response.setHeader('Access-Control-Allow-Origin', origin);
          response.setHeader('Access-Control-Allow-Credentials', 'true');
        }
      } catch {}
    }

    response.status(status).json({
      status: 'error',
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      detail: Array.isArray(message) ? message[0] : message, // Simplify validation errors
    });
  }
}
