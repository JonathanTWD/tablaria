import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// Value of the library's `Algorithm.Argon2id` const enum, which isolatedModules cannot import.
const ARGON2ID = 2;

// OWASP minimum for argon2id: 19 MiB memory, 2 iterations, 1 lane.
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  // Verified against when the email is unknown, so login takes the same time either way.
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash(randomUUID());
    await verify(await this.dummyHash, password);
    return false;
  }
}
