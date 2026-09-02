import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  StreamableFile,
  Res
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateCommercialStatusDto } from './dto/update-commercial-status.dto';
import { UpdateProductionStatusDto } from './dto/update-production-status.dto';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { AssignOrderDto } from './dto/assign-order.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AddEventDto } from './dto/add-event.dto';
import { AddConsumptionDto } from './dto/add-consumption.dto';
import { UpdateConsumptionDto } from './dto/update-consumption.dto';
import { CloseDeliveryDto } from './dto/close-delivery.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';
import { UpdateStageStatusDto } from './dto/update-stage-status.dto';
import { StageCommentDto } from './dto/stage-comment.dto';
import { RejectQualityControlDto } from './dto/reject-quality-control.dto';
import { Throttle } from '@nestjs/throttler';
import { isAllowedUpload } from '../../common/security/upload-policy';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get('stats')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  stats(@CurrentUser() user: JwtUser) {
    return this.service.getStats(user.companyId);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Query('commercialStatus') commercialStatus?: string,
    @Query('productionStatus') productionStatus?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
    @Query('tab') tab?: string,
    @Query('noPurchaseOrder') noPurchaseOrder?: string,
    @Query('assignedToMe') assignedToMe?: string
  ) {
    return this.service.findAll(user, {
      commercialStatus,
      productionStatus,
      clientId,
      search,
      tab,
      noPurchaseOrder: noPurchaseOrder === 'true',
      assignedToMe: assignedToMe === 'true'
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateOrderDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/commercial-status')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  updateCommercialStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommercialStatusDto
  ) {
    return this.service.updateCommercialStatus(user, id, dto);
  }

  @Patch(':id/production-status')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  changeProductionStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductionStatusDto
  ) {
    return this.service.changeProductionStatus(user, id, dto);
  }

  @Post(':id/approve')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  approve(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApproveOrderDto
  ) {
    return this.service.approve(user, id, dto);
  }

  @Post(':id/assignments')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  assign(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: AssignOrderDto) {
    return this.service.assign(user, id, dto);
  }

  @Patch(':id/assignments/:assignmentId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  updateAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDto
  ) {
    return this.service.updateAssignment(user, id, assignmentId, dto);
  }

  @Delete(':id/assignments/:assignmentId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  removeAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string
  ) {
    return this.service.removeAssignment(user, id, assignmentId);
  }

  @Post(':id/events')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  addEvent(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddEventDto) {
    return this.service.addEvent(user, id, dto);
  }

  @Patch(':id/stages/:stageId/status')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  updateStageStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageStatusDto
  ) {
    return this.service.updateStageStatus(user, id, stageId, dto);
  }

  @Post(':id/stages/:stageId/reject')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  rejectQualityControl(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: RejectQualityControlDto
  ) {
    return this.service.rejectQualityControl(user, id, stageId, dto);
  }

  @Get(':id/stages/:stageId/comments')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  listStageComments(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string
  ) {
    return this.service.listStageComments(user, id, stageId);
  }

  @Post(':id/stages/:stageId/comments')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  addStageComment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: StageCommentDto
  ) {
    return this.service.addStageComment(user, id, stageId, dto);
  }

  @Patch(':id/stages/:stageId/comments/:commentId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  updateStageComment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Param('commentId') commentId: string,
    @Body() dto: StageCommentDto
  ) {
    return this.service.updateStageComment(user, id, stageId, commentId, dto);
  }

  @Delete(':id/stages/:stageId/comments/:commentId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  removeStageComment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Param('commentId') commentId: string
  ) {
    return this.service.removeStageComment(user, id, stageId, commentId);
  }

  @Post(':id/consumptions')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  addConsumption(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AddConsumptionDto
  ) {
    return this.service.addConsumption(user, id, dto);
  }

  @Patch(':id/consumptions/:consumptionId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  updateConsumption(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('consumptionId') consumptionId: string,
    @Body() dto: UpdateConsumptionDto
  ) {
    return this.service.updateConsumption(user, id, consumptionId, dto);
  }

  @Delete(':id/consumptions/:consumptionId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN', 'OPERARIO')
  removeConsumption(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('consumptionId') consumptionId: string
  ) {
    return this.service.removeConsumption(user, id, consumptionId);
  }

  @Post(':id/close-delivery')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  closeDelivery(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CloseDeliveryDto
  ) {
    return this.service.closeDelivery(user, id, dto);
  }

  @Post(':id/attachments')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  @Throttle({ default: { ttl: 600000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './data/uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname).toLowerCase());
        }
      }),
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldNameSize: 50 },
      fileFilter: (req, file, cb) => {
        cb(null, isAllowedUpload(file.originalname, file.mimetype));
      }
    })
  )
  uploadAttachment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
        fileIsRequired: true
      })
    )
    file: Express.Multer.File,
    @Body('isInternal') isInternal?: string
  ) {
    return this.service.addAttachment(user.companyId, id, file, user.sub, isInternal === 'true');
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const attachment = await this.service.getAttachmentFile(user, id, attachmentId);
    const safeName = attachment.fileName
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/[\r\n"\\]/g, '_');
    response.set({
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store'
    });
    return new StreamableFile(createReadStream(attachment.absolutePath));
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  removeAttachment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string
  ) {
    return this.service.removeAttachment(user.companyId, id, attachmentId, user.sub);
  }

  @Patch(':id/attachments/:attachmentId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  updateAttachment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Body() dto: UpdateAttachmentDto
  ) {
    return this.service.updateAttachment(user.companyId, id, attachmentId, dto, user.sub);
  }

  @Delete(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
