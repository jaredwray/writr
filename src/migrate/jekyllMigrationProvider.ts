import {createLogger, transports} from "winston";
import {StorageService} from "../storage/storageService";

export class JekyllMigrationProvider {

    log: any;

    constructor() {
        this.log = createLogger({ transports: [new transports.Console()]});
    }

    async migrate(src: string, dest: string) {
        this.log.info("Migrating Jekyll site from " + src + " to " + dest);
        await new StorageService().copy(src + "/_posts" , dest);
        await new StorageService().copy(src + "/images" , dest + '/images');
    }
}
