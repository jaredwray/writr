import {CacheService} from './cacheService';
import {Config} from '../classes/config';
import {Post} from '../classes/post';
import {Tag} from '../classes/tag';
import {DataProviderInterface} from '../providers/dataProviderInterface';
import {FileDataProvider} from '../providers/fileDataProvider';

import Keyv = require('keyv');

export class DataService {
    private __cache: Keyv;
    private __config: Config;

    constructor(config:Config) {
        this.__config = config;
        this.__cache = new Keyv({ttl: this.__config.cacheTTL});
    }

    //posts
    async getPost(id:string) : Promise<Post | undefined> {
        let result = undefined;

        let cacheKey = this.generatePostKey(id);

        //let cacheItem = await this.__cache.get(cacheKey);

        if(!result) {
            result = await this.getProvider().getPost(id);

            if(result) {
                await this.__cache.set(cacheKey, result);
            }
        } 

        return result;
    }

    async getPublishedPost(id:string) : Promise<Post | undefined> {
        let result = undefined;

        let cacheKey = this.generatePostKey(id);

        //let cacheItem = await this.__cache.get(cacheKey);

        if(!result) {

            result = await this.getProvider().getPublishedPost(id);

            if(result) {

                await this.__cache.set(cacheKey, result);
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

        let id = 'get-posts';

        let cacheKey = this.generatePostKey(id);

        //result = <Post[]>await this.__cache.get(cacheKey);

        if(result.length === 0) {
            
            result = await this.getProvider().getPosts();

            if(result) {
                await this.__cache.set(cacheKey, result); 
            }
        }

        return result;

    }

    async getPublishedPosts() : Promise<Array<Post>> {
        let result = new Array<Post>();

        let id = 'get-published-posts';

        let cacheKey = this.generatePostKey(id);

        //result = <Post[]> await this.__cache.get(cacheKey);

        if(result.length === 0) {
            result = await this.getProvider().getPublishedPosts();
            
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
        } 

        return result;
    }

    //tags
    async getTag(name:string) : Promise<Tag | undefined> {
        let result = undefined;

        let cacheKey = this.generateTagKey(name);

        //let cacheItem = await this.__cache.get(cacheKey);

        if(!result) {
            result = this.getProvider().getTag(name);

            if(result) {
                await this.__cache.set(cacheKey, result);
            }
        } 

        return result;
    }

    async getPublishedTag(name:string) : Promise<Tag | undefined> {
        let result = undefined;

        let cacheKey = this.generateTagKey(name);

        //result = <Tag> await this.__cache.get(cacheKey);

        if(!result) {
            result = await this.getProvider().getPublishedTag(name);
            
            if(result) {
                await this.__cache.set(cacheKey, result);
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

        let id = 'get-tags';

        let cacheKey = this.generateTagKey(id);

        //result = <Tag[]> await this.__cache.get(cacheKey);

        if(result.length === 0) {
            result = await this.getProvider().getTags();
            
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
        } 

        return result;
    }

    async getPublishedTags() : Promise<Array<Tag>> {
        let result = new Array<Tag>();

        let id = 'get-published-tags';

        let cacheKey = this.generateTagKey(id);

        //result = <Tag[]>await this.__cache.get(cacheKey);

        if(result.length === 0) {
            result = await this.getProvider().getPublishedTags();
            
            if(result) {
                await this.__cache.set(cacheKey, result);
            }
        } 

        return result;
    }
    

    getProvider() : DataProviderInterface {
        let result: DataProviderInterface = new FileDataProvider();

        result.init(this.__config);

        return result;
    }

    formatName(name:string) : string {
        return name.toLowerCase().trim();
    }

    generatePostKey(name:string):string {
        return 'post::'+this.formatName(name);
    }

    generateTagKey(name:string):string {
        return 'tag::'+this.formatName(name);
    }
}