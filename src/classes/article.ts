export class Article {
    title: string = '';
    author: string = '';
    url: string = '';
    createdAt: Date = new Date();
    publishedAt: Date = new Date() ;
    keywords: Array<string> = [];
    tags: Array<string> = [];

    filePath: string = '';

    constructor(filePath: string) {
        this.filePath = filePath;

        this.parse(this.filePath);
    }

    parse(filePath: string) : void {
        
    }

}