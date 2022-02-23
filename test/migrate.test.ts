import { Writr } from "../src/index";
import * as fs from "fs-extra";
import {Migrate} from "../src/migrate";

describe('Migrate', () => {

    afterEach(() => {
        fs.removeSync("./test/output/");
    });

    it('should return error when unknow provider is specified', () => {
        try {
            new Migrate('unknown');
            // Fail test if above expression doesn't throw anything.
            expect('unknown detected').toBe('unknown not detected');
        } catch (error: any) {
            expect(error.message).toBe("Unknown migration provider: unknown");
        }
    });

    it('cli should migrate from jekyll project', async () => {
        const writr = new Writr();

        process.argv = ['', '', '-j', './test/jekyll_example', '-o', './test/output' ];

        writr.parseCLI(process);
        await writr.runCLI();

        expect(fs.readdirSync("./test/output").length).toBe(2);
        expect(fs.readdirSync("./test/output/images").length).toBe(1);
    })

})
