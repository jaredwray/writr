
export class Post {
    title: string = '';
    author: string = '';
    url: string = '';
    createdAt: Date = new Date();
    publishedAt: Date = new Date() ;
    keywords: Array<string> = [];
    tags: Array<string> = [];
    content: string = '';
    body: string = '';
    header: string = '';
    previewKey?: string = undefined;
    log: any;

    constructor() {
    }

    get id(): string {
        return this.url;
    }

    isPublished(): Boolean {
        let result = false;
        
        if(!this.publishedAt) {
            result = true;
        }

        if(this.publishedAt) {
            if(this.publishedAt.getTime() <= new Date().getTime()) {
                result = true;
            }
        }

        return result;
    }

    
}