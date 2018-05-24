import {Config} from '../src/classes/config';
import {CacheService} from '../src/services/cacheService';
import { expect } from 'chai';
import 'mocha';

describe('Cache Service', () => {

  let cache = new CacheService(new Config());


  it('check to see if the config is valid', () => {

    expect(cache.__config.cacheProvider).to.contain('memory');
  });

  it('check to see if the config via setConfig', () => {

    let configBlue = new Config();
    configBlue.cacheProvider = 'blue';

    let cacheBlue = new CacheService(new Config());

    cacheBlue.setConfig(configBlue);

    expect(cacheBlue.__config.cacheProvider).to.contain('blue');
  });

  it('validate that memory provider does exist', () => {

    expect(cache.getProvider('memory')).to.not.equal(undefined);
  });


 

});