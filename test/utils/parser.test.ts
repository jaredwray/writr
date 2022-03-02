import {Parser} from "../../src/utils/parser";

describe('parser', () => {

    it('should parse an html to markdown', () => {

        const parser = new Parser();
        const html = `<h1>This is a title</h1>`;
        const result = parser.htmlToMd(html);

        expect(result).toBe('# This is a title');

    })

    it('should return empty string if not html is provided', () => {

        const parser = new Parser();
        const html = ``;
        const result = parser.htmlToMd(html);

        expect(result).toBe('');

    })

});
