import { Readable } from 'node:stream';

export async function invoke(
  handler,
  { method = 'GET', url = '/api/transactions', headers = {}, body = '' } = {},
) {
  const request = Readable.from([Buffer.from(body)]);
  Object.assign(request, {
    method,
    url,
    headers: {
      host: 'localhost:3080',
      ...Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
      ),
    },
  });
  const result = { status: null, headers: {}, body: '' };
  const response = {
    setHeader(name, value) {
      result.headers[name] = value;
    },
    writeHead(status, values) {
      result.status = status;
      Object.assign(result.headers, values);
    },
    end(body) {
      result.body = body?.toString() || '';
    },
  };
  await handler(request, response);
  return result;
}
export function handlerRequest(handler) {
  return async (url, options = {}) => {
    const result = await invoke(handler, {
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || '',
    });
    return {
      ok: result.status >= 200 && result.status < 300,
      json: async () => JSON.parse(result.body),
    };
  };
}
