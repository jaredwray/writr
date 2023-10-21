import {expect, it, describe} from 'vitest';
import fs from 'fs-extra';
import {WritrHelpers} from '../src/helpers.js';

describe('WritrHelpers', () => {
	describe('getFrontMatter', () => {
		it('should return an empty object if no FrontMatter is found', () => {
			const helpers = new WritrHelpers();
			const frontMatter = helpers.getFrontMatterFromFile('./test/fixtures/no-front-matter.md');
			expect(frontMatter).toEqual({});
		});
		it('should return valid FrontMatter', () => {
			const helpers = new WritrHelpers();
			const frontMatter = helpers.getFrontMatterFromFile('./test/fixtures/front-matter.md');
			expect(frontMatter.title).toEqual('Writr');
		});
	});
	describe('setFrontMatterInContent', () => {
		it('should get and append FrontMatter', () => {
			const helpers = new WritrHelpers();
			const newContent = helpers.setFrontMatterInContent('---\ntitle: Writr\n---\n# Hello World', {title: 'Writr1'});
			expect(newContent).toEqual('---\ntitle: Writr1\n---\n# Hello World');
		});
		it('should get and append with no FrontMatter', () => {
			const helpers = new WritrHelpers();
			const newContent = helpers.setFrontMatterInContent('# Hello World', {title: 'Writr1'});
			expect(newContent).toEqual('---\ntitle: Writr1\n---\n# Hello World');
		});
	});
	describe('setFrontMatterToFile', () => {
		it('should get and append FrontMatter to new file', () => {
			const helpers = new WritrHelpers();
			const file = './test/fixtures/front-matter-new-set.md';
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}

			fs.writeFileSync(file, '# Hello World', 'utf8');
			helpers.setFrontMatterToFile(file, {title: 'Writr1'});
			const frontMatter = helpers.getFrontMatterFromFile(file);
			expect(frontMatter.title).toEqual('Writr1');
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}
		});
	});
});
