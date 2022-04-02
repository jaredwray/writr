export interface StorageProviderInterface {
    get(path:string): Promise<string | undefined>;
    set(path:string, data:string): Promise<boolean>;
    delete(path:string): Promise<boolean>;
    copy(src:string, dest:string): Promise<boolean>;
    exists(path:string): Promise<boolean>;
    readDir(path:string): string[];
}
