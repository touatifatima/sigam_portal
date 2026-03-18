export class CreateMessageDto {
  content: string;
  receiverId: number;
  entityType?: 'DEMANDE' | 'PERMIS' | 'GENERAL' | string;
  entityCode?: string;
}
