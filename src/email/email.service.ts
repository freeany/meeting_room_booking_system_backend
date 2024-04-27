import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  transporter: Transporter;

  constructor(private configService: ConfigService) {
    const nodemailer_host = configService.get('nodemailer_host');
    const nodemailer_port = configService.get('nodemailer_port');
    const nodemailer_auth_user = configService.get('nodemailer_auth_user');
    const nodemailer_auth_pass = configService.get('nodemailer_auth_pass');

    this.transporter = createTransport({
      host: nodemailer_host,
      port: nodemailer_port,
      secure: false,
      auth: {
        user: nodemailer_auth_user,
        pass: nodemailer_auth_pass,
      },
    });
  }

  async sendMail({ to, subject, html }) {
    const nodemailer_send_register_emial_name = this.configService.get(
      'nodemailer_send_register_emial_name',
    );
    const nodemailer_auth_user = this.configService.get('nodemailer_auth_user');
    await this.transporter.sendMail({
      from: {
        name: nodemailer_send_register_emial_name,
        address: nodemailer_auth_user,
      },
      to,
      subject,
      html,
    });
  }
}
