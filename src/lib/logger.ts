/**
 * Logger - модуль для логирования операций в ailocks-ai2ai
 * 
 * Поддерживает различные уровни логирования и форматирование сообщений
 * 
 * @version 1.0
 * @date 2025-07-13
 */

// Типы уровней логирования
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Интерфейс логгера
interface Logger {
  debug(message: string, ...meta: any[]): void;
  info(message: string, ...meta: any[]): void;
  warn(message: string, ...meta: any[]): void;
  error(message: string, ...meta: any[]): void;
}

// Базовая реализация логгера
class BaseLogger implements Logger {
  private readonly isBrowser: boolean;
  
  constructor() {
    // Определяем окружение (браузер или серверное)
    this.isBrowser = typeof window !== 'undefined';
  }
  
  /**
   * Форматирует дату для логов
   */
  private formatDate(): string {
    const now = new Date();
    return now.toISOString();
  }
  
  /**
   * Форматирует сообщение лога
   */
  private formatMessage(level: LogLevel, message: string): string {
    return `[${this.formatDate()}] [${level.toUpperCase()}] ${message}`;
  }
  
  /**
   * Выводит debug-сообщение
   */
  debug(message: string, ...meta: any[]): void {
    if (this.isBrowser) {
      console.debug(this.formatMessage('debug', message), ...meta);
    } else {
      console.debug(this.formatMessage('debug', message), meta.length ? JSON.stringify(meta) : '');
    }
  }
  
  /**
   * Выводит info-сообщение
   */
  info(message: string, ...meta: any[]): void {
    if (this.isBrowser) {
      console.info(this.formatMessage('info', message), ...meta);
    } else {
      console.info(this.formatMessage('info', message), meta.length ? JSON.stringify(meta) : '');
    }
  }
  
  /**
   * Выводит предупреждение
   */
  warn(message: string, ...meta: any[]): void {
    if (this.isBrowser) {
      console.warn(this.formatMessage('warn', message), ...meta);
    } else {
      console.warn(this.formatMessage('warn', message), meta.length ? JSON.stringify(meta) : '');
    }
  }
  
  /**
   * Выводит сообщение об ошибке
   */
  error(message: string, ...meta: any[]): void {
    if (this.isBrowser) {
      console.error(this.formatMessage('error', message), ...meta);
    } else {
      const errorData = meta[0] instanceof Error ? 
        { message: meta[0].message, stack: meta[0].stack } : 
        meta;
      
      console.error(
        this.formatMessage('error', message), 
        meta.length ? JSON.stringify(errorData) : ''
      );
    }
  }
}

// Экспортируем экземпляр логгера
export const logger = new BaseLogger();
