import { Tag } from '../src/tag';
import { expect } from 'chai';
import 'mocha';
import { Post } from '../src/post';

describe('Tag', () => {

  it('tag should have a valid name', () => {
    let tag = new Tag('cow');

    expect(tag.name).to.equal('cow');
  });

  it('tag should have a valid id', () => {
    let tag = new Tag("How's now: brown cow! -");

    expect(tag.id).to.equal("how-s-now-brown-cow");
  });

});