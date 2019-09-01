import { expect } from 'chai';
import 'mocha';
import { Post } from '../src/post';

describe('Post', () => {

  it('post should handle a correct id', () => {
    let post = new Post();
    post.title = "Wowz! This is amazing: Next Chapter";

    expect(post.id).to.equal("wowz-this-is-amazing-next-chapter");
  });

  it('post should handle a correct id with double space', () => {
    let post = new Post();
    post.title = "Wowz! This is amazing:: Next Chapter's 23";

    expect(post.id).to.equal("wowz-this-is-amazing-next-chapter-s-23");
  });

  it('post should not generate an id from title if the url is set', () => {
    let post = new Post();
    post.url = "the-largest-whale";
    post.title = "Wowz! This is amazing:: Next Chapter's 23";

    expect(post.id).to.equal("the-largest-whale");
  });

  it('post get author', () => {
    let post = new Post();
    post.author = "foo";

    expect(post.author).to.equal("foo");
  });

  it('post should not generate an id from title if the url is after', () => {
    let post = new Post();
    post.title = "Wowz! This is amazing:: Next Chapter's 23";
    post.url = "the-largest-whale";

    expect(post.id).to.equal("the-largest-whale");
  });

  it('post with slug should override', () => {
    let post = new Post();
    post.metaData.slug = "slug";
    post.title = "Wowz! This is amazing:: Next Chapter's 23";

    expect(post.id).to.equal("slug");
  });

  it('post with permalink should override', () => {
    let post = new Post();
    post.metaData.slug = "slug";
    post.metaData.permalink = "permalink";
    post.title = "Wowz! This is amazing:: Next Chapter's 23";

    expect(post.id).to.equal("permalink");
  });

  it('post date', () => {
    let post = new Post();
    let date = new Date;
    post.date = date;

    expect(post.date).to.equal(date);
  });

  it('post get body', () => {
    let post = new Post();
    post.metaData.body = "foo";
    post.content = "*HOW*";

    expect(post.body).to.equal("foo");
  });

  it('post get body / generate', () => {
    let post = new Post();
    post.content = "*HOW*";

    expect(post.body).to.equal("<p><em>HOW</em></p>\n");
  });

});