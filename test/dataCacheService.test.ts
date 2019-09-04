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

        config.loadConfig("./blog_example/config.json");
        cache = new DataCacheService(config);

    });

    it('caching a post', async () => {

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        let result = await cache.setPost('foo',post);

        expect(result).to.equal(true);
    });

    it('caching a post and retrieving it', async () => {

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        await cache.setPost('foo',post);

        let result = await cache.getPost('foo');

        expect(result.title).to.equal('foo');
    });

    it('no cached hit', async () => {

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        await cache.setPost('foo',post);

        let result = await cache.getPost('bar');

        expect(result).to.equal(undefined);
    });

    it('caching a post and retrieving it with functions', async () => {

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        await cache.setPost('foo',post);

        let result = await cache.getPost('foo');

        expect(result.title).to.equal("foo");
    });

    it('caching a post and retrieving it with correct values', async () => {

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        post.keywords = new Array<string>();
        post.keywords.push('cat');
        post.keywords.push('dog');
        
        await cache.setPost('foo',post);

        let result = await cache.getPost('foo');

        expect(result.keywords.length).to.equal(2);
    });

    it('caching posts and retrieving it with correct values', async () => {

        let key = "multipost"
        let posts = Array<Post>();

        let fooPost = new Post();
        fooPost.title = 'foo';
        fooPost.date = new Date();

        fooPost.keywords = new Array<string>();
        fooPost.keywords.push('cat');
        fooPost.keywords.push('dog');
        
        posts.push(fooPost);

        let coolPost = new Post();
        coolPost.title = 'cool';
        coolPost.date = new Date();

        coolPost.keywords = new Array<string>();
        coolPost.keywords.push('meow');
        coolPost.keywords.push('woof');
        
        posts.push(coolPost);

        await cache.setPosts(key, posts);

        let result = await cache.getPosts(key);

        expect(result.length).to.equal(2);
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
        post.date = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await cache.setTag('foo',tag);

        let result = await cache.getTag('foo');

        expect(result.name).to.equal("foo");
    });

    it('caching a tags and retrieving it with functions', async () => {

        let key = "multitags"
        let tags = new Array<Tag>();

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        let post2 = new Post();
        post2.title = 'foo2';
        post2.date = new Date();

        let tag2 = new Tag('foo2');
        tag2.posts.push(post2);

        tags.push(tag);
        tags.push(tag2);

        await cache.setTags(key,tags);

        let result = await cache.getTags(key);

        expect(result.length).to.equal(2);
    });

    it('caching a tag with post and retrieving it with correct values', async () => {

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await cache.setTag('foo',tag);

        let result = await cache.getTag('foo');

        expect(result.posts[0].title).to.equal("foo");
    });   
    
    it('caching a tag and a post and then clearing', async () => {

        let post = new Post();
        post.title = 'foo';
        post.date = new Date();

        let tag = new Tag('foo');
        tag.posts.push(post);

        await cache.setTag('foo',tag);
        await cache.setPost('fff', post);

        await cache.clear();

        let result = await cache.getTag('foo');

        expect(result).to.equal(undefined);
    }); 

    it('format name correctly', () => {

        expect(cache.formatName('blAh ', "post")).to.equal(`post-blah`);
    });

    it('format name correctly and type', () => {

        expect(cache.formatName('blAh ', "poSt ")).to.equal(`post-blah`);
    });
});