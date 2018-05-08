import {CacheProvider} from '../providers/cache/cacheProvider';
import {MemoryCache} from '../providers/cache/memory';
import {Config} from '../classes/config';

export class Cache implements CacheProvider {
    __config: Config;

    constructor(config: Config) {
        this.__config = config;
    }

    get(name:string) : object | null{
        let provider = this.getProvider(this.__config.cacheProvider);

        return provider.get(name);
    }

    set(name:string, obj:object, ttl:Date | null) {
        let provider = this.getProvider(this.__config.cacheProvider);

        provider.set(name, obj, ttl);
    }

    delete(name:string) {
        let provider = this.getProvider(this.__config.cacheProvider);

        provider.delete(name);
    }

    setConfig(config:Config) : void {
        this.__config = config;
    }

    getProvider(name:string) : CacheProvider {
        let result: CacheProvider;

        switch(name) {
            default: //memory
                result = new MemoryCache();
                break;
        }

        result.setConfig(this.__config);

        return result;
    }
}