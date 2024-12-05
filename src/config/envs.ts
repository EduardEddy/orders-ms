import 'dotenv/config';

import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  //PRODUCTS_MICROSERVICE_HOST: string;
  //PRODUCTS_MICROSERVICE_port: number;
  NATS_SERVERS: string[];
}

const envVarsSchema = joi
  .object({
    PORT: joi.number().required(),
    //PRODUCTS_MICROSERVICE_HOST: joi.string().required(),
    //PRODUCTS_MICROSERVICE_port: joi.number().required(),
    NATS_SERVERS: joi.array().items(joi.string()).required(),
  })
  .unknown();

const { error, value } = envVarsSchema.validate({
  ...process.env,
  NATS_SERVERS: process.env.NATS_SERVERS?.split(','),
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  natsServers: envVars.NATS_SERVERS,
  //productMicroServiceHost: envVars.PRODUCTS_MICROSERVICE_HOST,
  //productMicroServicePort: envVars.PRODUCTS_MICROSERVICE_port
};
