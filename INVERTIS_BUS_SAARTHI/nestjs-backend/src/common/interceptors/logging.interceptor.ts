import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;
    const now = Date.now();
    const requestId = uuidv4();

    console.log(`[${requestId}] ${method} ${url} - Started`);

    return next
      .handle()
      .pipe(
        tap(() => console.log(`[${requestId}] ${method} ${url} - Completed in ${Date.now() - now}ms`)),
      );
  }
}
