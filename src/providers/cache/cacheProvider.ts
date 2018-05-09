import {Config} from '../../classes/config';

export interface CacheProvider {
    setConfig(config:Config): void;
    get(name:string): object | undefined;
    set(name:string, obj:object, ttl:Date | undefined): void;
    delete(name:string): void;
}