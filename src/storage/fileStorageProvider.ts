import * as fs from "fs-extra";
import { StorageProviderInterface } from "../storage/storageProviderInterface";

import { createLogger, transports } from "winston";

export class FileStorageProvider implements StorageProviderInterface {

    log: any;

    constructor() {
        this.log = createLogger({ transports: [new transports.Console()]});
    }

    async get(path: string): Promise<string | undefined> {
        let result: string | undefined;

        try {
            let buffer = await fs.readFile(path);
            result = buffer.toString();
        } catch (error) {
            this.log.error(error);
        }

        return result;
    }

    async set(path?: string, data?: string): Promise<boolean> {
        let result = false;

        if (path !== undefined && data !== undefined && path !== "" && data !== "") {
            try {
                await this.ensureFilePath(path);
                await fs.writeFile(path, data);
                result = true;
            } catch (error) {
                /* istanbul ignore next */
                this.log.error(error);
            }
        }

        return result;
    }

    async delete(path: string): Promise<boolean> {
        let result = false;

        try {
            await fs.remove(path);
            result = true;
        } catch(error) {
            /* istanbul ignore next */
            this.log.error(error);
        }

        return result;
    }

    async copy(src:string, dest:string): Promise<boolean> {
        let result = false;

        try {
            await fs.ensureDir(dest);
            await fs.copy(src, dest);
            result = true;
        } catch (error) {
            /* istanbul ignore next */
            this.log.error(error);
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

    private async ensureFilePath(path:string) {
        let pathList = path.split("/");
        pathList.pop();

        let dir = pathList.join("/");

        await fs.ensureDir(dir);
    }
}