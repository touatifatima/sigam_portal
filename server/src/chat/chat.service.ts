// src/chat/chat.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './create-message.dto';
import { MessageDto } from './message.dto';
import { ConversationDto } from './conversation.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isAdministrationRole(roleName?: string | null) {
    const value = String(roleName || '').trim().toLowerCase();
    if (!value) return false;
    return (
      value.includes('admin') ||
      value.includes('administrateur') ||
      value.includes('agent') ||
      value.includes('cadastre') ||
      value.includes('support')
    );
  }

  private compactDisplayName(
    user?: {
      nom?: string | null;
      Prenom?: string | null;
      username?: string | null;
    } | null,
    fallback = 'Administration',
  ) {
    if (!user) return fallback;
    const full = [user.nom, user.Prenom].filter(Boolean).join(' ').trim();
    return full || String(user.username || fallback);
  }

  private normalizeEntityType(entityType?: string | null) {
    const value = String(entityType || '').trim().toUpperCase();
    if (value === 'DEMANDE' || value === 'PERMIS') return value;
    return 'GENERAL';
  }

  private normalizeEntityCode(entityCode?: string | null) {
    const value = String(entityCode || '').trim();
    return value || 'GENERAL';
  }

  async sendMessage(senderId: number, createMessageDto: CreateMessageDto) {
    const { content, receiverId } = createMessageDto;
    const entityType = this.normalizeEntityType(createMessageDto.entityType);
    const entityCode = this.normalizeEntityCode(createMessageDto.entityCode);
    const sender = await this.prisma.utilisateurPortail.findUnique({
      where: { id: senderId },
      select: {
        nom: true,
        Prenom: true,
        username: true,
      },
    });
    const senderIsAdmin = await this.notificationsService.isAdminUser(senderId);

    let resolvedReceiverId = Number(receiverId);
    let adminRecipientIds: number[] = [];
    if (!senderIsAdmin) {
      const adminIds = await this.notificationsService.getAdminRecipientIds();
      adminRecipientIds = adminIds.filter(
        (id) => Number(id) !== Number(senderId),
      );
      const requestedReceiverId = Number(receiverId);
      const selectedAdminId = adminRecipientIds.includes(requestedReceiverId)
        ? requestedReceiverId
        : adminRecipientIds[0];
      if (!selectedAdminId) {
        throw new NotFoundException('Aucun compte administration disponible.');
      }
      resolvedReceiverId = Number(selectedAdminId);
    }

    if (!Number.isFinite(resolvedReceiverId) || resolvedReceiverId <= 0) {
      throw new NotFoundException('Destinataire invalide.');
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          {
            user1Id: senderId,
            user2Id: resolvedReceiverId,
            entityType,
            entityCode,
          },
          {
            user1Id: resolvedReceiverId,
            user2Id: senderId,
            entityType,
            entityCode,
          },
        ],
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          user1Id: Math.min(senderId, resolvedReceiverId),
          user2Id: Math.max(senderId, resolvedReceiverId),
          entityType,
          entityCode,
        },
      });
    }

    const message = await this.prisma.messagePortail.create({
      data: {
        content,
        senderId,
        receiverId: resolvedReceiverId,
        conversationId: conversation.id,
      },
      include: {
        sender: {
          select: { id: true, nom: true, Prenom: true, username: true },
        },
        conversation: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    try {
      if (senderIsAdmin) {
        await this.notificationsService.createAdminMessageNotification({
          receiverId: resolvedReceiverId,
          messageId: message.id,
          preview: content,
          senderDisplayName: this.compactDisplayName(sender),
        });
      } else {
        const targets = adminRecipientIds.length
          ? adminRecipientIds
          : [resolvedReceiverId];
        await Promise.all(
          targets.map((adminUserId) =>
            this.notificationsService.createUserMessageToAdminNotification({
              adminUserId,
              messageId: message.id,
              preview: content,
              senderDisplayName: this.compactDisplayName(
                sender,
                'Utilisateur',
              ),
            }),
          ),
        );
      }
    } catch (error) {
      console.warn(
        `Notification message non envoyee (message ${message.id})`,
        error,
      );
    }

    return this.toMessageDto(message);
  }

  async getConversations(
    userId: number,
    entityTypeRaw?: string,
    entityCodeRaw?: string,
  ): Promise<ConversationDto[]> {
    const entityType = this.normalizeEntityType(entityTypeRaw);
    const entityCode = this.normalizeEntityCode(entityCodeRaw);
    const hasEntityFilter = Boolean(entityTypeRaw || entityCodeRaw);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        ...(hasEntityFilter ? { entityType, entityCode } : {}),
      },
      include: {
        user1: { select: { id: true, nom: true, Prenom: true, username: true } },
        user2: { select: { id: true, nom: true, Prenom: true, username: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, nom: true, Prenom: true, username: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      conversations.map(async (conv) => {
        const otherUser = conv.user1Id === userId ? conv.user2 : conv.user1;
        const unreadCount = await this.prisma.messagePortail.count({
          where: {
            conversationId: conv.id,
            receiverId: userId,
            isRead: false,
          },
        });

        const lastMessage = conv.messages[0]
          ? this.toMessageDto(conv.messages[0])
          : undefined;

        return new ConversationDto({
          id: conv.id,
          user1Id: conv.user1Id,
          user2Id: conv.user2Id,
          entityType: conv.entityType,
          entityCode: conv.entityCode,
          lastMessage,
          unreadCount,
          otherUser: {
            id: otherUser.id,
            nom: otherUser.nom,
            prenom: otherUser.Prenom,
            username: otherUser.username,
          },
        });
      }),
    );
  }

  async getAvailableUsers(currentUserId: number) {
    const isRequesterAdmin =
      await this.notificationsService.isAdminUser(currentUserId);

    if (isRequesterAdmin) {
      return this.prisma.utilisateurPortail.findMany({
        where: {
          id: { not: currentUserId },
        },
        select: {
          id: true,
          nom: true,
          Prenom: true,
          username: true,
          email: true,
          role: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { nom: 'asc' },
      });
    }

    const adminIds = await this.notificationsService.getAdminRecipientIds();
    const filteredAdminIds = adminIds.filter(
      (id) => Number(id) !== Number(currentUserId),
    );

    if (!filteredAdminIds.length) {
      return [];
    }

    return this.prisma.utilisateurPortail.findMany({
      where: {
        id: { in: filteredAdminIds },
      },
      select: {
        id: true,
        nom: true,
        Prenom: true,
        username: true,
        email: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { nom: 'asc' },
    });
  }

  async getMessages(conversationId: number, userId: number): Promise<MessageDto[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (
      !conversation ||
      (conversation.user1Id !== userId && conversation.user2Id !== userId)
    ) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.messagePortail.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    const messages = await this.prisma.messagePortail.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, nom: true, Prenom: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((message) => this.toMessageDto(message));
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.prisma.messagePortail.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }

  private toMessageDto(message: any): MessageDto {
    return new MessageDto({
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      receiverId: message.receiverId,
      isRead: message.isRead,
      createdAt: message.createdAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            nom: message.sender.nom,
            prenom: message.sender.Prenom,
            username: message.sender.username,
          }
        : undefined,
      conversationId: message.conversationId,
    });
  }
}
