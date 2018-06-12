import {Config} from '../src/config';
import {CacheService} from '../src/services/cacheService';
import { expect } from 'chai';
import 'mocha';

describe('Cache Service', () => {

  let cache = new CacheService(new Config());

  it('validate that memory provider does exist', () => {

    expect(cache.getProvider('memory')).to.not.equal(undefined);
  });


 

});