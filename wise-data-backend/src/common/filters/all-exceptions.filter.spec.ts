import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('SQL details', {
    code,
    clientVersion: 'test',
  });
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('keeps status and message of HTTP exceptions', () => {
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('Table not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Table not found',
    });
  });

  it('forwards validation details', () => {
    const { host, json } = createHost();
    const details = [{ path: 'name', message: 'Required' }];

    filter.catch(
      new BadRequestException({ message: 'Validation failed', details }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, details }),
    );
  });

  it('maps unique constraint violations to 409 without leaking SQL', () => {
    const { host, json } = createHost();

    filter.catch(prismaError('P2002'), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Resource already exists',
    });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const { host, json } = createHost();

    filter.catch(new Error('connection string with password'), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });

  it('keeps the status of request errors from Express middleware', () => {
    const { host, json } = createHost();
    // What body-parser throws for a body over its size limit.
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
      type: 'entity.too.large',
    });

    filter.catch(tooLarge, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'Payload Too Large',
    });
  });

  it('treats unknown Prisma errors as 500', () => {
    const { host, status } = createHost();

    filter.catch(prismaError('P1001'), host);

    expect(status).toHaveBeenCalledWith(500);
  });
});
