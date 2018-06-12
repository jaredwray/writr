import {CacheProviderInterface} from '../providers/cacheProviderInterface';
import {MemoryCacheProvider} from '../providers/memoryCacheProvider';
import {Config} from '../config';

export class CacheService implements CacheProviderInterface {
    private __config: Config;
    private __cache: CacheProviderInterface;

    constructor(config: Config) {
        this.__config = config;
        this.__cache = this.getProvider(this.__config.cacheProvider);
    }

    get(name:string) : object | undefined {
        let provider = this.getProvider(this.__config.cacheProvider);

        this.formatName(name);

        return provider.get(name);
    }

    has(name:string): boolean {
        let provider = this.getProvider(this.__config.cacheProvider);

        this.formatName(name);

        return provider.has(name);
    }

    set(name:string, obj:object, ttl:Date | undefined = undefined): void {
        let provider = this.getProvider(this.__config.cacheProvider);

        name = this.formatName(name);

        provider.set(name, obj, ttl);
    }

    delete(name:string) : void {
        let provider = this.getProvider(this.__config.cacheProvider);

        name = this.formatName(name);

        provider.delete(name);
    }

    setConfig(config:Config) : void {
        this.__config = config;
    }

    getProvider(name:string) : CacheProviderInterface {
        let result: CacheProviderInterface = this.__cache;

        if(!result) {
            name = this.formatName(name);

            switch(name) {
                default: //memory
                    result = new MemoryCacheProvider();
                    break;
            }

            result.setConfig(this.__config);
        }
        return result;
    }

    formatName(name:string) : string {
        return name.toLowerCase().trim();
    }
}