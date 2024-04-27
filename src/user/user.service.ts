import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Like, Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/utils';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginUserVo } from './vo/login-user.vo';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  private logger = new Logger();

  @InjectRepository(User)
  private userRepository: Repository<User>;

  @InjectRepository(Role)
  private roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  @Inject(RedisService)
  private redisService: RedisService;

  async register(user: RegisterUserDto) {
    console.log(`captcha_${user.email}`);

    const captcha = await this.redisService.get(`captcha_${user.email}`);

    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }

    if (user.captcha !== captcha) {
      throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
    }

    const foundUser = await this.userRepository.findOneBy({
      username: user.username,
    });

    if (foundUser) {
      throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST);
    }

    const newUser = new User();
    newUser.username = user.username;
    newUser.password = md5(user.password);
    newUser.email = user.email;
    newUser.nickName = user.nickName;

    try {
      await this.userRepository.save(newUser);
      return '注册成功';
    } catch (e) {
      this.logger.error(e, UserService);
      return '注册失败';
    }
  }

  async login(user: LoginUserDto, isAdmin: boolean) {
    const findUser = await this.userRepository.findOne({
      where: {
        username: user.username,
        isAdmin,
      },
      /**
       获取到的结构：
       "roles": [
        {
            "id": 2,
            "name": "普通用户",
            "permissions": [
                    {
                        "id": 1,
                        "code": "ccc",
                        "description": "访问 ccc 接口"
                    }
                ]
            }
        ]
       */
      relations: ['roles', 'roles.permissions'],

      /**
         获取到的是这种结构：
          "roles": [
              {
                "id": 2,
                "name": "普通用户"
              }
          ]
       */
      // relations: {
      //   roles: true,
      // },
    });

    // 如果用户不存在
    if (!findUser) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }

    if (findUser.password !== md5(user.password)) {
      throw new HttpException('密码错误', HttpStatus.BAD_REQUEST);
    }

    const vo = new LoginUserVo();
    vo.userInfo = {
      id: findUser.id,
      username: findUser.username,
      // typeorm将nick_name映射到user entity中nickName了
      nickName: findUser.nickName,
      email: findUser.email,
      phoneNumber: findUser.phoneNumber,
      headPic: findUser.headPic,
      createTime: findUser.createTime.getTime(),
      isFrozen: findUser.isFrozen,
      isAdmin: findUser.isAdmin,
      roles: findUser.roles.map((item) => item.name),
      permissions: findUser.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
    };

    return vo;
  }

  async findUserById(userId: number, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    // 需要多这么数据进行token签名化...
    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
    };
  }

  // 获取用户信息
  async findUserDetailById(userId: number) {
    const user = await this.userRepository.findOneBy({
      id: userId,
    });
    if (!user) {
      throw new HttpException('该用户不存在', HttpStatus.BAD_REQUEST);
    }

    return user;
  }

  // 普通用户/管理员更新密码
  async updateUserPassword(
    userId: number,
    updatePassword: UpdateUserPasswordDto,
  ) {
    // 判断填入邮箱是否和注册时邮箱一致
    const user = await this.userRepository.findOneBy({ id: userId });

    if (user.email !== updatePassword.email) {
      throw new HttpException('请输入注册时的邮箱地址', HttpStatus.BAD_REQUEST);
    }
    // console.log(userId, updatePassword);

    // 去redis中查找验证码
    const captcha = await this.redisService.get(
      `update_password_captcha_${updatePassword.email}`,
    );
    // 如果redis中没有验证码，那么返回验证码失效
    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }
    // 如果有，那就判断下redis中的captcha和传入的captcha是否相等，不相等等则返回验证码不正确
    if (captcha !== updatePassword.captcha) {
      throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
    }

    user.password = md5(updatePassword.password);

    try {
      const result = await this.userRepository.save(user);
      console.log(result, 'result..');

      return '密码修改成功';
    } catch (e) {
      this.logger.error(e, UserService);
      return '密码修改失败';
    }
  }

  async updateUserInfo(userId: number, userInfo: UpdateUserDto) {
    const captcha = await this.redisService.get(
      `update_user_captcha_${userInfo.email}`,
    );

    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }
    if (captcha !== userInfo.captcha) {
      throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userRepository.findOneBy({ id: userId });
    if (userInfo.nickName) {
      user.nickName = userInfo.nickName;
    }
    if (userInfo.headPic) {
      user.headPic = userInfo.headPic;
    }

    try {
      await this.userRepository.save(user);
      return '用户信息修改成功';
    } catch (e) {
      this.logger.error(e, UserService);
      return '用户信息修改成功';
    }
  }

  // 冻结用户
  async freezUserById(userId: number) {
    try {
      const user = await this.userRepository.findOneBy({ id: userId });
      user.isFrozen = true;

      await this.userRepository.save(user);
    } catch (error) {
      throw new HttpException('未知错误', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 分页获取用户列表
  async findUsers(
    username: string,
    nickName: string,
    email: string,
    pageNo: number,
    pageSize: number,
  ) {
    const skipCount = (pageNo - 1) * pageSize;

    const condition: Record<string, any> = {};

    if (username) {
      condition.username = Like(`%${username}%`);
    }
    if (nickName) {
      condition.nickName = Like(`%${nickName}%`);
    }
    if (email) {
      condition.email = Like(`%${email}%`);
    }

    const [users, totalCount] = await this.userRepository.findAndCount({
      select: [
        'id',
        'username',
        'nickName',
        'email',
        'phoneNumber',
        'isFrozen',
        'headPic',
        'createTime',
      ],
      skip: skipCount,
      take: pageSize,
      where: condition,
    });

    //也可以在这里封装vo

    return {
      users,
      totalCount,
    };
  }

  // 初始化数据的方法，正是环境用sql导入
  async initData() {
    const user1 = new User();
    user1.username = 'zhangsan';
    user1.password = md5('111111');
    user1.email = 'xxx@xx.com';
    user1.isAdmin = true;
    user1.nickName = '张三';
    user1.phoneNumber = '13233323333';

    const user2 = new User();
    user2.username = 'lisi';
    user2.password = md5('222222');
    user2.email = 'yy@yy.com';
    user2.nickName = '李四';

    const role1 = new Role();
    role1.name = '管理员';

    const role2 = new Role();
    role2.name = '普通用户';

    const permission1 = new Permission();
    permission1.code = 'ccc';
    permission1.description = '访问 ccc 接口';

    const permission2 = new Permission();
    permission2.code = 'ddd';
    permission2.description = '访问 ddd 接口';

    user1.roles = [role1];
    user2.roles = [role2];

    role1.permissions = [permission1, permission2];
    role2.permissions = [permission1];

    await this.permissionRepository.save([permission1, permission2]);
    await this.roleRepository.save([role1, role2]);
    await this.userRepository.save([user1, user2]);
  }
}
