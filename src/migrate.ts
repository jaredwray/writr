import {JekyllMigrationProvider} from "./migrate/jekyllMigrationProvider";

export class Migrate {
    provider: any;

    constructor(provider: string) {
        switch (provider) {
            case "jekyll":
                this.provider = new JekyllMigrationProvider();
                break;
            default:
                throw new Error("Unknown migration provider: " + provider);
        }
    }

    async migrate(src: string, dest: string) {
        await this.getProvider().migrate(src, dest);
    }

    getProvider() {
        return this.provider;
    }

}
