//不分异常类型

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionStr = exception
      ? `message:${exception['message']},stack:${exception['stack']}`
      : '';

    // console.log(
    //   '全局异常日志： %s %s %s error: %s',
    //   request.method,
    //   request.url,
    //   request.body,
    //   exceptionStr,
    // );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().getTime(),
      message: exception['message'],
      method: request.method,
      path: request.url,
    });
  }
}
