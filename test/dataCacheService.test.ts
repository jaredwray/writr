import { expect } from 'chai';
import 'mocha';

import {Config} from '../src/config';
import {DataCacheService} from '../src/data/dataCacheService'
import { Post } from '../src/post';
import { Tag } from '../src/tag';

describe('Data Cache Service', async () => {

    let config : Config = new Config();
    let cache: DataCacheService;

    before( async () => {

        config.data.postPath = __dirname + '/blog';
        config.data.contentPath = __dirname + '/blog/content';
        config.data.templatePath = __dirname + '/blog/templates';
        cache = new DataCacheService(config);

    });

    it('caching a post', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();

        let result = await cache.setPost('foo',post);

        expect(result).to.equal(true);
    });

    it('caching a post and retrieving it', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();

        await cache.setPost('foo',post);

        let result = await cache.getPost('foo');

        expect(result.title).to.equal('foo');
    });

    it('no cached hit', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();

        await cache.setPost('foo',post);

        let result = await cache.getPost('bar');

        expect(result).to.equal(undefined);
    });

    it('caching a post and retrieving it with functions', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        await cache.setPost('foo',post);

        let result = await cache.getPost('foo');

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
        
        await cache.setPost('foo',post);

        let result = await cache.getPost('foo');

        expect(result.keywords.length).to.equal(2);
    });

    it('caching a tag and retrieving it', async () => {

        let tag = new Tag('foo');

        await cache.setTag('foo',tag);

        let result = await cache.getTag('foo');

        expect(result.name).to.equal('foo');
    });

    it('no cached hit', async () => {

        let tag = new Tag('foo');

        await cache.setTag('foo',tag);

        let result = await cache.getTag('bar');

        expect(result).to.equal(undefined);
    });

    it('caching a tag and retrieving it with functions', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await cache.setTag('foo',tag);

        let result = await cache.getTag('foo');

        expect(result.isPublished()).to.equal(true);
    });

    it('caching a tag with post and retrieving it with correct values', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await cache.setTag('foo',tag);

        let result = await cache.getTag('foo');

        expect(result.posts[0].isPublished()).to.equal(true);
    });   
    
    it('caching a tag and a post and then clearing', async () => {

        let post = new Post();
        post.title = 'foo';
        post.createdAt = new Date();
        post.publishedAt = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await cache.setTag('foo',tag);
        await cache.setPost('fff', post);

        await cache.clear();

        let result = await cache.getTag('foo');

        expect(result).to.equal(undefined);
    }); 

    it('format name correctly', () => {

        expect(cache.formatName('blAh ')).to.equal(`blah`);
    });
});