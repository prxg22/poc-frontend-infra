import * as aws from '@pulumi/aws'
import type * as pulumi from '@pulumi/pulumi'

export const createRemixLambda = (config: {
  service: string
  stage?: string
  role: aws.iam.Role
  code: pulumi.asset.AssetArchive
  handler: string
}) => {
  const { service, stage = 'dev' } = config
  const name = `${service}-${stage}-remix`
  const lambda = new aws.lambda.Function(name, {
    name: name,
    role: config.role.arn,
    runtime: 'nodejs18.x',
    handler: config.handler,
    code: config.code,
    timeout: 120,
  })

  return lambda
}

export const createRemixFunctionUrl = (config: {
  service: string
  stage?: string
  lambda: aws.lambda.Function
}) => {
  const name = `${config.service}-${config.stage}-remix-url`

  const lambdaUrl = new aws.lambda.FunctionUrl(name, {
    authorizationType: 'NONE',
    invokeMode: 'RESPONSE_STREAM',
    functionName: config.lambda.name,
    cors: {
      allowCredentials: true,
      allowHeaders: ['*'],
      allowMethods: ['*'],
      allowOrigins: ['*'],
    },
  })

  return lambdaUrl
}
