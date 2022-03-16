import {NodeHtmlMarkdown} from "node-html-markdown";

export class Parser {

    htmlToMd(html: string) {
        if(!html) return '';
        return new NodeHtmlMarkdown().translate(html);
    }

    generateMdHeaders({title, slug, date, categories, tags}: Record<string, any>) {

        let header = '---\n';
        if (title) header += `title: ${title}\n`;
        if(slug) header += `url: ${slug}\n`;
        if(date) header += `date: ${(new Date(date)).toISOString().slice(0, 10)}\n`;
        if(categories) header += `categories: ${typeof categories === 'string' ? categories : categories.join(', ')}\n`;
        if(tags) header += `tags: ${typeof tags === 'string' ? tags : tags.join(', ')}\n`;
        header += '---'

        return header;

    }

    slugify(text: string) {
        const from = "ãàáäâẽèéëêìíïîõòóöôùúüûñç·/_,:;"
        const to = "aaaaaeeeeeiiiiooooouuuunc------"

        const newText = text.split('').map(
          (letter, i) => letter.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i)))

        return newText
          .toString()                     // Cast to string
          .toLowerCase()                  // Convert the string to lowercase letters
          .trim()                         // Remove whitespace from both sides of a string
          .replace(/\s+/g, '-')           // Replace spaces with -
          .replace(/&/g, '-y-')           // Replace & with 'and'
          .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
          .replace(/\-\-+/g, '-');        // Replace multiple - with single -
    }

}
