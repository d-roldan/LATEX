import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type RequestLike = {
  ip?: string;
  headers?: { authorization?: string | string[] };
};

export function rateLimitTracker(request: RequestLike): string {
  const rawAuthorization = request.headers?.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;

  if (authorization?.startsWith('Bearer ')) {
    return `token:${createHash('sha256').update(authorization.slice(7)).digest('hex')}`;
  }

  return `ip:${request.ip ?? 'unknown'}`;
}

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected async getTracker(request: RequestLike): Promise<string> {
    return rateLimitTracker(request);
  }
}
