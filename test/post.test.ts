import { Tag } from '../src/tag';
import { expect } from 'chai';
import 'mocha';
import { Post } from '../src/post';

describe('Post', () => {

  it('post should should be published', () => {
    let post = new Post();

    post.publishedAt = new Date('12/12/2001');

    expect(post.isPublished()).to.equal(true);
  });


  it('post should not be published', () => {
    let post = new Post();

    post.publishedAt = new Date('12/12/2100');

    expect(post.isPublished()).to.equal(false);
  });
});