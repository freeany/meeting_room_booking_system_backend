import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateMeetingRoomDto } from './dto/create-meeting-room.dto';
import { UpdateMeetingRoomDto } from './dto/update-meeting-room.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { MeetingRoom } from './entities/meeting-room.entity';

@Injectable()
export class MeetingRoomService {
  private logger = new Logger();

  // 注入meetingroom的repository
  @InjectRepository(MeetingRoom)
  private repository: Repository<MeetingRoom>;

  async list(
    pageNo: number,
    pageSize: number,
    name: string,
    capacity: number,
    equipment: string,
  ) {
    if (pageNo < 1) {
      throw new BadRequestException('页码最小为 1');
    }
    const skipCount = (pageNo - 1) * pageSize;

    const condition: Record<string, any> = {};

    if (name) {
      condition.name = Like(`%${name}%`);
    }
    if (equipment) {
      condition.equipment = Like(`%${equipment}%`);
    }
    if (capacity) {
      condition.capacity = capacity;
    }

    const [meetingRooms, totalCount] = await this.repository.findAndCount({
      skip: skipCount,
      take: pageSize,
      where: condition,
    });

    return {
      meetingRooms,
      totalCount,
    };
  }

  async create(meetingRoomDto: CreateMeetingRoomDto) {
    const room = await this.repository.findOneBy({
      name: meetingRoomDto.name,
    });

    if (room) {
      throw new BadRequestException('会议室名字已存在');
    }

    try {
      await this.repository.insert(meetingRoomDto);
      return '会议室创建成功';
    } catch (e) {
      this.logger.error(e, MeetingRoomService);
      return '会议室创建失败';
    }
  }

  async update(meetingRoomDto: UpdateMeetingRoomDto) {
    const meetingRoom = await this.repository.findOneBy({
      id: meetingRoomDto.id,
    });

    if (!meetingRoom) {
      throw new BadRequestException('会议室不存在');
    }

    meetingRoom.capacity = meetingRoomDto.capacity;
    meetingRoom.location = meetingRoomDto.location;
    meetingRoom.name = meetingRoomDto.name;

    if (meetingRoomDto.description) {
      meetingRoom.description = meetingRoomDto.description;
    }
    if (meetingRoomDto.equipment) {
      meetingRoom.equipment = meetingRoomDto.equipment;
    }

    await this.repository.update(
      {
        id: meetingRoom.id,
      },
      meetingRoom,
    );
    return 'success';
  }

  async findById(id: number) {
    return this.repository.findOneBy({
      id,
    });
  }

  async delete(id: number) {
    await this.repository.delete({
      id,
    });
    return 'success';
  }

  // 我们很多地方都是用的 repository.save，但如果你确定是 insert 或者 update 的时候，直接用 repository.insert 或者 repository.update 更好。

  // 1. insert 的时候 用 insert 比用 save 更好，能够批量插入数据。
  // 2. 是 update 的时候，也不要用 save，因为它会先 select 一次，再确定是 udpate 还是 insert。
  initData() {
    const room1 = new MeetingRoom();
    room1.name = '木星';
    room1.capacity = 10;
    room1.equipment = '白板';
    room1.location = '一层西';

    const room2 = new MeetingRoom();
    room2.name = '金星';
    room2.capacity = 5;
    room2.equipment = '';
    room2.location = '二层东';

    const room3 = new MeetingRoom();
    room3.name = '天王星';
    room3.capacity = 30;
    room3.equipment = '白板，电视';
    room3.location = '三层东';

    // this.repository.save([room1, room2, room3]);
    this.repository.insert([room1, room2, room3]);
  }
}
