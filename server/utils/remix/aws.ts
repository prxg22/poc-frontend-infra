import type { Writable } from 'stream'

import type {
  AppLoadContext,
  ServerBuild,
  RequestInit as NodeRequestInit,
  Response as NodeResponse,
} from '@remix-run/node'
import {
  AbortController as NodeAbortController,
  Headers as NodeHeaders,
  Request as NodeRequest,
  createRequestHandler as createRemixRequestHandler,
  readableStreamToString,
  writeReadableStreamToWritable,
} from '@remix-run/node'
import type {
  APIGatewayProxyEventHeaders,
  Callback,
  Context,
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'

import { isBinaryType } from './binaryTypes'

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction = (
  event: APIGatewayProxyEventV2,
) => Promise<AppLoadContext> | AppLoadContext

export type RequestHandler = (
  ev: APIGatewayProxyEventV2,
  stream: Writable & { setContentType: (type: string) => void },
  ctx: Context,
  callback: Callback,
) => void

/**
 * Returns a request handler for Architect that serves the response using
 * Remix.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  build: ServerBuild
  getLoadContext?: GetLoadContextFunction
  mode?: string
}): RequestHandler {
  let handleRequest = createRemixRequestHandler(build, mode)

  return async (event) => {
    let request = createRemixRequest(event)
    let loadContext = await getLoadContext?.(event)

    // @ts-expect-error
    let response = (await handleRequest(request, loadContext)) as NodeResponse

    return sendRemixResponse(response)
  }
}

export function createStreamRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  build: ServerBuild
  getLoadContext?: GetLoadContextFunction
  mode?: string
}) {
  let handleRequest = createRemixRequestHandler(build, mode)

  // @ts-expect-error
  return awslambda.streamifyResponse(
    async (
      event: APIGatewayProxyEventV2,
      streamResponse: Writable & {
        setContentType: (type: string) => void
      },
    ) => {
      console.log('remix handler event', event)
      let request = createRemixRequest(event)
      let loadContext = await getLoadContext?.(event)

      let response = (await handleRequest(
        request as unknown as Request,
        loadContext,
      )) as unknown as NodeResponse

      sendStreamRemixResponse(response, streamResponse)
    },
  ) as RequestHandler
}

export function createRemixRequest(event: APIGatewayProxyEventV2): NodeRequest {
  let host = event.headers['x-forwarded-host'] || event.headers.host
  let search = event.rawQueryString.length ? `?${event.rawQueryString}` : ''
  let scheme = process.env.ARC_SANDBOX ? 'http' : 'https'
  let url = new URL(`${scheme}://${host}${event.rawPath}${search}`)
  let isFormData = event.headers['content-type']?.includes(
    'multipart/form-data',
  )
  // Note: No current way to abort these for Architect, but our router expects
  // requests to contain a signal so it can detect aborted requests
  let controller = new NodeAbortController()

  return new NodeRequest(url.href, {
    method: event.requestContext.http.method,
    // @ts-expect-error
    headers: createRemixHeaders(event.headers, event.cookies),
    // Cast until reason/throwIfAborted added
    // https://github.com/mysticatea/abort-controller/issues/36
    signal: controller.signal as NodeRequestInit['signal'],
    body:
      event.body && event.isBase64Encoded
        ? isFormData
          ? Buffer.from(event.body, 'base64')
          : Buffer.from(event.body, 'base64').toString()
        : event.body,
  })
}

export function createRemixHeaders(
  requestHeaders: APIGatewayProxyEventHeaders,
  requestCookies?: string[],
): NodeHeaders {
  let headers = new NodeHeaders()

  for (let [header, value] of Object.entries(requestHeaders)) {
    if (value) {
      headers.append(header, value)
    }
  }

  if (requestCookies) {
    headers.append('Cookie', requestCookies.join('; '))
  }

  return headers
}

export async function sendStreamRemixResponse(
  nodeResponse: NodeResponse,
  streamResponse: Writable & { setContentType: (type: string) => void },
) {
  let { statusCode, headers, isBase64Encoded } = parseResponse(nodeResponse)

  const metadata = {
    statusCode,
    headers,
    isBase64Encoded,
  }

  // @ts-expect-error
  streamResponse = awslambda.HttpResponseStream.from(streamResponse, metadata)

  if (!nodeResponse.body) {
    streamResponse.write('')

    return streamResponse.end()
  }
  return writeReadableStreamToWritable(nodeResponse.body, streamResponse)
}

export async function sendRemixResponse(
  nodeResponse: NodeResponse,
): Promise<APIGatewayProxyStructuredResultV2> {
  const { statusCode, headers, cookies, isBase64Encoded } =
    parseResponse(nodeResponse)

  let body: string | undefined

  if (cookies.length) {
    delete headers['Set-Cookie']
  }

  if (nodeResponse.body) {
    if (isBase64Encoded) {
      body = await readableStreamToString(nodeResponse.body, 'base64')
    } else {
      body = await nodeResponse.text()
    }
  }

  return {
    statusCode,
    headers,
    cookies,
    body,
    isBase64Encoded,
  }
}

function parseResponse(nodeResponse: NodeResponse) {
  let cookies: string[] = []

  // Arc/AWS API Gateway will send back set-cookies outside of response headers.
  for (let [key, values] of Object.entries(nodeResponse.headers.raw())) {
    if (key.toLowerCase() === 'set-cookie') {
      for (let value of values) {
        cookies.push(value)
      }
    }
  }

  let contentType = nodeResponse.headers.get('Content-Type')
  let isBase64Encoded = isBinaryType(contentType)

  return {
    statusCode: nodeResponse.status,
    headers: Object.fromEntries(nodeResponse.headers.entries()),
    contentType,
    cookies,
    isBase64Encoded,
  }
}
