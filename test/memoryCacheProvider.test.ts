import { expect } from 'chai';
import 'mocha';

import {Config} from '../src/classes/config';
import { MemoryCacheProvider, MemoryCacheItem } from '../src/providers/memoryCacheProvider';
import * as moment from 'moment';

describe('Memory Cache Provider', () => {

  it('memory cache item values', () => {

    let item = new MemoryCacheItem('blah');

    expect(item.obj).to.equal('blah');
  });
 
  it('memory cache item does auto ttl', () => {

    let item = new MemoryCacheItem('blah');

    expect(item.ttl).to.not.equal(undefined);
  });

  it('memory cache item does auto ttl', () => {

    let ttl = moment().add(70, 'm').toDate();
    let item = new MemoryCacheItem('blah', ttl);

    expect(item.ttl).to.equal(ttl);
  });

  it('memory cache item is valid', () => {

    let ttl = moment().add(70, 'm').toDate();
    let item = new MemoryCacheItem('blah', ttl);

    expect(item.isValid()).to.equal(true);
  });

  it('memory cache item is not valid', () => {

    let ttl = moment().add(-70, 'm').toDate();
    let item = new MemoryCacheItem('blah', ttl);

    expect(item.isValid()).to.equal(false);
  });

  it('memory cache provider add an item', () => {
    
    let cache = new MemoryCacheProvider();
    cache.setConfig(new Config());

    cache.set('blah', 'foo');

    expect(cache.has('blah')).to.equal(true);
  });

  it('memory cache provider add an with name foo', () => {
    
    let cache = new MemoryCacheProvider();
    cache.setConfig(new Config());

    cache.set('blah', 'foo');

    expect(cache.get('blah')).to.equal('foo');
  });

  it('memory cache provider add an object', () => {
    
    let cache = new MemoryCacheProvider();
    cache.setConfig(new Config());

    let obj = {name:"foo"};

    cache.set('blah', obj);

    expect(cache.get('blah')).to.equal(obj);
  });

  it('memory cache provider delete an object', () => {
    
    let cache = new MemoryCacheProvider();
    cache.setConfig(new Config());

    let obj = {name:"foo"};

    cache.set('blah', obj);
    cache.set('spark', 'flame');

    cache.delete('blah');

    expect(cache.get('blah')).to.equal(undefined);
    expect(cache.get('spark')).to.equal('flame');
  });

  it('memory cache provider add an handling cases', () => {
    
    let cache = new MemoryCacheProvider();
    cache.setConfig(new Config());

    let obj = {name:"foo"};

    cache.set('BlAh', obj);

    expect(cache.get('blah')).to.equal(undefined);
  });

  it('memory cache provider init with config', () => {

    let config = new Config();
    config.cacheTTL = -70;
    let cache = new MemoryCacheProvider();
    cache.setConfig(config);

    cache.set('blah', 'foo');

    expect(cache.get('blah')).to.equal(undefined);
  });


});