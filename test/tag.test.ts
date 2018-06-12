import { Tag } from '../src/tag';
import { expect } from 'chai';
import 'mocha';
import { Post } from '../src/post';

describe('Tag', () => {

  it('tag should have a valid name', () => {
    let tag = new Tag('cow');

    expect(tag.name).to.equal('cow');
  });

  it('tag should not be published', () => {
    let tag = new Tag('cow');

    expect(tag.isPublished()).to.equal(false);
  });

  it('tag should should be published', () => {
    let tag = new Tag('cow');
    let postFilePath = __dirname + '/blog/article1.md';
    let post = new Post();

    post.publishedAt = new Date('12/12/2001');

    tag.posts.push(post);

    expect(tag.isPublished()).to.equal(true);
  });
});