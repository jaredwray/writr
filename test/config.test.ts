import { Tag } from '../src/tag';
import { expect } from 'chai';
import 'mocha';
import { Config, ConfigCache, ConfigData } from '../src/config';
import winston = require('winston');

describe('Config', () => {

    let config = new Config();

    beforeEach(async () => {

        config = new Config();

    });

    it('config constructor should parse nothing', () => {

        config = new Config(undefined);

        expect(config.cache.type).to.equal("memory");
    });

    it('config constructor should parse data type', () => {

        let obj = {
            data: {
                type: "blah"
            }
        }

        config = new Config(obj);

        expect(config.data.type).to.equal("blah");
    });

    it('config should load via the file path', () => {

        config = new Config();
        config.load("./test/blog/config.json");

        expect(config.data.contentPath).to.equal("./test/blog/images");
    });


    it('config should load via the file path', () => {

        config = new Config();

        //only log on error
        config.log = new winston.Logger({ transports: [new winston.transports.Console({ level: 'error' })] });

        let valid = config.load("./test/blog/blah.json");

        expect(valid).to.equal(false);
    });

    it('config constructor should parse data contentPath', () => {

        let obj = {
            data: {
                contentPath: "blah"
            }
        }

        config = new Config(obj);

        expect(config.data.contentPath).to.equal("blah");
    });

    it('config constructor should parse data postPath', () => {

        let obj = {
            data: {
                postPath: "blah"
            }
        }

        config = new Config(obj);

        expect(config.data.postPath).to.equal("blah");
    });

    it('config constructor should parse data templatePath', () => {

        let obj = {
            data: {
                templatePath: "blah"
            }
        }

        config = new Config(obj);

        expect(config.data.templatePath).to.equal("blah");
    });

    it('config constructor should parse cache connection', () => {

        let obj = {
            cache: {
                connection: "blah"
            }
        }

        config = new Config(obj);

        expect(config.cache.connection).to.equal("blah");
    });

    it('config constructor should parse cache ttl', () => {

        let obj = {
            cache: {
                ttl: 1111
            }
        }

        config = new Config(obj);

        expect(config.cache.ttl).to.equal(1111);
    });

    it('config constructor should parse cache type', () => {

        let obj = {
            cache: {
                type: "blah"
            }
        }

        config = new Config(obj);

        expect(config.cache.type).to.equal("blah");
    });

    it('config should have default data type', () => {

        expect(config.data.type).to.equal("file");
    });

    it('config should have default data contentPath', () => {

        expect(config.data.contentPath).to.equal("./blog/images");
    });

    it('config should have default data postPath', () => {

        expect(config.data.postPath).to.equal("./blog");
    });

    it('config should have default data templatePath', () => {

        expect(config.data.templatePath).to.equal("./blog/template");
    });

    it('config should have default cache connection', () => {

        expect(config.cache.connection).to.equal("");
    });

    it('config should have default cache ttl', () => {

        expect(config.cache.ttl).to.equal(6000);
    });

    it('config should have default cache type', () => {

        expect(config.cache.type).to.equal("memory");
    });

});