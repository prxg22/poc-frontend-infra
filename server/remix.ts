import { createRequestHandler } from '@remix-run/architect'
import * as build from '@remix-run/dev/server-build'
import { installGlobals } from '@remix-run/node'
import type { APIGatewayProxyEventV2, Context, Callback } from 'aws-lambda'
import type { ResponseStream } from 'lambda-stream'
import { streamifyResponse } from 'lambda-stream'

installGlobals()

export const handler = streamifyResponse(
  async (
    ev: APIGatewayProxyEventV2,
    stream: ResponseStream,
    ctx: Context,
    cb: Callback,
  ) => {
    // stream.setContentType('text/html')
    // stream.write('<html><body>Hello World</body></html>')
    // stream.end()
    const handler = createRequestHandler({
      build,
      mode: process.env.NODE_ENV,
    })

    const response = await handler(ev, ctx, cb)

    if (!response) {
      return {
        statusCode: 404,
        body: 'Not Found',
      }
    }

    return response
  },
)
