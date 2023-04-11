import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.useGlobalPipes(new ValidationPipe({
  transform: true,
}));

await app.listen(8080);
