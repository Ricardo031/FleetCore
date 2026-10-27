import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity.js';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  // The password field has `select: false` so it must be explicitly requested for login.
  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  create(data: Pick<User, 'name' | 'email' | 'password' | 'role'>) {
    return this.repo.save(this.repo.create(data));
  }
}
