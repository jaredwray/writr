import * as wr from '../src/index';
import { Config } from '../src/config'
import { expect } from 'chai';
import 'mocha';

describe('Writr', () => {

  beforeEach(() => {

    let config : Config = new Config();
    config.data.postPath = __dirname + '/blog';
    config.data.contentPath = __dirname + '/blog/content';
    config.data.templatePath = __dirname + '/blog/templates';

    wr.init(config);

  });

  it('config gets setup in init', () => {

    let config = __dirname + '/blog/content';

    expect(wr.getConfig().data.contentPath).to.equal(config);
  });
/*
  it('render the home page', () => {
    let body = wr.renderHome();

    expect(body).to.contain('Article Simple');
  });
 
  it('render a post', () => {
    let body = wr.renderPost('article-simple');

    expect(body).to.contain('Article Simple');
  });
*/ 
});