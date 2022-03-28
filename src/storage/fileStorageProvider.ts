import * as fs from "fs-extra";
import { StorageProviderInterface } from "./storageProviderInterface";
import { ConsoleMessage } from "../log";

export class FileStorageProvider implements StorageProviderInterface {

    async get(path: string): Promise<string | undefined> {
        let result: string | undefined;

        try {
            let buffer = await fs.readFile(path);
            result = buffer.toString();
        } catch (error: any) {
            new ConsoleMessage().error(error.message);
        }

        return result;
    }

    async set(path?: string, data?: string): Promise<boolean> {
        if(!path || !data ) return false;
        await this.ensureFilePath(path);
        await fs.writeFile(path, data);
        return true;
    }

    async delete(path: string): Promise<boolean> {
        let result = false;

        try {
            await fs.remove(path);
            result = true;
        } catch(error: any) {
            new ConsoleMessage().error(error.message);
        }

        return result;
    }

    async copy(src:string, dest:string): Promise<boolean> {
        let result = false;

        try {
            await fs.ensureDir(dest);
            await fs.copy(src, dest);
            result = true;
        } catch (error: any) {
            new ConsoleMessage().error(error.message);
        }

        return result;
    }

    exists(path: string) {
        return new Promise<boolean>((resolve) => {
            fs.exists(path, exist => {
                resolve(exist);
            });
        });
    }

    async ensureFilePath(path:string) {
        let pathList = path.split("/");
        pathList.pop();

        let dir = pathList.join("/");

        await fs.ensureDir(dir);
    }
}
