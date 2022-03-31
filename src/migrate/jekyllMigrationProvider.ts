import {StorageService} from "../storage/storageService";
import {MigrationProviderInterface} from "./migrationProviderInterface";
import {ConsoleMessage} from "../log";

export class JekyllMigrationProvider implements MigrationProviderInterface{

    async migrate(src: string, dest: string): Promise<boolean>{
        new ConsoleMessage().info("Migrating Jekyll site from " + src + " to " + dest);
        await new StorageService().copy(src + "/_posts" , dest);
        await new StorageService().copy(src + "/images" , dest + '/images');
        return true;
    }

}
