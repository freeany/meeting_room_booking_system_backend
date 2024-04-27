import * as crypto from 'crypto';
import { LoginUserVo } from './user/vo/login-user.vo';
import {
  BadRequestException,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';

export function md5(str) {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}

export function generateParseIntPipe(name) {
  return new ParseIntPipe({
    exceptionFactory() {
      throw new BadRequestException(name + ' 应该传数字');
    },
  });
}
