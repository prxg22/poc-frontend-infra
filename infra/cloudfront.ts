import * as aws from '@pulumi/aws'

export const createPublicBucketOriginAccessIdentity = (config: {
  service: string
  stage?: string
}) => {
  const { service, stage = 'dev' } = config
  const name = `${service}-${stage}-public-oai`
  const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(name, {
    comment: `Origin Access Identity to Access ${service}-${stage}-public bucket ${stage}`,
  })
  return originAccessIdentity
}

export const createRemixCachePolicy = (config: {
  service: string
  stage?: string
}) => {
  const name = `${config.service}-${config.stage}-remix-cache-policy`
  const cachePolicy = new aws.cloudfront.CachePolicy(name, {
    name,
    defaultTtl: 0,
    minTtl: 0,
    maxTtl: 31536000, // 1 year
    parametersInCacheKeyAndForwardedToOrigin: {
      cookiesConfig: {
        cookieBehavior: 'all',
      },
      enableAcceptEncodingGzip: true,
      headersConfig: {
        headerBehavior: 'none',
      },
      queryStringsConfig: {
        queryStringBehavior: 'all',
      },
    },
  })
  return cachePolicy
}

export const createRemixDistribution = (config: {
  service: string
  stage?: string
  publicBucket: aws.s3.Bucket
  publicSource: string
  lambdaUrl: aws.lambda.FunctionUrl
  remixCachePolicy: aws.cloudfront.CachePolicy
  publicOriginAccessIdentity: aws.cloudfront.OriginAccessIdentity
  host: string
  certificateArn?: string
  aliases?: string[]
}) => {
  const { service, stage = 'dev' } = config
  const name = `${service}-${stage}-remix-distribution`

  const distribution = new aws.cloudfront.Distribution(name, {
    aliases: config.aliases,
    origins: [
      {
        domainName: config.publicBucket.bucketRegionalDomainName,
        originId: config.publicBucket.arn,
        originPath: config.publicSource.startsWith('/')
          ? config.publicSource
          : `/${config.publicSource}`,
        s3OriginConfig: {
          originAccessIdentity: config.publicOriginAccessIdentity.id.apply(
            (id) => `origin-access-identity/cloudfront/${id}`,
          ),
        },
      },
      {
        domainName: config.lambdaUrl.functionUrl.apply(
          (url) => new URL(url).host,
        ),
        originId: config.lambdaUrl.id,
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: 'https-only',
          originSslProtocols: ['TLSv1.2'],
        },
        customHeaders: [
          {
            name: 'X-Forwarded-Host',
            value: config.host,
          },
        ],
      },
    ],
    customErrorResponses: [
      {
        errorCachingMinTtl: 60,
        errorCode: 403,
        responseCode: 404,
        responsePagePath: '/404',
      },
    ],
    defaultCacheBehavior: {
      allowedMethods: [
        'GET',
        'HEAD',
        'OPTIONS',
        'PATCH',
        'POST',
        'PUT',
        'DELETE',
      ],
      cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
      compress: true,
      cachePolicyId: config.remixCachePolicy.id,
      targetOriginId: config.lambdaUrl.id,
      viewerProtocolPolicy: 'redirect-to-https',
    },
    orderedCacheBehaviors: [
      {
        pathPattern: 'static/*',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
        compress: true,
        forwardedValues: {
          queryString: true,
          cookies: {
            forward: 'none',
          },
        },
        targetOriginId: config.publicBucket.arn,
        viewerProtocolPolicy: 'redirect-to-https',
      },
      {
        pathPattern: 'assets/*',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
        compress: true,
        forwardedValues: {
          queryString: true,
          cookies: {
            forward: 'none',
          },
        },
        targetOriginId: config.publicBucket.arn,
        viewerProtocolPolicy: 'redirect-to-https',
      },
    ],
    enabled: true,
    httpVersion: 'http2',
    priceClass: 'PriceClass_All',
    viewerCertificate: config.certificateArn
      ? {
          acmCertificateArn: config.certificateArn,
          sslSupportMethod: 'sni-only',
        }
      : { cloudfrontDefaultCertificate: true },
    restrictions: {
      geoRestriction: {
        restrictionType: 'none',
      },
    },
  })

  return distribution
}
