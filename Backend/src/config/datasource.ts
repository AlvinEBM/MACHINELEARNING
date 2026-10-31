// =================================================================
// CAPA: Config
// Configuración de la conexión a MySQL vía TypeORM.
//
// IMPORTANTE: La opción "entities" usa un patrón glob que
// busca TODOS los archivos *.model.ts dentro de cualquier módulo,
// sin importar cuántas carpetas tenga anidadas.
// Esto permite agregar nuevos módulos sin tocar esta config.
// =================================================================
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    // Busca recursivamente cualquier archivo *.model.ts/js dentro de modules/
    entities: [
        __dirname + '/../modules/**/infrastructure/models/*.model.{ts,js}',
    ],
});