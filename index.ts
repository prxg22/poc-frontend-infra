import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import {
  createRemixCachePolicy,
  createRemixDistribution,
  createPublicBucketOriginAccessIdentity,
} from './infra/cloudfront'
import {
  createLambdaExecutionPolicy,
  createLambdaUrlExecutionPermission,
  createRemixLambdaRole,
  createRemixLogsPolicy,
} from './infra/iam'
import { createRemixLambda, createRemixFunctionUrl } from './infra/lambda'
import {
  createPublicBucket,
  createPublicBucketPolicyDocument,
  createPublicBucketPolicy,
} from './infra/s3'
import pkg from './package.json'

const publicSource = 'public'
const serverSource = 'server/build'
const service = pkg.name.replace('@lemonenergy/', '')
const stage = pulumi.getStack()
// const backendStage = process.env.BACKEND_STAGE || stage

const identity = aws.getCallerIdentity({ async: true })

const publicBucket = createPublicBucket({
  service,
  stage,
  source: publicSource,
})

const { role } = createRemixLambdaRole({
  service,
  stage,
  policies: [
    createLambdaExecutionPolicy({
      service,
      stage,
      identity,
    }),
    createRemixLogsPolicy({
      service,
      stage,
    }),
  ],
})

const remixLambda = createRemixLambda({
  service,
  stage,
  code: new pulumi.asset.AssetArchive({
    '.': new pulumi.asset.FileArchive(serverSource),
    // 'package.json': new pulumi.asset.FileAsset('./package.json'),
    // 'node_modules': new pulumi.asset.FileArchive('./node_modules'),
  }),
  handler: 'index.handler',
  role,
})

createLambdaUrlExecutionPermission({
  service,
  stage,
  lambda: remixLambda,
})

const remixFunctionUrl = createRemixFunctionUrl({
  service,
  stage,
  lambda: remixLambda,
})

let cdn: aws.cloudfront.Distribution | undefined

const oai = createPublicBucketOriginAccessIdentity({
  service,
  stage,
})

createPublicBucketPolicy({
  service,
  stage,
  publicBucket: publicBucket.bucket,
  policyDocument: createPublicBucketPolicyDocument({
    oai,
    bucket: publicBucket.bucket,
  }),
})

if (stage !== 'dev') {
  const remixCachePolicy = createRemixCachePolicy({
    service,
    stage,
  })

  cdn = createRemixDistribution({
    service,
    stage,
    publicBucket: publicBucket.bucket,
    publicSource,
    lambdaUrl: remixFunctionUrl,
    remixCachePolicy,
    publicOriginAccessIdentity: oai,
    host: '',
  })
}

export const functionUrl = remixFunctionUrl.functionUrl
export const cdnUrl = cdn?.domainName.apply(
  (domainName) => `https://${domainName}`,
)
