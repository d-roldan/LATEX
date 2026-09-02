import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto, CreateClientContactDto } from './dto/create-client.dto';
import { UpdateClientContactDto, UpdateClientDto } from './dto/update-client.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return { module: 'clients', status: 'ready' };
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      companyId,
      isActive: true
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { cuit: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { contacts: true }
      }),
      this.prisma.client.count({ where })
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId, isActive: true },
      include: {
        contacts: { orderBy: { createdAt: 'asc' } },
        _count: { select: { orders: true } }
      }
    });

    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async create(companyId: string, dto: CreateClientDto) {
    const { contacts, ...clientData } = dto;
    return this.prisma.client.create({
      data: {
        companyId,
        ...clientData,
        email: clientData.email?.toLowerCase(),
        contacts: contacts?.length
          ? { create: contacts }
          : undefined
      },
      include: { contacts: true }
    });
  }

  async update(companyId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(companyId, id);
    const { contacts, ...clientData } = dto;

    return this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id },
        data: {
          ...clientData,
          email: clientData.email?.toLowerCase()
        }
      });

      if (contacts) {
        const contactsWithIds = contacts.filter((contact) => contact.id);
        const contactIds = contactsWithIds.map((contact) => contact.id!);

        if (contactIds.length) {
          const ownedContacts = await tx.clientContact.count({
            where: { id: { in: contactIds }, clientId: id }
          });

          if (ownedContacts !== contactIds.length) {
            throw new NotFoundException('Contacto no encontrado');
          }
        }

        await tx.clientContact.deleteMany({
          where: {
            clientId: id,
            ...(contactIds.length ? { id: { notIn: contactIds } } : {})
          }
        });

        await Promise.all(
          contactsWithIds.map((contact) =>
            tx.clientContact.update({
              where: { id: contact.id },
              data: this.toContactData(contact)
            })
          )
        );

        const newContacts = contacts.filter((contact) => !contact.id);
        if (newContacts.length) {
          await tx.clientContact.createMany({
            data: newContacts.map((contact) => ({
              clientId: id,
              ...this.toContactData(contact)
            }))
          });
        }
      }

      return tx.client.findUniqueOrThrow({
        where: { id },
        include: { contacts: { orderBy: { createdAt: 'asc' } } }
      });
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false }
    });
  }

  // ── Gestión de Contactos ──────────────────────────────

  async addContact(companyId: string, clientId: string, dto: CreateClientContactDto) {
    await this.findOne(companyId, clientId);
    return this.prisma.clientContact.create({
      data: { clientId, ...dto }
    });
  }

  async updateContact(companyId: string, clientId: string, contactId: string, dto: Partial<CreateClientContactDto>) {
    await this.findOne(companyId, clientId);
    return this.prisma.clientContact.update({
      where: { id: contactId },
      data: dto
    });
  }

  async removeContact(companyId: string, clientId: string, contactId: string) {
    await this.findOne(companyId, clientId);
    return this.prisma.clientContact.delete({ where: { id: contactId } });
  }

  private toContactData(contact: UpdateClientContactDto) {
    const { id: _id, ...data } = contact;
    return {
      ...data,
      email: data.email?.toLowerCase()
    };
  }
}
