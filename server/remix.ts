import * as build from '@remix-run/dev/server-build'
import { installGlobals } from '@remix-run/node'
// import type {
//   APIGatewayProxyEventHeaders,
//   Callback,
//   Context,
//   APIGatewayProxyEventV2,
//   APIGatewayProxyStructuredResultV2,
// } from 'aws-lambda'
// import { streamifyResponse, type ResponseStream } from 'lambda-stream'

import { createStreamRequestHandler } from './utils/remix/aws'
installGlobals()

export const handler = createStreamRequestHandler({
  build,
  mode: process.env.NODE_ENV,
})

// export const handler = awslambda.streamifyResponse(
//   async (ev: APIGatewayProxyEventV2, stream: ResponseStream) => {
//     const metadata = {
//       status: 404,
//       headers: {
//         'Content-Type': 'text/plain',
//         'Cache-Control': 'no-cache',
//       },
//     }

//     stream = awslambda.HttpResponseStream.from(stream, metadata)
//     stream.setContentType('text/html')

//     stream.write('Not found!')
//     await new Promise((resolve) => setTimeout(resolve, 1000))
//     stream.write('this found was not found!')
//     await new Promise((resolve) => setTimeout(resolve, 1000))
//     stream.write('I mean it')
//     await new Promise((resolve) => setTimeout(resolve, 1000))
//     stream.end()
//   },
// )
