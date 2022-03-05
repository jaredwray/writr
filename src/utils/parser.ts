import {NodeHtmlMarkdown} from "node-html-markdown";

export class Parser {

    markdown: any;

    constructor() {
        this.markdown = new NodeHtmlMarkdown();
    }

    htmlToMd(html: string) {
        if(!html) return '';
        return this.markdown.translate(html);
    }

    generateMdHeaders({title, slug, date, categories, tags}: Record<string, any>) {

        let header = '---\n';
        if (title) header += `title: ${title}\n`;
        if(slug) header += `url: ${slug}\n`;
        if(date) header += `date: ${(new Date(date)).toISOString().slice(0, 10)}\n`;
        if(categories) header += `categories: ${categories.join(', ')}\n`;
        if(tags) header += `tags: ${tags.join(', ')}\n`;
        header += '---'

        return header;

    }

}
