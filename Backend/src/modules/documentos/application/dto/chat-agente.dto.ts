// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /documentos/chat (solicitud en lenguaje natural)
// =================================================================
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatAgenteDTO {
    @IsNotEmpty({ message: 'Escribe tu solicitud' })
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    mensaje!: string;
}
