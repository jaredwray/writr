import { expect } from 'chai';
import 'mocha';

import {Config} from '../src/classes/config';
import {DataService} from '../src/services/dataService'
import * as moment from 'moment';

describe('Data Service', () => {

    let config : Config = new Config();
    let ds;

    before(() => {

        config.postPath = __dirname + '/blog';
        config.contentPath = __dirname + '/blog/content';
        config.templatePath = __dirname + '/blog/templates';
        ds = new DataService(config);

    });

    it('get a provider based on the config', () => {
        expect(ds.getProvider()).to.not.equal(undefined);
    });

    it('format name correctly', () => {

        expect(ds.formatName('blAh ')).to.equal(`blah`);
    });

    it('generate format post key', () => {

        expect(ds.generatePostKey('blAh ')).to.equal(`post::blah`);
    });

    it('generate format tag key', () => {

        expect(ds.generateTagKey(' blAh ')).to.equal(`tag::blah`);
    });

    it('get posts', () => {

        let posts = ds.getPosts();

        expect(posts.length).to.equal(4);
    });

    it('get post', () => {

        let post = ds.getPost('article-simple');

        expect(post.title).to.equal('Article Simple');
    });

    it('get published post', () => {

        let post = ds.getPublishedPost('article-simple');

        expect(post.title).to.equal('Article Simple');
    });

    it('get unpublished post', () => {

        let post = ds.getPublishedPost('the-largest-whale');

        expect(post).to.equal(undefined);
    });

    it('get published posts', () => {
        
        let posts = ds.getPublishedPosts();

        expect(posts.length).to.equal(3);
    });

    it('get tags', () => {

        let tags = ds.getTags();

        expect(tags.length).to.equal(9);
    });

    it('get published tags', () => {

        let tags = ds.getPublishedTags();

        expect(tags.length).to.equal(6);
    });

    it('get tag that is unpublished', () => {

        let tag = ds.getTag('blast');

        expect(tag.isPublished()).to.equal(false);
    });

    it('get tag that is unpublished', () => {

        let tag = ds.getTag('blast');

        expect(tag.isPublished()).to.equal(false);
    });

});