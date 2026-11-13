import { ChatModel, ModelUnavailableError } from './chat-model';

const rejected = () =>
  new Response(
    JSON.stringify({
      error: {
        message: 'Tool call validation failed',
        code: 'tool_use_failed',
      },
    }),
    { status: 400 },
  );
const answered = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
  });

describe('ChatModel', () => {
  const model = new ChatModel({
    apiKey: 'test-key',
    baseUrl: 'https://provider.test/v1',
    model: 'test-model',
  });
  const fetchMock = jest.spyOn(global, 'fetch');
  const messages = [{ role: 'user' as const, content: 'hola' }];

  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  it('asks again when the provider rejects a malformed tool call', async () => {
    fetchMock
      .mockResolvedValueOnce(rejected())
      .mockResolvedValueOnce(answered('¡Hola!'));

    await expect(model.complete(messages, [])).resolves.toEqual({
      content: '¡Hola!',
      toolCalls: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up as unavailable when the tool call is rejected twice', async () => {
    fetchMock
      .mockResolvedValueOnce(rejected())
      .mockResolvedValueOnce(rejected());

    await expect(model.complete(messages, [])).rejects.toBeInstanceOf(
      ModelUnavailableError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry other bad requests', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 }),
    );

    await expect(model.complete(messages, [])).rejects.not.toBeInstanceOf(
      ModelUnavailableError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
