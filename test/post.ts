import { Post } from '../src/classes/post';
import { expect } from 'chai';
import * as moment from 'moment';
import 'mocha';

describe('Post', () => {

  it('should return the filePath name', () => {
    let postFilePath = __dirname + '/blog/article1.md';
    let post = new Post(postFilePath);

    expect(post.filePath).to.equal(postFilePath);
  });

  it('should return the correct header', () => {
    let postFilePath = __dirname + '/blog/article1-simple.md';
    let post = new Post(postFilePath);

    expect(post.header).to.equal('{ "title": "Article One" }');
  });

  it('should return the correct content', () => {
    let postFilePath = __dirname + '/blog/article1-simple.md';
    let post = new Post(postFilePath);

    expect(post.content).to.equal('\n\nMy life as a blogger is really cool');
  });

  it('should return the a keyword count of 0', () => {
    let postFilePath = __dirname + '/blog/article1-simple.md';
    let post = new Post(postFilePath);

    expect(post.keywords.length).to.equal(0);
  });

  it('should return a keyword count of 2', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    expect(post.keywords.length).to.equal(2);
  });

  it('should return a tags count of 3', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    expect(post.tags.length).to.equal(3);
  });

  it('should have the authors name be John Smith', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    expect(post.author).to.equal('John Smith');
  });

  it('should have the authors name be John Smith', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    expect(post.author).to.equal('John Smith');
  });

  it('should have the url correct', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    expect(post.url).to.equal('the-largest-whale');
  });
  
  it('should have the created date correct', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    let dateString = moment(post.createdAt).format('MM/DD/YYYY');

    expect(dateString).to.equal('01/15/2017');
  });

  it('should have the published date correct', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    let dateString = moment(post.publishedAt).format('MM/DD/YYYY');

    expect(dateString).to.equal('02/25/2020');
  });

  it('should find the file via the system path', () => {
    let postFilePath = __dirname + '/blog/article1.md';

    let post = new Post(postFilePath);

    expect(post.title).to.equal('Article One');
  });

  it('if published date is not available then it should be live', () => {
    let postFilePath = __dirname + '/blog/article1-simple.md';
    let post = new Post(postFilePath);

    expect(post.isPostPublished()).to.equal(true);
  });

  it('if published date is in the future then it should say no', () => {
    let postFilePath = __dirname + '/blog/article1.md';
    let post = new Post(postFilePath);

    post.publishedAt = new Date('12/12/2040');

    expect(post.isPostPublished()).to.equal(false);
  });

});