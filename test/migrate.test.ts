import * as fs from "fs-extra";
import {ConsoleMessage} from "../src/log";
import {Migrate} from "../src/migrate";
import {GhostMigrationProvider} from "../src/migrate/ghostMigrationProvider";
import {MediumMigrationProvider} from "../src/migrate/mediumMigrationProvider";
import {WordpressMigrationProvider} from "../src/migrate/wordpressMigrationProvider";
import {JekyllMigrationProvider} from "../src/migrate/jekyllMigrationProvider";

jest.mock('../src/migrate/ghostMigrationProvider');
jest.mock('../src/migrate/mediumMigrationProvider');
jest.mock('../src/migrate/wordpressMigrationProvider');
jest.mock('../src/migrate/jekyllMigrationProvider');


describe('Migrate', () => {

    jest.spyOn(ConsoleMessage.prototype, 'info').mockImplementation(() => {});

    afterEach(() => {
        fs.removeSync("./test_output/migrate/");
    });

    beforeEach(() => {
        // @ts-ignore
        GhostMigrationProvider.mockClear();
        // @ts-ignore
        MediumMigrationProvider.mockClear();
        // @ts-ignore
        WordpressMigrationProvider.mockClear();
        // @ts-ignore
        JekyllMigrationProvider.mockClear();
    });

    it('should return error when unknow provider is specified', () => {
        try {
            new Migrate('unknown');
            expect('unknown detected').toBe('unknown not detected');
        } catch (error: any) {
            expect(error.message).toBe("Unknown migration provider: unknown");
        }
    });

    it('should return error when src or dest is not provided', async () => {
        try {
            const migrate = new Migrate('jekyll');
            await migrate.migrate('src', '');
            expect('src or dest not provided').toBe('src and dest provided');
        } catch (error: any) {
            expect(error.message).toBe("Source and destination must be specified");
        }
    })

    it('should run JekyllMigrationProvider', async () => {
        try{
            new Migrate('jekyll');
            expect(JekyllMigrationProvider).toHaveBeenCalled();
        } catch (error) {
            fail()
        }
    })

    it('should run WordPressMigrationProvider', async () => {
        try{
            new Migrate('wordpress');
            expect(WordpressMigrationProvider).toHaveBeenCalled();
        } catch (error) {
            fail()
        }
    })

    it('should run GhostMigrationProvider', async () => {
        try{
            new Migrate('ghost');
            expect(GhostMigrationProvider).toHaveBeenCalled();
        } catch (error) {
            fail()
        }
    })

    it('should run MediumMigrationProvider', async () => {
        try{
            new Migrate('medium');
            expect(MediumMigrationProvider).toHaveBeenCalled();
        } catch (error) {
            fail()
        }
    })

    it('should run migrate method successfully', async () => {
        try{
            const migrate = new Migrate('jekyll');
            await migrate.migrate('./test/migration_example/jekyll', './test_output/migrate/jekyll');
            expect(JekyllMigrationProvider.prototype.migrate).toHaveBeenCalled();
        } catch (error) {
            fail()
        }
    })

})
