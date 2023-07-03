import type { GetCallerIdentityResult } from '@pulumi/aws'
import * as aws from '@pulumi/aws'

export const createRemixLogsPolicy = (config: {
  service: string
  stage?: string
}) => {
  const name = `${config.service}-${config.stage}-logs-policy`
  return {
    name,
    policy: new aws.iam.Policy(name, {
      name,
      description: `Policy for ${config.service}`,
      policy: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            Resource: '*',
            Effect: 'Allow',
          },
        ],
      },
    }),
  }
}

export const createLambdaExecutionPolicy = (config: {
  service: string
  lambdas?: { name: string; stage?: string }[]
  stage?: string
  region?: string
  identity: Promise<GetCallerIdentityResult>
}) => {
  const { stage = 'dev', region = 'us-east-2', identity } = config
  const name = `${config.service}-${config.stage}-execute-lambda-policy`
  const Resource = identity.then(({ accountId }) => {
    const external =
      config.lambdas?.map((lambda) => {
        const functionName = makeFunctionName({
          lambdaName: lambda.name,
          stage: lambda.stage || stage,
        })

        return `arn:aws:lambda:${region}:${accountId}:function:${functionName}`
      }) || []
    const self = `arn:aws:lambda:${region}:${accountId}:function:${config.service}-${stage}-*`

    return [...external, self]
  })

  return {
    name,
    policy: new aws.iam.Policy(name, {
      name,
      description: `Policy for ${config.service}`,
      policy: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: [
              'lambda:InvokeFunction',
              'lambda:InvokeAsync',
              'lambda:CreateFunctionUrlConfig',
            ],
            Resource,
            Effect: 'Allow',
          },
        ],
      },
    }),
  }
}

export const createLambdaUrlExecutionPermission = (config: {
  service: string
  stage?: string
  region?: string
  lambda: aws.lambda.Function
}) => {
  const name = `${config.service}-${config.stage}-execute-lambda-url-permission`

  return {
    name,
    policy: new aws.lambda.Permission(name, {
      action: 'lambda:InvokeFunctionUrl',
      principal: '*',
      functionUrlAuthType: 'NONE',
      function: config.lambda.arn,
    }),
  }
}

export const createRemixLambdaRole = (config: {
  service: string
  stage?: string
  policies: { name: string; policy: aws.iam.Policy }[]
}) => {
  const name = `${config.service}-${config.stage}-remix-role`

  const role = new aws.iam.Role(name, {
    name: name,
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: 'lambda.amazonaws.com',
    }),
  })

  const rolePoliciesAttachments = config.policies.map((policy) => {
    return new aws.iam.RolePolicyAttachment(policy.name, {
      role: role,
      policyArn: policy.policy.arn,
    })
  })

  return {
    role,
    rolePoliciesAttachments,
  }
}

const makeFunctionName = (options: { lambdaName: string; stage: string }) => {
  const [service, functionName] = options.lambdaName.split('/')

  return `${service}-${options.stage}-${functionName}`
}
