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
    post.matter.slug = "slug";
    post.title = "Wowz! This is amazing:: Next Chapter's 23";

    expect(post.id).to.equal("slug");
  });

  it('post with permalink should override', () => {
    let post = new Post();
    post.matter.slug = "slug";
    post.matter.permalink = "permalink";
    post.title = "Wowz! This is amazing:: Next Chapter's 23";

    expect(post.id).to.equal("permalink");
  });

  it('post date', () => {
    let post = new Post();
    post.matter.date = "2019-01-01";

    expect(post.date.getFullYear()).to.equal(2019);
  });

  it('post get body', () => {
    let post = new Post();
    post.matter.body = "foo";
    post.content = "*HOW*";

    expect(post.body).to.equal("foo");
  });

  it('post get matter', () => {
    let post = new Post();
    post.matter.cover = "foo";

    expect(post.matter.cover).to.equal("foo");
  });

  it('post set matter', () => {
    let post = new Post();
    post.matter = { tree: true}

    expect(post.matter.tree).to.equal(true);
  });

  it('post get published', () => {
    let post = new Post();

    expect(post.published).to.equal(true);
  });

  it('post set published', () => {
    let post = new Post();
    post.published = false;
    expect(post.published).to.equal(false);
  });

  it('post get summary', () => {
    let post = new Post();
    post.content = "*HOW*\n\n*COW*";

    expect(post.summary).to.equal("<p><em>HOW</em></p><p><em>COW</em></p>");
  });

  it('post get summary by description', () => {
    let post = new Post();
    post.content = "*HOW*\n\n*COW*";
    post.matter.description = "foo";

    expect(post.summary).to.equal("foo");
  });

  it('post get body / generate', () => {
    let post = new Post();
    post.content = "*HOW*";

    expect(post.body).to.equal("<p><em>HOW</em></p>\n");
  });

  it('post add tag with same name', () => {
    let post = new Post();
    post.tags.push("foo");

    post.addTag("foo");

    expect(post.tags.length).to.equal(1);
  });

  it('post add tag that is blank', () => {
    let post = new Post();

    post.addTag("");

    expect(post.tags.length).to.equal(0);
  });

  it('post add tag that is undefined', () => {
    let post = new Post();

    post.addTag(undefined);

    expect(post.tags.length).to.equal(0);
  });

  it('post add tag with same name', () => {
    let post = new Post();
    post.tags.push("foo");

    post.addTag("foo1");

    expect(post.tags.length).to.equal(2);
  });

  it('post add tags with same name', () => {
    let post = new Post();
    post.tags.push("foo");

    let tags = new Array<string>();
    tags.push("foo");
    tags.push("bar");
    tags.push("crazy");

    post.addTags(tags);

    expect(post.tags.length).to.equal(3);
  });

  it('post add tags undefined', () => {
    let post = new Post();
    post.tags.push("foo");

    let tags = new Array<string>();
    tags.push("foo");
    tags.push("bar");
    tags.push(undefined);

    post.addTags(tags);

    expect(post.tags.length).to.equal(2);
  });

  it('post parse url :title', () => {
    let post = new Post();
    
    post.matter.title = "wowza cool!"
    post.matter.date = "2019-01-01";
    let url = "/:title";

    expect(post.parseUrl(url)).to.equal("wowza-cool");
  });

  it('post parse url :title/:year', () => {
    let post = new Post();
    
    post.matter.title = "wowza cool!"
    post.matter.date = "2019-01-01";
    let url = "/:title/:year";

    expect(post.parseUrl(url)).to.equal("wowza-cool/2019");
  });

  it('post parse url :title/:year/:month', () => {
    let post = new Post();
    
    post.matter.title = "wowza cool!"
    post.matter.date = "2019-01-01";
    let url = "/:title/:year/:month";

    expect(post.parseUrl(url)).to.equal("wowza-cool/2019/01");
  });

  it('post parse url style none', () => {
    let post = new Post();
    
    post.matter.title = "wowza cool!"
    post.matter.date = "2019-01-01";
    let url = "default";

    expect(post.parseUrl(url)).to.equal("wowza-cool");
  });

  it('post parse url style date', () => {
    let post = new Post();
    
    post.matter.title = "wowza cool!"
    post.matter.date = "2019-01-01";
    let url = "date";

    expect(post.parseUrl(url)).to.equal("2019/01/01/wowza-cool");
  });

  it('post parse url style ordinal', () => {
    let post = new Post();
    
    post.matter.title = "wowza cool!"
    post.matter.date = "2019-01-01";
    let url = "ordinal";

    expect(post.parseUrl(url)).to.equal("2019/1/wowza-cool");
  });

});