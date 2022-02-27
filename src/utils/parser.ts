import {NodeHtmlMarkdown} from "node-html-markdown";

export class Parser {

    markdown: any;

    constructor() {
        this.markdown = new NodeHtmlMarkdown();
    }

    htmlToMd(html: string) {
        return this.markdown.translate(html);
    }

    generateMdHeaders({title, slug, date}: Record<string, any>) {

        let header = '---\n';
        if (title) header += `title: ${title}\n`;
        if(slug) header += `url: ${slug}\n`;
        if(date) header += `url: ${date}\n`;
        header += '---'

        return header;

    }

}
