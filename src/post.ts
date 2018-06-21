
export class Post {
    title: string = "";
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

    static create(obj:any) : Post {
        let result = Object.assign(new Post(), obj);

        result.createdAt = new Date(obj.createdAt);
        result.publishedAt = new Date(obj.publishedAt);

        return result;
    }
}