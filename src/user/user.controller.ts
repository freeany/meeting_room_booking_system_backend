import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { EmailService } from 'src/email/email.service';
import { RedisService } from 'src/redis/redis.service';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginUserVo } from './vo/login-user.vo';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GetRequestUser, RequireLogin } from 'src/custom.decorator';
import { UserDetailVo } from './vo/user-info.vo';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Inject(EmailService)
  private emailService: EmailService;

  @Inject(RedisService)
  private redisService: RedisService;

  @Inject(JwtService)
  private jwtService: JwtService;

  @Inject(ConfigService)
  private configService: ConfigService;

  @Post('register')
  async register(@Body() registerUser: RegisterUserDto) {
    return await this.userService.register(registerUser);
  }

  @Get('register-captcha')
  async captcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);

    // 5分钟的过期时间
    await this.redisService.set(`captcha_${address}`, code, 5 * 60);

    await this.emailService.sendMail({
      to: address,
      subject: '注册验证码',
      html: `<p>你的注册验证码是 ${code}</p>`,
    });
    return '发送成功';
  }

  @Post('login')
  async userLogin(@Body() loginUser: LoginUserDto): Promise<LoginUserVo> {
    // console.log(loginUser);
    const loginUserVo = await this.userService.login(loginUser, false);
    this.handleLoginVoToken(loginUserVo);

    return loginUserVo;
  }

  @Post('admin/login')
  async adminLogin(@Body() loginUser: LoginUserDto) {
    const loginAdminVo = await this.userService.login(loginUser, true);
    this.handleLoginVoToken(loginAdminVo);

    return loginAdminVo;
  }

  @Get('refresh')
  async refresh(@Query('refreshToken') refreshToken: string) {
    try {
      return this.refreshTokenUser(refreshToken, false);
    } catch (e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  @Get('admin/refresh')
  async adminRefresh(@Query('refreshToken') refreshToken: string) {
    try {
      return this.refreshTokenUser(refreshToken, true);
    } catch (e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  // 获取用户信息，用来回显数据
  @Get('info')
  @RequireLogin()
  async getUserInfo(@GetRequestUser('userId') userId: number) {
    const user = await this.userService.findUserDetailById(userId);
    // console.log(user);
    const vo = new UserDetailVo();
    vo.id = user.id;
    vo.email = user.email;
    vo.username = user.username;
    vo.headPic = user.headPic;
    vo.phoneNumber = user.phoneNumber;
    vo.nickName = user.nickName;
    vo.createTime = user.createTime;
    vo.isFrozen = user.isFrozen;

    return vo;
  }

  // 修改密码时发送验证码
  @Get('update_password/captcha')
  @RequireLogin()
  async updatePasswordCaptcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);

    // 5分钟的过期时间
    await this.redisService.set(
      `update_password_captcha_${address}`,
      code,
      10 * 60,
    );

    await this.emailService.sendMail({
      to: address,
      subject: '注册验证码',
      html: `<p>你的注册验证码是 ${code}</p>`,
    });
    return '发送成功';
  }

  // 普通用户/管理员 修改密码
  @Post(['update_password', 'admin/update_password'])
  @RequireLogin()
  async updatePassword(
    @GetRequestUser('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    // console.log(passwordDto);
    const data = await this.userService.updateUserPassword(userId, passwordDto);
    return data;
  }

  // 修改个人信息
  @Post(['update', 'admin/update'])
  @RequireLogin()
  async updateUserInfo(
    @GetRequestUser('userId') userId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const data = this.userService.updateUserInfo(userId, updateUserDto);
    return data;
  }
  @Get('update/captcha')
  @RequireLogin()
  async updateCaptcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(
      `update_user_captcha_${address}`,
      code,
      10 * 60,
    );

    await this.emailService.sendMail({
      to: address,
      subject: '更改用户信息验证码',
      html: `<p>你的验证码是 ${code}</p>`,
    });

    return '发送成功';
  }

  // 冻结用户
  @Get('freeze')
  async freezeUser(@Query('id') userId: number) {
    await this.userService.freezUserById(userId);
    return 'success';
  }

  // 给从库里捞出来的到的user对象加上token
  async refreshTokenUser(refreshToken: string, isAdmin: boolean) {
    // 校验refreshToken
    const data = this.jwtService.verify(refreshToken);
    // 这里用了try catch包裹，如果抛出异常，那么就会直接进到catch，所以无需对data进行校验
    const user = await this.userService.findUserById(data.userId, isAdmin);

    // 对数据进行jwt签名，生成token
    const access_token = this.jwtService.sign(
      {
        userId: user.id,
        username: user.username,
        roles: user.roles,
        permissions: user.permissions,
      },
      {
        expiresIn:
          this.configService.get('jwt_access_token_expires_time') || '30m',
      },
    );

    const refresh_token = this.jwtService.sign(
      {
        userId: user.id,
      },
      {
        expiresIn:
          this.configService.get('jwt_refresh_token_expres_time') || '7d',
      },
    );

    return {
      access_token,
      refresh_token,
    };
  }

  handleLoginVoToken(loginUserVo: LoginUserVo) {
    // 获取到用户的信息之后先加密一个签名
    loginUserVo.accessToken = this.jwtService.sign(
      {
        userId: loginUserVo.userInfo.id,
        username: loginUserVo.userInfo.username,
        roles: loginUserVo.userInfo.roles,
        permissions: loginUserVo.userInfo.permissions,
      },
      {
        expiresIn:
          this.configService.get('jwt_access_token_expires_time') || '30m',
      },
    );

    loginUserVo.refreshToken = this.jwtService.sign(
      {
        userId: loginUserVo.userInfo.id,
      },
      {
        expiresIn:
          this.configService.get('jwt_refresh_token_expres_time') || '7d',
      },
    );
  }

  @Get('init')
  async init() {
    await this.userService.initData();
    return 'done.';
  }
}
