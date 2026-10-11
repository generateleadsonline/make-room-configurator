import {getStore} from '@netlify/blobs';
import {createQuoteHandler} from '../../server/quote-service.mjs';
export default createQuoteHandler({getStore});
export const config={path:'/api/quote',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:30}};
