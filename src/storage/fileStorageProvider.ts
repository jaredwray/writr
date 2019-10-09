import * as fs from "fs-extra";
import { Logger, transports } from "winston";

export class FileStorageProvider {

    log: any;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
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

    async set(path: string, data: string): Promise<boolean> {
        let result = false;

        if (path !== undefined && data !== undefined) {
            try {
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

    exists(path: string) {
        return new Promise<boolean>((resolve) => {
            fs.exists(path, exist => {
                resolve(exist);
            });
        });
    }
}