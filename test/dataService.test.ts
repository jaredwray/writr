import { expect } from 'chai';
import 'mocha';

import {Config} from '../src/config';
import {DataService} from '../src/data/dataService'
import { Post } from '../src/post';
import { Tag } from '../src/tag';

describe('Data Service', async () => {

    let config : Config = new Config();
    let ds: DataService;

    before( async () => {

        config.postPath = __dirname + '/blog';
        config.contentPath = __dirname + '/blog/content';
        config.templatePath = __dirname + '/blog/templates';
        ds = new DataService(config);

    });

    it('get a provider based on the config', () => {
        expect(ds.getProvider()).to.not.equal(undefined);
    });

    it('format name correctly', () => {

        expect(ds.formatName('blAh ')).to.equal(`blah`);
    });

    it('get posts', async () => {

        let posts = await ds.getPosts();

        expect(posts.length).to.equal(4);
    });

    it('get post', async () => {

        let post = await ds.getPost('article-simple');

        expect(post.title).to.equal('Article Simple');
    });

    it('get published post', async () => {

        let post = await ds.getPublishedPost('article-simple');

        expect(post.title).to.equal('Article Simple');
    });

    
    it('should not get a valid post as it is unpublished', async () => {

        let post = await ds.getPublishedPost('the-largest-whale');

        expect(post).to.equal(undefined);
    });

    it('get published posts', async () => {
        
        let posts = await ds.getPublishedPosts();

        expect(posts.length).to.equal(3);
    });

    it('get tags', async () => {

        let tags = await ds.getTags();

        expect(tags.length).to.equal(9);
    });

    it('get published tags', async () => {

        let tags = await ds.getPublishedTags();

        expect(tags.length).to.equal(6);
    });

    it('get tag that is unpublished', async () => {

        let tag = await ds.getTag('blast');

        expect(tag.isPublished()).to.equal(false);
    });

    it('caching a post', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();

        let result = await ds.setCachedPost('foo',post);

        expect(result).to.equal(true);
    });

    it('caching a post and retrieving it', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();

        await ds.setCachedPost('foo',post);

        let result = await ds.getCachedPost('foo');

        expect(result.title).to.equal('foo');
    });

    it('no cached hit', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();

        await ds.setCachedPost('foo',post);

        let result = await ds.getCachedPost('bar');

        expect(result).to.equal(undefined);
    });

    it('caching a post and retrieving it with functions', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        await ds.setCachedPost('foo',post);

        let result = await ds.getCachedPost('foo');

        expect(result.isPublished()).to.equal(true);
    });

    it('caching a post and retrieving it with correct values', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        post.keywords = new Array<string>();
        post.keywords.push('cat');
        post.keywords.push('dog');
        
        await ds.setCachedPost('foo',post);

        let result = await ds.getCachedPost('foo');

        expect(result.keywords.length).to.equal(2);
    });

    it('caching a tag and retrieving it', async () => {

        let tag = new Tag('foo');

        await ds.setCacheTag('foo',tag);

        let result = await ds.getCachedTag('foo');

        expect(result.name).to.equal('foo');
    });

    it('no cached hit', async () => {

        let tag = new Tag('foo');

        await ds.setCacheTag('foo',tag);

        let result = await ds.getCachedTag('bar');

        expect(result).to.equal(undefined);
    });

    it('caching a tag and retrieving it with functions', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await ds.setCacheTag('foo',tag);

        let result = await ds.getCachedTag('foo');

        expect(result.isPublished()).to.equal(true);
    });

    it('caching a tag with post and retrieving it with correct values', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await ds.setCacheTag('foo',tag);

        let result = await ds.getCachedTag('foo');

        expect(result.posts[0].isPublished()).to.equal(true);
    });    
});