import {JekyllMigrationProvider} from "../../src/migrate/jekyllMigrationProvider";
import * as fs from "fs-extra";

describe("jekyllMigrationProvider", () => {

    const jekyllMigration = new JekyllMigrationProvider();

    it("migrate", async () => {
        const src = "./test/jekyll_example";
        const dest = "./test/output";

        await jekyllMigration.migrate(src, dest);

        expect(fs.readdirSync(dest).length).toBe(2);
        expect(fs.readdirSync(dest + "/images").length).toBe(1);

        fs.removeSync(dest);
    })

})
