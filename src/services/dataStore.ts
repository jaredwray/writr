import {Cache} from './cache';
import {Config} from '../classes/config';
import {Post} from '../classes/post';
import {Tag} from '../classes/tag';
import {DataStoreProvider} from '../providers/dataStore/dataStoreProvider';
import {FileDataStore} from '../providers/dataStore/file';

export class DataStore {
    private __cache: Cache;
    private __config : Config;

    constructor(config:Config) {
        this.__config = config;
        this.__cache = new Cache(this.__config);
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

        result = <Post>this.__cache.get(id);

        return result;
    }

    getProvider() : DataStoreProvider {
        let result: DataStoreProvider = new FileDataStore();

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