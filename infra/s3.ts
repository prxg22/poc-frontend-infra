import fs from 'fs'
import path from 'path'

import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

export const createPublicBucket = (config: {
  service: string
  source: string
  stage?: string
}) => {
  const { service, source = 'public', stage = 'dev' } = config

  const bucketName = `${service}-${stage}-public`
  const bucket = new aws.s3.Bucket(bucketName, {
    bucket: bucketName,
  })

  const bucketObjects = syncSourceDirectoryToBucket({
    bucket,
    source,
  })

  return {
    bucket,
    bucketObjects,
  }
}

export const createPublicBucketPolicy = async (config: {
  service: string
  publicBucket: aws.s3.Bucket
  policyDocument: pulumi.Output<aws.iam.GetPolicyDocumentResult>
  stage?: string
}) => {
  const { service, publicBucket, stage = 'dev' } = config
  const name = `${service}-${stage}-public-policy`
  const bucketPolicy = new aws.s3.BucketPolicy(name, {
    bucket: publicBucket.bucket,
    policy: config.policyDocument.apply((policy) => policy.json),
  })

  return bucketPolicy
}

export const createPublicBucketPolicyDocument = (config: {
  bucket: aws.s3.Bucket
  oai: aws.cloudfront.OriginAccessIdentity
}) => {
  return aws.iam.getPolicyDocumentOutput({
    version: '2012-10-17',
    statements: [
      {
        actions: ['s3:GetObject'],
        resources: config.bucket.arn.apply((arn) => [arn, `${arn}/*`]),
        effect: 'Allow',
        principals: [
          {
            type: 'AWS',
            identifiers: [config.oai.iamArn],
          },
        ],
      },
    ],
  })
}

const syncSourceDirectoryToBucket = (config: {
  bucket: aws.s3.Bucket
  source: string
}): aws.s3.BucketObject[] => {
  const { bucket, source } = config
  const files = fs.readdirSync(source)

  const bucketObjects = files.reduce((acc, file) => {
    const key = `${source}/${file}`
    const state = fs.statSync(key)
    if (state.isDirectory()) {
      return [...acc, ...syncSourceDirectoryToBucket({ bucket, source: key })]
    }

    const object = new aws.s3.BucketObject(key, {
      bucket: bucket.bucket,
      contentType: mimeTypes[path.extname(key) as keyof typeof mimeTypes],
      key,
      source: new pulumi.asset.FileAsset(key),
    })

    return [...acc, object]
  }, [] as aws.s3.BucketObject[])

  return bucketObjects
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.xml': 'text/xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
}
