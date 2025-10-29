import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { SwaggerConfig } from 'config/swagger.config';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get<ConfigService>(ConfigService);
    /* Adding Swagger documentation */
    const document = SwaggerModule.createDocument(app, SwaggerConfig);
    const filePath = path.resolve('swagger/swagger.json');

    fs.writeFileSync(filePath, JSON.stringify(document, null, 2), 'utf-8');
    SwaggerModule.setup('api-doc', app, document);
    const serverPort = configService.get('server.port') as number;

    await app.listen(serverPort);
    const logger = new Logger('Bootstrap');

    logger.log(`Application is running on: ${await app.getUrl()}`);
    logger.verbose(`Server is running on port -> ${serverPort}`);
}
bootstrap();
