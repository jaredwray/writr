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
        this.__postCache = new Keyv({ttl: this.__config.cacheTTL, namespace: 'post'});
        this.__tagCache = new Keyv({ttl: this.__config.cacheTTL, namespace: 'tag'});
    }

    //posts
    async getPost(id:string) : Promise<Post | undefined> {
        let result = undefined;

        //let cacheItem = await this.__cache.get(cacheKey);

        if(!result) {
            result = await this.getProvider().getPost(id);

            /*
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
            */
        } 

        return result;
    }

    async getPublishedPost(id:string) : Promise<Post | undefined> {
        let result = undefined;

        //let cacheItem = await this.__cache.get(cacheKey);

        if(!result) {

            result = await this.getProvider().getPublishedPost(id);

            /*
            if(result) {

                await this.__cache.set(cacheKey, result);
            }
            */
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
        //result = <Post[]>await this.__cache.get(cacheKey);

        if(result.length === 0) {
            
            result = await this.getProvider().getPosts();

            /*
            if(result) {
                await this.__cache.set(cacheKey, result); 
            }
            */
        }

        return result;

    }

    async getPublishedPosts() : Promise<Array<Post>> {
        let result = new Array<Post>();

        let cacheKey = 'get-published-posts';

        //result = <Post[]> await this.__cache.get(cacheKey);

        if(result.length === 0) {
            result = await this.getProvider().getPublishedPosts();
            
            /*
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
            */
        } 

        return result;
    }

    //tags
    async getTag(name:string) : Promise<Tag | undefined> {
        let result = undefined;

        //let cacheItem = await this.__cache.get(cacheKey);

        if(!result) {
            result = this.getProvider().getTag(name);

            /*
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
            */
        } 

        return result;
    }

    async getPublishedTag(name:string) : Promise<Tag | undefined> {
        let result = undefined;

        //result = <Tag> await this.__cache.get(cacheKey);

        if(!result) {
            result = await this.getProvider().getPublishedTag(name);
            
            /*
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
            */
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

        //result = <Tag[]> await this.__cache.get(cacheKey);

        if(result.length === 0) {
            result = await this.getProvider().getTags();
            
            /*
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
            */
        } 

        return result;
    }

    async getPublishedTags() : Promise<Array<Tag>> {
        let result = new Array<Tag>();

        let cacheKey = 'get-published-tags';

        //result = <Tag[]>await this.__cache.get(cacheKey);

        if(result.length === 0) {
            result = await this.getProvider().getPublishedTags();
            
            /*
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
            */
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
    

    getProvider() : DataProviderInterface {
        let result: DataProviderInterface = new FileDataProvider();

        result.init(this.__config);

        return result;
    }

    formatName(name:string) : string {
        return name.toLowerCase().trim();
    }
}