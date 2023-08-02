import {JekyllMigrationProvider} from "../../src/migrate/jekyllMigrationProvider";
import fs from "fs-extra";
import {ConsoleMessage} from "../../src/log";

describe("jekyllMigrationProvider", () => {

    jest.spyOn(ConsoleMessage.prototype, 'info').mockImplementation(() => {});

    const jekyllMigration = new JekyllMigrationProvider();

    it("migrate", async () => {
        const src = "./test/migration_example/jekyll";
        const dest = "./test_output/jekyll";

        await jekyllMigration.migrate(src, dest);

        expect(fs.readdirSync(dest).length).toBe(2);
        expect(fs.readdirSync(dest + "/images").length).toBe(1);

        fs.removeSync(dest);
    })

})
