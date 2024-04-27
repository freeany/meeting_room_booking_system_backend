import { Controller, Get, SetMetadata } from '@nestjs/common';
import { AppService } from './app.service';
import {
  GetRequestUser,
  RequireLogin,
  RequirePermission,
} from './custom.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('aaa')
  // @SetMetadata('require-login', true)
  // @SetMetadata('require-permission', ['ddd'])
  @RequireLogin()
  @RequirePermission('ddd')
  aaa(
    @GetRequestUser('username') username: string,
    @GetRequestUser() userInfo,
  ): string {
    console.log(username);
    console.log(userInfo);

    return this.appService.getHello() + 'aaa';
  }

  @Get('bbb')
  bbb(): string {
    return this.appService.getHello() + 'bbb';
  }
}
