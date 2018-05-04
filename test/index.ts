import * as wr from '../src/index';
import { Post } from '../src/classes/post';
import { Config } from '../src/classes/config'
import { expect } from 'chai';
import 'mocha';

describe('Writr', () => {

  it('should save a tag', () => {
    let postFilePath = __dirname + '/blog/article1.md';
    let post = new Post(postFilePath);

    wr.saveTags(post); 

    expect(wr.getTagsAsString().length).to.equal(3);
  });

  it('should only have only one post on a tag', () => {

    let tags = wr.getTags();

    expect(tags[0].posts.length).to.equal(1);
  });

  it('tag whale should exists', () => {

    let tag = wr.getTag('whale');

    expect(tag).not.equal(null);
  });

  it('tag tesla should not exists yet', () => {

    let tag = wr.getTag('tesla');

    expect(tag).to.equal(null);
  });

  it('should have two posts on a single tag', () => {
    let postFilePath = __dirname + '/blog/article2.md';
    let post = new Post(postFilePath);

    wr.saveTags(post);

    let tag = wr.getTag('whale')

    expect(tag.posts.length).to.equal(2);
  });

  it('config gets setup in init', () => {

    let config : Config = new Config();

    wr.init(config);

    expect(wr.getConfig().contentPath).to.equal(config.contentPath);
  });

});