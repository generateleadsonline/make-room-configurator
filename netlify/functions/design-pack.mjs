import {getStore} from '@netlify/blobs';
import {createPdfHandler} from '../../server/pdf-service.mjs';
export default createPdfHandler({getStore});
export const config={path:'/api/design-pack',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:30}};
