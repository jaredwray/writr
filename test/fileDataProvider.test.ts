import { expect } from 'chai';
import { Config } from '../src/classes/config';
import { FileDataProvider } from '../src/providers/fileDataProvider'; 
import 'mocha';


describe('fileDataProvider', () => {

  let config : Config = new Config();

  before(() => {

    config.postPath = __dirname + '/blog';
    config.contentPath = __dirname + '/blog/content';
    config.templatePath = __dirname + '/blog/templates';


  });

  it('config gets setup in init', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    expect(fileProvider.__config.postPath).to.equal(config.postPath);
  });

  it('should get the posts from the file system', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let posts = fileProvider.getPosts();

    expect(posts.length).to.equal(4);
  });

  it('should get a valid post', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let post = fileProvider.getPost('article-simple');

    expect(post.title).to.equal('Article Simple');
  });

  it('should not get a valid post', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let post = fileProvider.getPost('article');

    expect(post).to.equal(undefined);
  });

  it('should get a valid published post', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let post = fileProvider.getPublishedPost('all-about-the-tesla-model-3');

    expect(post.title).to.equal('Tesla Model 3');
  });

  it('should not get a valid published post', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let post = fileProvider.getPublishedPost('the-largest-whale');

    expect(post).to.equal(undefined);
  });

  it('should published posts', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let posts = fileProvider.getPublishedPosts();

    expect(posts.length).to.equal(3);
  });

  it('should have a valid tag', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = fileProvider.getTag('whale');

    expect(tag.name).to.equal('whale');
  });

  it('should have a valid tag and multiple posts', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = fileProvider.getTag('whale');

    expect(tag.posts.length).to.equal(2);
  });

  it('should have a invalid tag', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = fileProvider.getTag('snoopy');

    expect(tag).to.equal(undefined);
  });

  it('should have a valid tag and is published', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = fileProvider.getTag('whale');

    expect(tag.isPublished()).to.equal(true);
  });

  it('should have a tag that is not publshed', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = fileProvider.getPublishedTag('large');

    expect(tag).to.equal(undefined);
  });

  it('should have a all tags that are published', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tags = fileProvider.getPublishedTags();

    expect(tags.length).to.equal(6);
  });

  it('should generate the correct amount of tags', () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let posts = fileProvider.getPosts();

    let tags = fileProvider.generateTags(posts)

    expect(tags.length).to.equal(9);
  });

});