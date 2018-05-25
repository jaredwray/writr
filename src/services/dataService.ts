import {CacheService} from './cacheService';
import {Config} from '../classes/config';
import {Post} from '../classes/post';
import {Tag} from '../classes/tag';
import {DataProviderInterface} from '../providers/dataProviderInterface';
import {FileDataProvider} from '../providers/fileDataProvider';

export class DataService {
    private __cache: CacheService;
    private __config : Config;

    constructor(config:Config) {
        this.__config = config;
        this.__cache = new CacheService(this.__config);
    }

    //posts
    getPost(id:string) : Post | undefined {
        let result = undefined;

        let cacheKey = this.generatePostKey(id);

        if(!this.__cache.has(cacheKey)) {
            let post = this.getProvider().getPost(id);
            
            if(post) {
                this.__cache.set(cacheKey, post!, undefined);
            }
        } 

        result = <Post>this.__cache.get(cacheKey);

        return result;
    }

    getPublishedPost(id:string) : Post | undefined {
        let result = undefined;

        let cacheKey = this.generatePostKey(id);

        if(!this.__cache.has(cacheKey)) {
            let post = this.getProvider().getPublishedPost(id);
            
            if(post) {
                this.__cache.set(cacheKey, post!, undefined);
            }
        } 

        result = <Post>this.__cache.get(cacheKey);

        if(result) {
            if(!result.isPublished()) {
                result = undefined;
            }
        }

        return result;
    }

    getPosts() : Array<Post> {
        let result = new Array<Post>();

        let id = 'get-posts';

        let cacheKey = this.generatePostKey(id);

        if(!this.__cache.has(cacheKey)) {
            
            let posts = this.getProvider().getPosts();
            
            this.__cache.set(cacheKey, posts);
        }

        result = <Post[]>this.__cache.get(cacheKey);

        return result;

    }

    getPublishedPosts() : Array<Post> {
        let result = new Array<Post>();

        let id = 'get-published-posts';

        let cacheKey = this.generatePostKey(id);

        if(!this.__cache.has(cacheKey)) {
            let posts = this.getProvider().getPublishedPosts();
            
            this.__cache.set(cacheKey, posts, undefined);
        } 

        result = <Post[]>this.__cache.get(cacheKey);

        return result;

    }

    //tags
    getTag(name:string) : Tag | undefined {
        let result = undefined;

        let cacheKey = this.generateTagKey(name);

        if(!this.__cache.has(cacheKey)) {
            let tag = this.getProvider().getTag(name);

            if(tag) {
                this.__cache.set(cacheKey, tag!, undefined);
            }
        } 

        result = <Tag>this.__cache.get(cacheKey);

        return result;
    }

    getPublishedTag(name:string) : Tag | undefined {
        let result = undefined;

        let cacheKey = this.generateTagKey(name);

        if(!this.__cache.has(cacheKey)) {
            let tag = this.getProvider().getPublishedTag(name);
            
            if(tag) {
                this.__cache.set(cacheKey, tag!, undefined);
            }
        } 

        result = <Tag>this.__cache.get(cacheKey);

        if(result) {
            if(!result.isPublished()){
                result = undefined;
            }
        }

        return result;
    }

    getTags() : Array<Tag> {
        let result = new Array<Tag>();

        let id = 'get-tags';

        let cacheKey = this.generateTagKey(id);

        if(!this.__cache.has(cacheKey)) {
            let posts = this.getProvider().getTags();
            
            this.__cache.set(cacheKey, posts, undefined);
        } 

        result = <Tag[]>this.__cache.get(cacheKey);

        return result;

    }

    getPublishedTags() : Array<Tag> {
        let result = new Array<Tag>();

        let id = 'get-published-tags';

        let cacheKey = this.generateTagKey(id);

        if(!this.__cache.has(cacheKey)) {
            let posts = this.getProvider().getPublishedTags();
            
            this.__cache.set(cacheKey, posts, undefined);
        } 

        result = <Tag[]>this.__cache.get(cacheKey);

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