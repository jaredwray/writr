import {createLogger, transports} from "winston";
import {StorageService} from "../storage/storageService";
import {MigrationProviderInterface} from "./migrationProviderInterface";

export class JekyllMigrationProvider implements MigrationProviderInterface{

    log: any;

    constructor() {
        this.log = createLogger({ transports: [new transports.Console()]});
    }

    async migrate(src: string, dest: string): Promise<boolean>{
        this.log.info("Migrating Jekyll site from " + src + " to " + dest);
        await new StorageService().copy(src + "/_posts" , dest);
        await new StorageService().copy(src + "/images" , dest + '/images');
        return true;
    }

}
