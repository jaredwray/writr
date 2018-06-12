import {Config} from '../config';

export interface CacheProviderInterface {
    setConfig(config:Config): void;
    get(name:string): any | undefined;
    set(name:string, obj:any, ttl:Date | undefined): void;
    delete(name:string): void;
    has(name:string): boolean;
}