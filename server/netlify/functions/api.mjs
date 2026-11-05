import serverless from 'serverless-http'
import app from '../../src/server.js'

const expressHandler = serverless(app)

export const handler = (event, context) => {
  const requestContext = event.requestContext || {}
  const identity = requestContext.identity || {}
  const forwardedIp = event.headers?.['x-nf-client-connection-ip'] || event.headers?.['X-Nf-Client-Connection-Ip']

  return expressHandler({
    ...event,
    requestContext: {
      ...requestContext,
      identity: { ...identity, sourceIp: identity.sourceIp || context?.ip || forwardedIp || '127.0.0.1' },
      requestId: requestContext.requestId || context?.requestId,
    },
  }, context)
}
