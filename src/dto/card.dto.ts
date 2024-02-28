import { IsString, IsDefined, IsUUID, Length } from "class-validator";

export class Card {
  @IsString()
  @IsDefined()
  @Length(5, 30)
  title: string;

  @IsString()
  @IsDefined()
  @Length(5, 500)
  description: string;

  @IsString()
  dueDate: Date;

  @IsDefined()
  @IsUUID()
  listId: string;

  @IsDefined()
  @IsUUID()
  userId: string;
}
