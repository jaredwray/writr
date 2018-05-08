import {Config} from '../../classes/config';

export interface CacheProvider {
    setConfig(config:Config): void;
    get(name:string): object | null;
    set(name:string, obj:object, ttl:Date | null): void;
    delete(name:string): void;
}