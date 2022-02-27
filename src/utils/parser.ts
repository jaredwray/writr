import {NodeHtmlMarkdown} from "node-html-markdown";

export class Parser {

    markdown: any;

    constructor() {
        this.markdown = new NodeHtmlMarkdown();
    }

    htmlToMd(html: string) {
        return this.markdown.translate(html);
    }

}
