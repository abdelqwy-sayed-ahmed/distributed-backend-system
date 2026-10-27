import { Injectable, Logger, LoggerService } from '@nestjs/common';

@Injectable()
export class LoggerAppService implements LoggerService {
  private readonly logger = new Logger();
  private readonly app="product-service-app"

  log(message: string, context?: string) {
    this.logger.log(` [${context ?? this.app}] ${message}`);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(` [${context ?? this.app}] ${message}`, trace);
  }

  warn(message: string, context?: string) {
    this.logger.warn(` [${context ?? this.app}] ${message}`);
  }

  debug(message: string, context?: string) {
    this.logger.debug(`[${context ?? this.app}] ${message}`);
  }

  verbose(message: string, context?: string) {
    console.debug(` [${context ?? 'App'}] ${message}`);
  }
}
