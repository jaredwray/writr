import {expect, it, beforeEach, describe} from 'vitest';
import {WritrHelpers} from '../src/helpers.js';

describe('WritrHelpers', () => {
	describe('getFrontMatter', () => {
		it('should return an empty object if no FrontMatter is found', () => {
			const helpers = new WritrHelpers();
			const frontMatter = helpers.getFrontMatter('./test/fixtures/no-front-matter.md');
			expect(frontMatter).toEqual({});
		});
		it('should return valid FrontMatter', () => {
			const helpers = new WritrHelpers();
			const frontMatter = helpers.getFrontMatter('./test/fixtures/front-matter.md');
			expect(frontMatter.title).toEqual('Writr');
		});
	});
	describe('setFrontMatter', () => {
		it('should get a markdown file and write ', () => {
			const helpers = new WritrHelpers();
			const frontMatter = helpers.getFrontMatter('./test/fixtures/no-front-matter.md');
			expect(frontMatter).toEqual({});
		});
	});
});
