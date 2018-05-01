import { Tag } from '../src/classes/tag';
import { expect } from 'chai';
import 'mocha';

describe('Tag', () => {

  it('should return the correct name', () => {
    let tag = new Tag('cow');

    expect(tag.name).to.equal('cow');
  });

});