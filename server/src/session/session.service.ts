// src/session/session.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async createSession(userId: number) {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.getSessionDuration());

    const session = await this.prisma.sessionPortail.create({
      data: {
        token: tokenHash,
        userId,
        expiresAt,
      },
    });

    // Return the raw token once; only its hash is stored in DB.
    return {
      ...session,
      token,
    };
  }

  async validateSession(token: string) {
    const tokenCandidates = this.resolveTokenCandidates(token);
    if (tokenCandidates.length === 0) {
      return null;
    }

    return this.prisma.sessionPortail.findFirst({
      where: {
        token: { in: tokenCandidates },
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async deleteSession(token: string) {
    const tokenCandidates = this.resolveTokenCandidates(token);
    if (tokenCandidates.length === 0) {
      return { count: 0 };
    }

    return this.prisma.sessionPortail.deleteMany({
      where: { token: { in: tokenCandidates } },
    });
  }

  async cleanupExpiredSessions() {
    return this.prisma.sessionPortail.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private resolveTokenCandidates(token: string): string[] {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) {
      return [];
    }

    const tokenHash = this.hashToken(cleanToken);
    if (tokenHash === cleanToken) {
      return [cleanToken];
    }

    // Backward compatibility with existing non-hashed sessions.
    return [tokenHash, cleanToken];
  }

  private getSessionDuration(): number {
    return this.config.get<number>('SESSION_DURATION', 24 * 60 * 60 * 1000); // Default 24 hours
  }

  async extendSession(token: string) {
    const tokenCandidates = this.resolveTokenCandidates(token);
    if (tokenCandidates.length === 0) {
      return null;
    }

    const existingSession = await this.prisma.sessionPortail.findFirst({
      where: {
        token: { in: tokenCandidates },
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!existingSession) {
      return null;
    }

    return this.prisma.sessionPortail.update({
      where: { id: existingSession.id },
      data: { expiresAt: new Date(Date.now() + this.getSessionDuration()) },
    });
  }
}
