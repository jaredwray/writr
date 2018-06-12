import {Config} from '../config';
import {Post} from '../post';
import {Tag} from '../tag';
import {DataProviderInterface} from './dataProviderInterface';
import {FileDataProvider} from '../data/fileDataProvider';

import Keyv = require('keyv');

export class DataService {
    private __postCache: Keyv;
    private __tagCache: Keyv;
    private __config: Config;

    constructor(config:Config) {
        this.__config = config;
        this.__postCache = new Keyv({ttl: this.__config.cacheTTL, namespace: 'data-post'});
        this.__tagCache = new Keyv({ttl: this.__config.cacheTTL, namespace: 'data-tag'});
    }

    //posts
    async getPost(id:string) : Promise<Post | undefined> {
        let result = undefined;

        result = await this.getCachedPost(id);

        if(!result) {
            result = await this.getProvider().getPost(id);
            
            if(result) {
                await this.setCachedPost(id, result);
            }
        } 

        return result;
    }

    async getPublishedPost(id:string) : Promise<Post | undefined> {
        let result = undefined;

        result = await this.getCachedPost(id);

        if(!result) {

            result = await this.getProvider().getPublishedPost(id);

            if(result) {
                await this.setCachedPost(id, result);
            }
        }

        if(result) {
            if(!result.isPublished()) {
                result = undefined;
            }
        }

        return result;
    }

    async getPosts() : Promise<Array<Post>> {
        let result = new Array<Post>();

        let cacheKey = 'get-posts';
        let posts = await this.getCachedPosts(cacheKey);

        if(!posts) {
            
            result = await this.getProvider().getPosts();

            if(result) {
                await this.setCachedPosts(cacheKey, result);
            }
            
        } else {
            result = posts;
        }

        return result;

    }

    async getPublishedPosts() : Promise<Array<Post>> {
        let result = new Array<Post>();

        let cacheKey = 'get-published-posts';
        let posts = await this.getCachedPosts(cacheKey);

        if(!posts) {
            
            result = await this.getProvider().getPublishedPosts();

            if(result) {
                await this.setCachedPosts(cacheKey, result);
            }
            
        } else {
            result = posts;
        }

        return result;
    }

    //tags
    async getTag(name:string) : Promise<Tag | undefined> {
        let result = undefined;

        result = await this.getCachedTag(name);

        if(!result) {
            result = await this.getProvider().getTag(name);

            if(result) {
                await this.setCacheTag(name, result);
            }
        } 

        return result;
    }

    async getPublishedTag(name:string) : Promise<Tag | undefined> {
        let result = undefined;

        result = await this.getCachedTag(name);

        if(!result) {
            result = await this.getProvider().getPublishedTag(name);
            
            if(result) {
                await this.setCacheTag(name, result);
            }
        } 

        if(result) {
            if(!result.isPublished()){
                result = undefined;
            }
        }

        return result;
    }

    async getTags() : Promise<Array<Tag>> {
        let result = new Array<Tag>();

        let cacheKey = 'get-tags';

        let tags = await this.getCachedTags(cacheKey);

        if(!tags) {
            result = await this.getProvider().getTags();

            if(result) {
                await this.setCacheTags(cacheKey, result);
            }
        } else {
            result = tags;
        }

        return result;
    }

    async getPublishedTags() : Promise<Array<Tag>> {
        let result = new Array<Tag>();

        let cacheKey = 'get-published-tags';

        let tags = await this.getCachedTags(cacheKey);

        if(!tags) {
            result = await this.getProvider().getPublishedTags();

            if(result) {
                await this.setCacheTags(cacheKey, result);
            }
        } else {
            result = tags;
        }

        return result;
    }

    //cache
    async getCachedPost(key:string) : Promise<Post | undefined> {
        key = this.formatName(key);

        let result = await this.__postCache.get(key);

        if(result) {
            result = Post.create(result);
        }

        return result;
    }

    async setCachedPost(key:string, post:Post) : Promise<boolean | undefined> {
        return await this.__postCache.set(this.formatName(key), post);
    }

    async getCachedPosts(key:string) : Promise<Array<Post> | undefined> {
        key = this.formatName(key);

        let result = await this.__postCache.get(key);

        if(result) {
            let posts = new Array<Post>();

            for(let i=0;i<result.length;i++)
            {
                posts.push(Post.create(result[i]));
            }

            result = posts;
        }

        return result;
    }

    async setCachedPosts(key:string, posts:Array<Post>) : Promise<boolean | undefined> {
        return await this.__postCache.set(this.formatName(key), posts);
    }

    async getCachedTag(key:string) : Promise<Tag | undefined> {
        key = this.formatName(key);

        let result = await this.__tagCache.get(key);

        if(result) {
            result = Tag.create(result);
        }

        return result;
    }

    async setCacheTag(key:string, tag:Tag) : Promise<boolean | undefined> {
        return await this.__tagCache.set(this.formatName(key), tag);
    }

    async getCachedTags(key:string) : Promise<Array<Tag> | undefined> {
        key = this.formatName(key);

        let result = await this.__tagCache.get(key);

        if(result) {
            let tags = new Array<Tag>();

            for(let i=0;i<result.length;i++)
            {
                tags.push(Tag.create(result[i]));
            }

            result = tags;
        }

        return result;
    }

    async setCacheTags(key:string, tags:Array<Tag>) : Promise<boolean | undefined> {
        return await this.__tagCache.set(this.formatName(key), tags);
    }
    


    getProvider() : DataProviderInterface {
        let result: DataProviderInterface = new FileDataProvider();

        result.init(this.__config);

        return result;
    }

    formatName(name:string) : string {
        return name.toLowerCase().trim();
    }
}