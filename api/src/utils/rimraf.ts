import nodeUtils from 'util';
import rimrafCb from 'rimraf';

export const rimraf = nodeUtils.promisify(rimrafCb);
