import {getStore} from '@netlify/blobs';
import {createRequestHandler} from '../../server/request-service.mjs';
export default createRequestHandler({getStore});
export const config={path:'/api/request',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:10}};
