/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {it, describe, expect} from 'vitest';
import Writr from '../src/writr.js';


describe('writr', () => {
	it('should be able to initialize', () => {
		const writr = new Writr();
		expect(writr).toBeDefined();
	});
});
