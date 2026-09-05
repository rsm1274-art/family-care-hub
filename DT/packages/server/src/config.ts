import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  // Local-only app: the server never needs to be reached from another
  // machine, so it always binds loopback.
  host: process.env.HOST || '127.0.0.1',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: '30d',
  imagesDir: path.resolve(process.env.IMAGES_DIR || './data/images'),
  appVersion: '1.0.0',
};
