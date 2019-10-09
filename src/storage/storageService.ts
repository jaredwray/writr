import { StorageProviderInterface } from "../storage/storageProviderInterface";
import { FileStorageProvider } from "../storage/fileStorageProvider";
import { Config } from "../config";


export class StorageService implements StorageProviderInterface {
    config: Config;
    provider: StorageProviderInterface;

    
    constructor(config:Config) {
        this.config = config;
        this.provider = new FileStorageProvider();
    }

    async get(path:string): Promise<string | undefined> {
        return this.getProvider().get(path);
    }

    async set(path:string, data:string): Promise<boolean> {
        return this.getProvider().set(path, data);
    }

    async delete(path:string): Promise<boolean> {
        return this.getProvider().delete(path);
    }

    async exists(path:string): Promise<boolean> {
        return this.getProvider().exists(path);
    }

    async copy(src:string, dest:string): Promise<boolean> {
        return this.getProvider().copy(src, dest);
    }

    getProvider(): StorageProviderInterface {
    
        return this.provider;
    }
}