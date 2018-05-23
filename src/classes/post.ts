import * as fs from 'fs';
import { Logger, transports } from 'winston';
import * as MarkDownIt from 'markdown-it';



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

    constructor(filePath: string | undefined = undefined) {
        this.log = new Logger({transports:[new transports.Console()]});
        
        if(filePath) {
            this.parse(filePath);
        }
    }

    get id(): string {
        return this.url;
    }

    parse(filePath: string) {

        try {
            if(fs.existsSync(filePath)) {
                let data = fs.readFileSync(filePath).toString();

                this.header = data.split('}')[0] + '}';

                this.content = data.substr(data.indexOf('}')+1);

                //clean up header
                this.header = this.header.replace('\n', '');

                let parser = require('parse-json');

                //setup the header
                let headerObj = parser(this.header);

                this.title = headerObj.title;

                if(headerObj.author) {
                    this.author = headerObj.author;
                }

                if(headerObj.url) {
                    this.url = headerObj.url;
                } else {
                    this.url = this.title.toLowerCase().trim().split(' ').join('-');
                }

                if(headerObj.createdAt) {
                    this.createdAt = new Date(headerObj.createdAt);
                }
                
                if(headerObj.publishedAt) {
                    this.publishedAt = new Date(headerObj.publishedAt);
                }

                if(headerObj.keywords) {
                    this.keywords = headerObj.keywords.toString().split(',');
                }

                if(headerObj.tags) {
                    this.tags = headerObj.tags.toString().split(',');
                }

                if(headerObj.previewKey) {
                    this.previewKey = headerObj.previewKey;
                }

                //generate html from markdown
                let markdown = new MarkDownIt();
                this.body = markdown.render(this.content);


            } else {
                this.log.error('The following post does not exist: '+  filePath);
            }
        }
        catch(error) {
            this.log.error(error);
            throw new Error(error);
        }
        
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