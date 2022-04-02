import * as fs from "fs-extra";
import {ConsoleMessage} from "../../src/log";
import {MediumMigrationProvider} from "../../src/migrate/mediumMigrationProvider";
import {StorageService} from "../../src/storage/storageService";

describe('mediumMigrationProvider', () => {
	const storage: StorageService = new StorageService();

	jest.spyOn(ConsoleMessage.prototype, 'info').mockImplementation(() => {});

	const mediumMigration = new MediumMigrationProvider();

	it('should migrate medium post to Writr', async () => {

		try{
			const result = await mediumMigration.migrate('./test/migration_example/medium', './test_output/medium');
			expect(result).toBe(true);
			expect(fs.readdirSync("./test/migration_example/medium/posts").length).toBe(fs.readdirSync("./test_output/medium").length);
		} catch (error) {
			fail()
		} finally {
			fs.removeSync("./test_output/medium");
		}

	});

	it('should return empty file if the html is empty', async () => {

		try{
			const data = '<h1>Hello</h1>';
			const path = './test/migration_example/temp/posts/empty.html';
			await storage.set(path, data);

			const result = await mediumMigration.migrate('./test/migration_example/temp', './test_output/medium');
			expect(result).toBe(true);
		} catch (error: any) {
			fail()
		} finally {
			fs.removeSync("./test/migration_example/temp");
			fs.removeSync("./test_output/medium");
		}

	})

});
