import * as crypto from 'crypto';
import { LoginUserVo } from './user/vo/login-user.vo';
import { UnauthorizedException } from '@nestjs/common';

export function md5(str) {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}
