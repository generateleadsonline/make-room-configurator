import {getStore} from '@netlify/blobs';
import {createDiagHandler} from '../../server/diag-service.mjs';
export default createDiagHandler({getStore});
export const config={path:'/api/diag',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:20}};
