import {CacheProvider} from './cacheProvider';
import {Config} from '../../classes/config';

export class MemoryCache implements CacheProvider {

    //_f = new Map<string, string>();

    get(name:string) : object | null{
        let result: object | null = null;

        return result;
    }

    set(name:string, obj:object, ttl:Date | null) {

    }

    delete(name:string) {

    }

    setConfig(config:Config) : void {

    }
}