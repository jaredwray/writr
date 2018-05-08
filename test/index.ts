import * as wr from '../src/index';
import { Post } from '../src/classes/post';
import { Config } from '../src/classes/config'
import { expect } from 'chai';
import 'mocha';

describe('Writr', () => {

  beforeEach(() => {

    let config : Config = new Config();
    config.postPath = __dirname + '/blog';
    config.contentPath = __dirname + '/blog/content';
    config.templatePath = __dirname + '/blog/templates';

    wr.init(config);

  });

  it('config gets setup in init', () => {

    let config = __dirname + '/blog/content';

    expect(wr.getConfig().contentPath).to.equal(config);
  });

  it('get all of the posts', () => {

    let posts = wr.getPosts();

    expect(posts.length).to.equal(4);
  });

  it('get all of the posts to be published', () => {

    let posts = wr.getPublishedPosts();

    expect(posts.length).to.equal(3);
  });

  it('should generate the tags', () => {

    let posts = wr.getPosts();

    let tags = wr.generateTags(posts);

    expect(tags.length).to.be.greaterThan(0);
  });

  it('tag whale should exists', () => {

    let tag = wr.getTag('whale');

    expect(tag).not.equal(null);
  });

  it('tag candle should not exists yet', () => {

    let tag = wr.getPublishedTag('candle');

    expect(tag).to.equal(null);
  });

  it('render the home page', () => {
    let body = wr.renderHome();

    expect(body).to.contain('Article Simple');
  });
  it('render a post', () => {
    let body = wr.renderPost('article-simple');

    expect(body).to.contain('Article Simple');
  });

});