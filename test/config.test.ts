import { Tag } from '../src/tag';
import { expect } from 'chai';
import 'mocha';
import { Config } from '../src/config';
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

    it('config should load via the config file path', () => {

        config = new Config();
        config.loadConfig("./blog_example/config.json");

        expect(config.output).to.equal("./blog_output");
    });

    it('config should load via the file path', () => {

        config = new Config();
        config.loadPath("./blog_example");

        expect(config.path).to.equal("./blog_example");
    });

    it('config should load via the program', () => {

        config = new Config();
        config.loadPath("./blog_example");

        let obj = {
            output: "foo"
        }

        config.loadProgram(obj)

        expect(config.output).to.equal("foo");
    });

    it('config should load via the index count', () => {

        config = new Config();
        config.loadPath("./blog_example");

        let obj = {
            indexCount: 10
        }

        config.loadProgram(obj)

        expect(config.indexCount).to.equal(10);
    });

    it('config should not load', () => {

        config = new Config();
        config.loadPath("./blog_example");

        config.loadProgram(undefined)

        expect(config.indexCount).to.equal(20);
    });

    it('config should load via the program on render', () => {

        config = new Config();
        config.loadPath("./blog_example");

        let obj = {
            render: "foo,foo2,foo3"
        }

        config.loadProgram(obj)

        expect(config.render.length).to.equal(3);
    });

    it('config should error on load via the file path', () => {

        config = new Config();

        //only log on error
        config.log = new winston.Logger({ transports: [new winston.transports.Console({ level: 'error' })] });

        let valid = config.loadConfig("../blog_example/blah.json");

        expect(valid).to.equal(false);
    });

    it('config constructor should parse render', () => {

        let obj = {
            render: ["html", "json"]
        }

        config = new Config(obj);

        expect(config.render.length).to.equal(2);
    });

    it('config constructor should parse output', () => {

        let obj = {
            output: "./blog1"
        }

        config = new Config(obj);

        expect(config.output).to.equal("./blog1");
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

        expect(config.provider.name).to.equal("file");
    });

    it('config should have default data postPath', () => {

        expect(config.path).to.equal("./blog");
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