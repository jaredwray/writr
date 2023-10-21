import {expect, it, describe} from 'vitest';
import fs from 'fs-extra';
import {WritrHelpers} from '../src/helpers.js';

describe('WritrHelpers', () => {
	describe('createDoc', () => {
		it('should create a document from a previous readme', () => {
			const source = './test/fixtures/readme-example.md';
			const destination = './test/fixtures/readme-example-createdoc-new.md';
			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}

			const helpers = new WritrHelpers();
			helpers.createDoc(source, destination, {title: 'Writr'});
			const frontMatter = helpers.getFrontMatterFromFile(destination);
			expect(frontMatter.title).toEqual('Writr');
			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}
		});
		it('should create a document from a previous readme with contentFn', () => {
			const source = './test/fixtures/readme-example.md';
			const destination = './test/fixtures/readme-example-createdoc-new-fn.md';
			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}

			const fn = (content: string) => content.replace('description: Beautiful Website for Your Projects', 'description: More Beautiful');

			const helpers = new WritrHelpers();
			helpers.createDoc(source, destination, {title: 'Writr', description: 'Beautiful Website for Your Projects'}, fn);
			const frontMatter = helpers.getFrontMatterFromFile(destination);
			expect(frontMatter.title).toEqual('Writr');
			expect(frontMatter.description).toEqual('More Beautiful');

			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}
		});
	});
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
