import { StorageProviderInterface } from "./storageProviderInterface.js";
import { FileStorageProvider } from "./fileStorageProvider.js";


export class StorageService implements StorageProviderInterface {
    provider: StorageProviderInterface;


    constructor() {
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

    readDir(path: string): string[] {
        return this.getProvider().readDir(path);
    }
}
