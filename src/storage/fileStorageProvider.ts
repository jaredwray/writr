import * as fs from "fs-extra";
import { Logger, transports } from "winston";

export class FileStorageProvider {

    log: any;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    async get(path:string): Promise<string | undefined> {
        let result: string | undefined;


        return result;
    }

    async set(path: string, data:string): Promise<boolean> {
        let result = false;


        return result;
    }

    async exists(path:string): Promise<boolean> {
        let result = false;

        return result;
    }

    async delete(path:string): Promise<boolean> {
        let result = false;

        return result;
    }
}