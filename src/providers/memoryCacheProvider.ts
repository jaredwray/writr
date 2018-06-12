import {CacheProviderInterface} from './cacheProviderInterface';
import {Config} from '../config';
import * as moment from 'moment';

export class MemoryCacheItem {
    obj:any = {};
    ttl:Date | undefined = moment().add(1, 'h').toDate();

    constructor(obj:any, ttl?:Date) {
        this.obj = obj;
        
        if(ttl) {
        this.ttl = ttl;
        }
    }

    isValid(): boolean {
        let result = true;

        if(this.ttl) {
            if(this.ttl.getTime() < Date.now()) {
                result = false;
            }
        }

        return result;
    }
}

export class MemoryCacheProvider implements CacheProviderInterface {

    private __store = new Map<string, MemoryCacheItem>();
    private __config = new Config();

    get(name:string) : any | undefined {
        let result: any = undefined;
        
        if(this.__store.has(name)) {
        
            let item = this.__store.get(name);
            if(item!.isValid()) {
                result = item!.obj;
            }
        }

        return result;
    }

    set(name:string, obj:any, ttl?:Date) {

        if(!ttl) {
            ttl = moment().add(this.__config.cacheTTL, 'm').toDate();
        }

        this.__store.set(name, new MemoryCacheItem(obj, ttl));
    }

    delete(name:string) {
        this.__store.delete(name);
    }

    has(name:string): boolean {
        let result = false;
        
        if(this.get(name)) {
            result = true;
        }

        return result;
    }

    setConfig(config:Config) : void {
        this.__config = config;
    }
}